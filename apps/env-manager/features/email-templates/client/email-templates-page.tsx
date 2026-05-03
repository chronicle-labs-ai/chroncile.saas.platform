"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogXClose,
  EmailTemplateRegistryCard,
  FormField,
  Input,
  Modal,
  NativeSelect,
  Skeleton,
  Textarea,
  ProductChip,
} from "ui";
import { apiErrorMessage, fetcher } from "@/frontend/shared/fetcher";
import type { EnvironmentRecord } from "@/frontend/shared/types";
import {
  assignEmailTemplate,
  deleteTemplateKey,
  registerTemplateKey,
  deleteAssignment as removeEmailTemplateAssignment,
} from "../api";
import {
  DEFAULT_REGISTER_VARIABLES,
  EMAIL_TEMPLATE_CATEGORIES,
} from "../constants";
import {
  findMatchingResendTemplate,
  isEmailTemplateAssignmentEnvironment,
  sortEmailTemplateAssignmentEnvironment,
  toAssignmentTargets,
  toRegistryEntry,
  toResendTemplateCard,
} from "../mappers";
import type {
  Assignment,
  EmailTemplateKey,
  ResendTemplate,
  ResendTemplatesResponse,
} from "../types";

type EmailTemplateAction = {
  kind: "preview" | "send" | "delete";
  template: EmailTemplateKey;
  resendTemplate?: ResendTemplate | null;
} | null;

function TemplateTableShell({
  title,
  count,
  children,
}: {
  title: React.ReactNode;
  count: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-visible rounded-md border border-l-border bg-l-surface-raised">
      <div className="flex items-center justify-between gap-s-3 border-b border-l-border-faint px-s-4 py-s-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
          {title}
        </span>
        <span className="font-mono text-[10px] text-l-ink-dim">{count}</span>
      </div>
      <div className="p-s-4">{children}</div>
    </div>
  );
}

function assignmentTargetId(
  assignment: EmailTemplateKey["assignments"][number]
) {
  return assignment.environmentId ?? "default";
}

export function EmailTemplatesPage() {
  const {
    data: templateKeys,
    error: keysError,
    isLoading: keysLoading,
    mutate: mutateKeys,
  } = useSWR<EmailTemplateKey[]>("/api/email-templates/keys", fetcher);
  const { mutate: mutateAssignments } = useSWR<Assignment[]>(
    "/api/email-templates/assignments",
    fetcher
  );
  const {
    data: resendData,
    error: resendError,
    isLoading: resendLoading,
    mutate: retryResend,
  } = useSWR<ResendTemplatesResponse>("/api/email-templates/resend", fetcher);
  const {
    data: envs,
    error: envsError,
    mutate: retryEnvs,
  } = useSWR<EnvironmentRecord[]>("/api/environments", fetcher);

  const resendTemplates = resendData?.data ?? [];
  const [showRegister, setShowRegister] = useState(false);
  const [emailAction, setEmailAction] = useState<EmailTemplateAction>(null);
  const [registerKey, setRegisterKey] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerDescription, setRegisterDescription] = useState("");
  const [registerCategory, setRegisterCategory] = useState("transactional");
  const [registerVariables, setRegisterVariables] = useState(
    DEFAULT_REGISTER_VARIABLES
  );
  const [registerResendTemplateId, setRegisterResendTemplateId] = useState("");
  const [registerEnvironmentIds, setRegisterEnvironmentIds] = useState<
    string[]
  >([]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const registerEnvironments = useMemo(
    () =>
      (envs ?? [])
        .filter(isEmailTemplateAssignmentEnvironment)
        .sort(sortEmailTemplateAssignmentEnvironment),
    [envs]
  );

  const defaultRegisterEnvironmentIds = useMemo(() => {
    const staging = registerEnvironments.find(
      (environment) =>
        environment.type === "STAGING" ||
        ["staging", "stage"].includes(environment.name.toLowerCase())
    );
    return staging ? [staging.id] : [];
  }, [registerEnvironments]);

  const refreshAll = async () => {
    await mutateKeys();
    await mutateAssignments();
  };

  const resetRegister = () => {
    setRegisterKey("");
    setRegisterName("");
    setRegisterDescription("");
    setRegisterCategory("transactional");
    setRegisterVariables(DEFAULT_REGISTER_VARIABLES);
    setRegisterResendTemplateId("");
    setRegisterEnvironmentIds(defaultRegisterEnvironmentIds);
    setModalError(null);
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setModalError(null);
    try {
      const templateKey = await registerTemplateKey({
        key: registerKey,
        name: registerName,
        description: registerDescription,
        category: registerCategory,
        variablesText: registerVariables,
      });

      if (registerEnvironmentIds.length > 0) {
        if (!registerResendTemplateId) {
          throw new Error(
            "Select a Resend template before assigning environments."
          );
        }

        await Promise.all(
          registerEnvironmentIds.map((environmentId) =>
            assignEmailTemplate({
              templateKeyId: templateKey.id,
              environmentId,
              resendTemplateId: registerResendTemplateId,
            })
          )
        );
      }

      await refreshAll();
      resetRegister();
      setShowRegister(false);
    } catch (error) {
      setModalError(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteKey = async (template: EmailTemplateKey) => {
    setSubmitting(true);
    setModalError(null);
    try {
      await deleteTemplateKey(template.id);
      setEmailAction(null);
      await refreshAll();
    } catch (error) {
      setModalError(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegistryAssignmentChange = async (
    template: EmailTemplateKey,
    resendTemplate: ResendTemplate | undefined,
    selectedIds: Set<string>
  ) => {
    const allowedEnvironmentIds = new Set(
      registerEnvironments.map((environment) => environment.id)
    );
    const normalizedSelectedIds = new Set(
      [...selectedIds].filter((id) => allowedEnvironmentIds.has(id))
    );
    const existingIds = new Set(template.assignments.map(assignmentTargetId));
    const removedAssignments = template.assignments.filter(
      (assignment) => !normalizedSelectedIds.has(assignmentTargetId(assignment))
    );
    const addedIds = [...normalizedSelectedIds].filter(
      (id) => !existingIds.has(id)
    );

    if (!resendTemplate && addedIds.length > 0) {
      const message =
        "Link a Resend template before assigning this key to more environments.";
      setPageError(message);
      throw new Error(message);
    }

    const resendTemplateId = resendTemplate?.alias ?? resendTemplate?.id;

    await Promise.all([
      ...removedAssignments.map((assignment) =>
        removeEmailTemplateAssignment(assignment.id)
      ),
      ...(resendTemplateId
        ? addedIds.map((id) =>
            assignEmailTemplate({
              templateKeyId: template.id,
              environmentId: id === "default" ? "" : id,
              resendTemplateId,
            })
          )
        : []),
    ]);

    setPageError(null);
    await refreshAll();
  };

  const toggleRegisterEnvironment = (environmentId: string) => {
    setRegisterEnvironmentIds((currentIds) =>
      currentIds.includes(environmentId)
        ? currentIds.filter((id) => id !== environmentId)
        : [...currentIds, environmentId]
    );
  };

  return (
    <>
      {emailAction ? (
        <Modal
          isOpen
          onClose={() => setEmailAction(null)}
          title={
            emailAction?.kind === "delete"
              ? "Delete Template Key"
              : emailAction?.kind === "send"
                ? "Send Test Email"
                : emailAction?.kind === "preview"
                  ? (emailAction.resendTemplate?.name ??
                    emailAction.template.name)
                  : "Preview"
          }
          variant={emailAction?.kind === "delete" ? "danger" : "default"}
          className={emailAction?.kind === "preview" ? "max-w-3xl" : undefined}
          actions={
            emailAction?.kind === "delete" ? (
              <>
                <Button size="sm" onClick={() => setEmailAction(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="critical"
                  isLoading={submitting}
                  onClick={() => void handleDeleteKey(emailAction.template)}
                >
                  Delete
                </Button>
              </>
            ) : emailAction?.kind === "send" ? (
              <>
                <Button size="sm" onClick={() => setEmailAction(null)}>
                  Close
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={emailAction.resendTemplate?.status !== "published"}
                >
                  Send Test
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setEmailAction(null)}>
                Close
              </Button>
            )
          }
        >
          {emailAction?.kind === "delete" ? (
            <div className="space-y-s-3">
              <p>
                Delete template key{" "}
                <span className="font-mono text-l-ink">
                  {emailAction.template.key}
                </span>
                ? This will fail if there are active assignments.
              </p>
              {modalError ? (
                <p className="text-xs text-event-red">{modalError}</p>
              ) : null}
            </div>
          ) : emailAction?.kind === "send" ? (
            <div className="space-y-s-4">
              <div className="flex items-center gap-s-2 rounded-md border border-l-border bg-l-surface px-s-3 py-s-2">
                <ProductChip
                  tone={
                    emailAction.resendTemplate?.status === "published"
                      ? "nominal"
                      : "caution"
                  }
                >
                  {emailAction.resendTemplate?.status ?? "missing"}
                </ProductChip>
                <span className="text-sm font-medium text-l-ink">
                  {emailAction.template.name}
                </span>
                <span className="font-mono text-[10px] text-l-ink-dim">
                  {emailAction.resendTemplate?.alias ??
                    emailAction.template.key}
                </span>
              </div>
              <FormField
                label="Recipient Email"
                htmlFor="send-test-email"
                description="Use delivered@resend.dev for safe testing"
              >
                <Input
                  id="send-test-email"
                  type="email"
                  placeholder="you@example.com"
                />
              </FormField>
              <div>
                <div className="mb-s-2 font-sans text-[12px] font-medium text-l-ink-lo">
                  Template Variables
                </div>
                <div className="space-y-s-2">
                  {emailAction.template.variables.map((variable) => (
                    <div
                      key={variable.key}
                      className="flex items-center gap-s-2"
                    >
                      <span className="w-32 shrink-0 text-right font-mono text-[10px] text-event-teal">
                        {variable.key}
                      </span>
                      <Input
                        defaultValue={variable.sampleValue ?? ""}
                        className="flex-1 font-mono text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-l-border bg-white text-[#1a140a]">
              <div className="border-b border-black/10 px-s-6 py-s-5">
                <div className="text-xs uppercase tracking-[0.12em] text-black/45">
                  Chronicle Labs
                </div>
                <h2 className="mt-s-2 text-2xl font-semibold">
                  {emailAction?.kind === "preview"
                    ? emailAction.template.name
                    : "Email template"}
                </h2>
              </div>
              <div className="space-y-s-3 px-s-6 py-s-5 text-sm leading-relaxed">
                <p>Hi {"{{INVITEE_NAME}}"},</p>
                <p>
                  {"{{INVITER_NAME}}"} invited you to join {"{{ORG_NAME}}"} on
                  Chronicle Labs.
                </p>
                <div className="inline-flex rounded-md bg-[#1a140a] px-s-4 py-s-2 text-white">
                  Accept invitation
                </div>
              </div>
            </div>
          )}
        </Modal>
      ) : null}

      <div className="mx-auto max-w-5xl space-y-s-6">
        <div className="flex items-start justify-between gap-s-4">
          <div>
            <h1 className="font-sans text-xl font-semibold text-l-ink">
              Email Templates
            </h1>
            <p className="mt-1 text-xs text-l-ink-dim">
              Manage Resend email templates and per-environment assignments
            </p>
          </div>
          <Dialog
            open={showRegister}
            onOpenChange={(open) => {
              if (open) {
                resetRegister();
              }
              setShowRegister(open);
            }}
          >
            <DialogTrigger asChild>
              <Button variant="primary">Register Email Template</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <form id="register-template-key" onSubmit={handleRegister}>
                <DialogHeader>
                  <div>
                    <DialogTitle>Register Email Template</DialogTitle>
                    <DialogDescription>
                      Create a registry key and connect it to environment
                      assignments.
                    </DialogDescription>
                  </div>
                  <DialogXClose />
                </DialogHeader>
                <DialogBody className="space-y-s-4">
                  <FormField label="Key (slug)" htmlFor="template-key">
                    <Input
                      id="template-key"
                      required
                      value={registerKey}
                      onChange={(event) => setRegisterKey(event.target.value)}
                      placeholder="team-invite"
                      className="font-mono text-xs"
                    />
                  </FormField>
                  <FormField label="Display Name" htmlFor="template-name">
                    <Input
                      id="template-name"
                      required
                      value={registerName}
                      onChange={(event) => setRegisterName(event.target.value)}
                      placeholder="Team Invitation"
                    />
                  </FormField>
                  <FormField label="Description" htmlFor="template-description">
                    <Input
                      id="template-description"
                      value={registerDescription}
                      onChange={(event) =>
                        setRegisterDescription(event.target.value)
                      }
                      placeholder="Sent when an admin invites a new team member"
                    />
                  </FormField>
                  <FormField label="Category" htmlFor="template-category">
                    <NativeSelect
                      id="template-category"
                      value={registerCategory}
                      onChange={(event) =>
                        setRegisterCategory(event.target.value)
                      }
                    >
                      {EMAIL_TEMPLATE_CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormField>
                  <FormField label="Variables (JSON)" htmlFor="template-vars">
                    <Textarea
                      id="template-vars"
                      value={registerVariables}
                      onChange={(event) =>
                        setRegisterVariables(event.target.value)
                      }
                      className="h-32 font-mono text-xs"
                    />
                  </FormField>
                  <FormField
                    label="Resend Template"
                    htmlFor="register-resend-template"
                    description="Required when assigning this template to environments."
                  >
                    <NativeSelect
                      id="register-resend-template"
                      value={registerResendTemplateId}
                      onChange={(event) =>
                        setRegisterResendTemplateId(event.target.value)
                      }
                    >
                      <option value="">Select Resend template...</option>
                      {resendTemplates.map((template) => (
                        <option
                          key={template.id}
                          value={template.alias ?? template.id}
                        >
                          {template.name} — {template.alias ?? template.id}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormField>
                  <div>
                    <div className="mb-s-2">
                      <div className="font-sans text-[12px] font-medium text-l-ink-lo">
                        Assign to environments
                      </div>
                      <p className="mt-[3px] text-xs text-l-ink-dim">
                        Staging is selected by default. Choose any permanent
                        environment that should use this template.
                      </p>
                    </div>
                    <div className="grid gap-s-2">
                      {envsError ? (
                        <div className="flex items-center justify-between gap-s-3 rounded-md border border-event-red/30 bg-event-red/10 px-s-3 py-s-2">
                          <p className="text-xs text-event-red">
                            {apiErrorMessage(
                              envsError,
                              "Unable to load environments"
                            )}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => void retryEnvs()}
                          >
                            Retry
                          </Button>
                        </div>
                      ) : registerEnvironments.length === 0 ? (
                        <p className="rounded-md border border-l-border bg-l-surface px-s-3 py-s-2 text-xs text-l-ink-dim">
                          No prod, staging, or dev environments available.
                        </p>
                      ) : (
                        registerEnvironments.map((environment) => (
                          <label
                            key={environment.id}
                            className="flex items-center justify-between gap-s-3 rounded-md border border-l-border bg-l-surface px-s-3 py-s-2 text-xs text-l-ink transition-colors hover:border-l-border-strong"
                          >
                            <span>
                              <span className="block font-medium">
                                {environment.name}
                              </span>
                              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
                                {environment.type.toLowerCase()}
                              </span>
                            </span>
                            <input
                              type="checkbox"
                              checked={registerEnvironmentIds.includes(
                                environment.id
                              )}
                              onChange={() =>
                                toggleRegisterEnvironment(environment.id)
                              }
                              className="h-4 w-4 accent-ember"
                            />
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  {modalError ? (
                    <p className="text-xs text-event-red">{modalError}</p>
                  ) : null}
                </DialogBody>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button size="sm">Cancel</Button>
                  </DialogClose>
                  <Button
                    size="sm"
                    variant="primary"
                    type="submit"
                    isLoading={submitting}
                  >
                    Register Email Template
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {pageError ? (
          <div className="rounded-md border border-event-red/30 bg-event-red/10 px-s-4 py-s-3 text-sm text-event-red">
            {pageError}
          </div>
        ) : null}

        <TemplateTableShell
          title="Template Registry"
          count={templateKeys?.length ?? 0}
        >
          <div className="space-y-s-3">
            {keysError ? (
              <div className="space-y-s-3 py-s-8 text-center">
                <p className="text-sm text-l-ink-dim">
                  {apiErrorMessage(keysError, "Unable to load template keys")}
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void mutateKeys()}
                >
                  Retry
                </Button>
              </div>
            ) : resendError ? (
              <div className="space-y-s-3 py-s-8 text-center">
                <p className="text-sm text-l-ink-dim">
                  {apiErrorMessage(
                    resendError,
                    "Unable to load Resend templates"
                  )}
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void retryResend()}
                >
                  Retry
                </Button>
              </div>
            ) : keysLoading || resendLoading ? (
              <>
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </>
            ) : (templateKeys?.length ?? 0) === 0 ? (
              <div className="py-s-8 text-center">
                <p className="mb-s-3 text-sm text-l-ink-dim">
                  No template keys registered.
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    resetRegister();
                    setShowRegister(true);
                  }}
                >
                  Register your first email template
                </Button>
              </div>
            ) : (
              templateKeys!.map((template) => {
                const resendTemplate = findMatchingResendTemplate(
                  template,
                  resendTemplates
                );
                return (
                  <EmailTemplateRegistryCard
                    key={template.id}
                    template={toRegistryEntry(template)}
                    assignmentTargets={toAssignmentTargets(template, envs)}
                    resendTemplate={toResendTemplateCard(resendTemplate)}
                    onAssignmentChange={(ids) =>
                      handleRegistryAssignmentChange(
                        template,
                        resendTemplate,
                        ids
                      )
                    }
                    onPreview={() => {
                      setEmailAction({
                        kind: "preview",
                        template,
                        resendTemplate,
                      });
                    }}
                    onSendTest={() => {
                      setEmailAction({
                        kind: "send",
                        template,
                        resendTemplate,
                      });
                    }}
                    onDelete={() =>
                      setEmailAction({
                        kind: "delete",
                        template,
                        resendTemplate,
                      })
                    }
                  />
                );
              })
            )}
          </div>
        </TemplateTableShell>
      </div>
    </>
  );
}
