"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import { Button, FormField, Input, NativeSelect, Textarea } from "ui";
import { fetcher } from "@/shared/fetcher";
import {
  assignTemplateSchema,
  registerTemplateKeySchema,
  sendTestEmailSchema,
  type AssignTemplateInput,
  type RegisterTemplateKeyInput,
  type SendTestEmailInput,
} from "@/shared/forms/schemas";
import type { EnvironmentRecord } from "@/shared/types";

interface TemplateVariable {
  key: string;
  type: "string" | "number";
  description?: string;
  sampleValue?: string;
}

interface EmailTemplateKey {
  id: string;
  key: string;
  name: string;
  description: string | null;
  variables: TemplateVariable[];
  category: string;
  createdAt: string;
  assignments: {
    id: string;
    resendTemplateId: string;
    environmentId: string | null;
    environment: { id: string; name: string } | null;
  }[];
}

interface Assignment {
  id: string;
  resendTemplateId: string;
  templateKeyId: string;
  environmentId: string | null;
  templateKey: { id: string; key: string; name: string };
  environment: { id: string; name: string } | null;
  createdAt: string;
}

interface ResendTemplate {
  id: string;
  name: string;
  alias: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

const CATEGORY_BADGE: Record<string, string> = {
  transactional: "badge--data",
  auth: "badge--caution",
  notification: "badge--nominal",
};

const STATUS_BADGE: Record<string, string> = {
  published: "badge--nominal",
  draft: "badge--caution",
};

function PreviewModal({
  template,
  onClose,
}: {
  template: ResendTemplate;
  onClose: () => void;
}) {
  const { data, isLoading } = useSWR(
    `/api/email-templates/resend/${template.id}/preview`,
    fetcher
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" />
      <div className="relative w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col panel">
        <div className="panel__header">
          <div>
            <span className="panel__title">{template.name}</span>
            <span className="ml-2 font-mono text-[10px] text-tertiary">
              {template.alias ?? template.id}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-tertiary hover:text-primary"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-8 text-center text-secondary text-sm">
              Loading preview...
            </div>
          ) : data?.html ? (
            <iframe
              srcDoc={data.html}
              className="w-full border-0"
              style={{ height: "600px", background: "#0a0c0f" }}
              sandbox=""
              title="Email Preview"
            />
          ) : (
            <div className="p-8 text-center text-secondary text-sm">
              No HTML preview available.
              {data?.subject && (
                <p className="mt-2 font-mono text-xs text-tertiary">
                  Subject: {data.subject}
                </p>
              )}
            </div>
          )}
        </div>
        {data?.variables && data.variables.length > 0 && (
          <div className="border-t border-border-dim px-4 py-3 bg-elevated">
            <span className="text-[10px] font-medium tracking-wider text-tertiary uppercase mb-2 block">
              Variables
            </span>
            <div className="flex flex-wrap gap-1.5">
              {data.variables.map(
                (v: { key: string; type: string; fallback_value?: string }) => (
                  <span
                    key={v.key}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-data-bg border border-data-dim text-[10px] font-mono text-data"
                  >
                    {v.key}
                    {v.fallback_value && (
                      <span className="text-tertiary">
                        = {String(v.fallback_value)}
                      </span>
                    )}
                  </span>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SendTestModal({
  template,
  registryKeys,
  onClose,
}: {
  template: ResendTemplate;
  registryKeys: EmailTemplateKey[];
  onClose: () => void;
}) {
  const matchingKey = registryKeys.find((k) =>
    k.assignments.some(
      (a) =>
        a.resendTemplateId === template.alias ||
        a.resendTemplateId === template.id
    )
  );

  const initialVars: Record<string, string> = {};
  if (matchingKey) {
    for (const v of matchingKey.variables) {
      initialVars[v.key] = v.sampleValue ?? "";
    }
  }

  const [variables, setVariables] =
    useState<Record<string, string>>(initialVars);
  const [result, setResult] = useState<{
    sent?: boolean;
    error?: string;
  } | null>(null);

  const form = useForm<SendTestEmailInput>({
    resolver: zodResolver(sendTestEmailSchema),
    defaultValues: {
      to: "",
    },
  });

  const handleSend = form.handleSubmit(async ({ to }) => {
    setResult(null);
    try {
      const res = await fetch(
        `/api/email-templates/resend/${template.id}/send-test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to,
            subject: `[TEST] ${template.name}`,
            variables,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data.error ?? "Failed to send" });
      } else {
        setResult({ sent: true });
      }
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg mx-4 panel">
        <div className="panel__header">
          <span className="panel__title">Send Test Email</span>
          <button
            onClick={onClose}
            className="text-tertiary hover:text-primary"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSend}>
          <div className="panel__content space-y-4">
            <div className="flex items-center gap-2 p-2 rounded bg-elevated border border-border-dim">
              <span className={`badge ${STATUS_BADGE[template.status] ?? ""}`}>
                {template.status}
              </span>
              <span className="text-sm text-primary font-medium">
                {template.name}
              </span>
              <span className="font-mono text-[10px] text-tertiary">
                {template.alias ?? template.id}
              </span>
            </div>

            <FormField
              label="Recipient Email"
              htmlFor="send-test-email"
              description="Use delivered@resend.dev for safe testing"
              error={form.formState.errors.to?.message}
            >
              <Input
                id="send-test-email"
                type="email"
                placeholder="you@example.com"
                invalid={!!form.formState.errors.to}
                {...form.register("to")}
              />
            </FormField>

            {Object.keys(variables).length > 0 && (
              <div>
                <label className="label block mb-1.5">Template Variables</label>
                <div className="space-y-2">
                  {Object.entries(variables).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-data w-32 shrink-0 text-right">
                        {key}
                      </span>
                      <Input
                        type="text"
                        value={value}
                        onChange={(e) =>
                          setVariables((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        className="font-mono text-xs flex-1"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result?.sent && (
              <div className="flex items-center gap-2 p-2 rounded bg-nominal/10 border border-nominal/30">
                <span className="status-dot status-dot--nominal" />
                <span className="text-xs text-nominal">
                  Test email sent successfully
                </span>
              </div>
            )}
            {result?.error && (
              <div className="flex items-center gap-2 p-2 rounded bg-critical/10 border border-critical/30">
                <span className="status-dot status-dot--critical" />
                <span className="text-xs text-critical">{result.error}</span>
              </div>
            )}
          </div>
          <div className="px-4 pb-4 flex justify-end gap-3">
            <Button type="button" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={form.formState.isSubmitting}
              disabled={template.status !== "published"}
            >
              {form.formState.isSubmitting ? "Sending..." : "Send Test"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RegisterKeyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const form = useForm<RegisterTemplateKeyInput>({
    resolver: zodResolver(registerTemplateKeySchema),
    defaultValues: {
      key: "",
      name: "",
      description: "",
      category: "transactional",
      variablesText: "[]",
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      const variables = JSON.parse(values.variablesText);

      const res = await fetch("/api/email-templates/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: values.key,
          name: values.name,
          description: values.description || undefined,
          variables,
          category: values.category,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create");
      }
      onCreated();
      onClose();
    } catch (err) {
      form.setError("root", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg mx-4 panel">
        <div className="panel__header">
          <span className="panel__title">Register Email Template Key</span>
          <button
            onClick={onClose}
            className="text-tertiary hover:text-primary"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="panel__content space-y-4">
            <FormField
              label="Key (slug)"
              htmlFor="template-key"
              error={form.formState.errors.key?.message}
            >
              <Input
                id="template-key"
                className="font-mono text-sm"
                placeholder="team-invite"
                invalid={!!form.formState.errors.key}
                {...form.register("key")}
              />
            </FormField>
            <FormField
              label="Display Name"
              htmlFor="template-name"
              error={form.formState.errors.name?.message}
            >
              <Input
                id="template-name"
                className="text-sm"
                placeholder="Team Invitation"
                invalid={!!form.formState.errors.name}
                {...form.register("name")}
              />
            </FormField>
            <FormField label="Description" htmlFor="template-description">
              <Input
                id="template-description"
                className="text-sm"
                placeholder="Sent when an admin invites a new team member"
                {...form.register("description")}
              />
            </FormField>
            <FormField
              label="Category"
              htmlFor="template-category"
              error={form.formState.errors.category?.message}
            >
              <NativeSelect
                id="template-category"
                className="text-sm"
                invalid={!!form.formState.errors.category}
                {...form.register("category")}
              >
                <option value="transactional">Transactional</option>
                <option value="auth">Auth</option>
                <option value="notification">Notification</option>
              </NativeSelect>
            </FormField>
            <FormField
              label="Variables (JSON)"
              htmlFor="template-variables"
              error={
                form.formState.errors.variablesText?.message ??
                form.formState.errors.root?.message
              }
            >
              <Textarea
                id="template-variables"
                className="font-mono text-xs h-32"
                placeholder='[{ "key": "ORG_NAME", "type": "string", "description": "Org name", "sampleValue": "Acme Corp" }]'
                invalid={
                  !!form.formState.errors.variablesText ||
                  !!form.formState.errors.root
                }
                {...form.register("variablesText")}
              />
            </FormField>
          </div>
          <div className="px-4 pb-4 flex justify-end gap-3">
            <Button type="button" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Creating..." : "Register Key"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignModal({
  templateKeys,
  environments,
  onClose,
  onAssigned,
}: {
  templateKeys: EmailTemplateKey[];
  environments: EnvironmentRecord[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const form = useForm<AssignTemplateInput>({
    resolver: zodResolver(assignTemplateSchema),
    defaultValues: {
      templateKeyId: "",
      environmentId: "",
      resendTemplateId: "",
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await fetch("/api/email-templates/assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKeyId: values.templateKeyId,
          environmentId: values.environmentId || null,
          resendTemplateId: values.resendTemplateId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to assign");
      }
      onAssigned();
      onClose();
    } catch (err) {
      form.setError("root", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg mx-4 panel">
        <div className="panel__header">
          <span className="panel__title">Assign Template to Environment</span>
          <button
            onClick={onClose}
            className="text-tertiary hover:text-primary"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="panel__content space-y-4">
            <FormField
              label="Template Key"
              htmlFor="assign-template-key"
              error={form.formState.errors.templateKeyId?.message}
            >
              <NativeSelect
                id="assign-template-key"
                className="text-sm"
                invalid={!!form.formState.errors.templateKeyId}
                {...form.register("templateKeyId")}
              >
                <option value="">Select template key...</option>
                {templateKeys.map((tk) => (
                  <option key={tk.id} value={tk.id}>
                    {tk.name} ({tk.key})
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Environment" htmlFor="assign-environment">
              <NativeSelect
                id="assign-environment"
                className="text-sm"
                {...form.register("environmentId")}
              >
                <option value="">Default (global fallback)</option>
                {environments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label="Resend Template ID"
              htmlFor="assign-resend-template-id"
              error={
                form.formState.errors.resendTemplateId?.message ??
                form.formState.errors.root?.message
              }
            >
              <Input
                id="assign-resend-template-id"
                className="font-mono text-sm"
                placeholder="tmpl_xxx or alias"
                invalid={
                  !!form.formState.errors.resendTemplateId ||
                  !!form.formState.errors.root
                }
                {...form.register("resendTemplateId")}
              />
            </FormField>
          </div>
          <div className="px-4 pb-4 flex justify-end gap-3">
            <Button type="button" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Assigning..." : "Assign"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EmailTemplatesPage() {
  const {
    data: templateKeys,
    isLoading: keysLoading,
    mutate: mutateKeys,
  } = useSWR<EmailTemplateKey[]>("/api/email-templates/keys", fetcher);
  const {
    data: assignments,
    isLoading: assignmentsLoading,
    mutate: mutateAssignments,
  } = useSWR<Assignment[]>("/api/email-templates/assignments", fetcher);
  const { data: resendData, isLoading: resendLoading } = useSWR<{
    data: ResendTemplate[];
  }>("/api/email-templates/resend", fetcher);
  const resendTemplates = resendData?.data ?? [];
  const { data: envs } = useSWR<EnvironmentRecord[]>(
    "/api/environments",
    fetcher
  );
  const [showRegister, setShowRegister] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<ResendTemplate | null>(
    null
  );
  const [sendTestTemplate, setSendTestTemplate] =
    useState<ResendTemplate | null>(null);

  const handleDeleteKey = async (id: string, name: string) => {
    if (
      !confirm(
        `Delete template key "${name}"? This will fail if there are active assignments.`
      )
    )
      return;
    await fetch(`/api/email-templates/keys/${id}`, { method: "DELETE" });
    mutateKeys();
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm("Remove this assignment?")) return;
    await fetch(`/api/email-templates/assignments/${id}`, { method: "DELETE" });
    mutateAssignments();
    mutateKeys();
  };

  const refreshAll = () => {
    mutateKeys();
    mutateAssignments();
  };

  return (
    <>
      {showRegister && (
        <RegisterKeyModal
          onClose={() => setShowRegister(false)}
          onCreated={refreshAll}
        />
      )}
      {showAssign && (
        <AssignModal
          templateKeys={templateKeys ?? []}
          environments={envs ?? []}
          onClose={() => setShowAssign(false)}
          onAssigned={refreshAll}
        />
      )}
      {previewTemplate && (
        <PreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
      {sendTestTemplate && (
        <SendTestModal
          template={sendTestTemplate}
          registryKeys={templateKeys ?? []}
          onClose={() => setSendTestTemplate(null)}
        />
      )}

      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-sans font-semibold">Email Templates</h1>
            <p className="text-xs text-tertiary mt-1">
              Manage Resend email templates and per-environment assignments
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowAssign(true)}>Assign</Button>
            <Button variant="primary" onClick={() => setShowRegister(true)}>
              Register Key
            </Button>
          </div>
        </div>

        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Template Registry</span>
            <span className="font-mono text-[10px] text-tertiary">
              {templateKeys?.length ?? 0}
            </span>
          </div>
          {keysLoading ? (
            <div className="divide-y divide-border-dim">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-4">
                  <div className="w-16 h-4 bg-elevated animate-pulse rounded" />
                  <div className="flex-1 h-4 bg-elevated animate-pulse rounded w-40" />
                </div>
              ))}
            </div>
          ) : (templateKeys?.length ?? 0) === 0 ? (
            <div className="panel__content text-center py-8">
              <p className="text-sm text-secondary mb-3">
                No template keys registered
              </p>
              <Button size="sm" onClick={() => setShowRegister(true)}>
                Register your first key
              </Button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Variables</th>
                  <th>Assignments</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {templateKeys!.map((tk) => (
                  <tr key={tk.id}>
                    <td>
                      <span className="font-mono text-xs text-data">
                        {tk.key}
                      </span>
                    </td>
                    <td>
                      <div>
                        <span className="text-primary font-medium">
                          {tk.name}
                        </span>
                        {tk.description && (
                          <p className="text-[10px] text-tertiary mt-0.5">
                            {tk.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${CATEGORY_BADGE[tk.category] ?? ""}`}
                      >
                        {tk.category}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-xs">
                        {tk.variables.length}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {tk.assignments.length === 0 && (
                          <span className="text-[10px] text-tertiary">
                            none
                          </span>
                        )}
                        {tk.assignments.map((a) => (
                          <span
                            key={a.id}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-elevated text-[10px] font-mono"
                          >
                            <span
                              className="status-dot status-dot--nominal"
                              style={{ width: 5, height: 5 }}
                            />
                            {a.environment?.name ?? "default"}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => handleDeleteKey(tk.id, tk.key)}
                        className="text-tertiary hover:text-critical text-xs font-mono uppercase tracking-wider"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Resend Templates</span>
            <span className="font-mono text-[10px] text-tertiary">
              {resendTemplates.length}
            </span>
          </div>
          {resendLoading ? (
            <div className="divide-y divide-border-dim">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-4">
                  <div className="w-16 h-4 bg-elevated animate-pulse rounded" />
                  <div className="flex-1 h-4 bg-elevated animate-pulse rounded w-40" />
                </div>
              ))}
            </div>
          ) : resendTemplates.length === 0 ? (
            <div className="panel__content text-center py-8">
              <p className="text-sm text-secondary">
                No templates found in Resend
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Alias</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {resendTemplates.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className="text-primary font-medium">{t.name}</span>
                    </td>
                    <td>
                      <span className="font-mono text-xs text-data">
                        {t.alias ?? "—"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[t.status] ?? ""}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-xs text-tertiary">
                        {new Date(t.updated_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPreviewTemplate(t)}
                          className="text-data hover:text-primary text-xs font-mono uppercase tracking-wider"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => setSendTestTemplate(t)}
                          className="text-caution hover:text-primary text-xs font-mono uppercase tracking-wider"
                          disabled={t.status !== "published"}
                          title={
                            t.status !== "published"
                              ? "Template must be published to send"
                              : undefined
                          }
                        >
                          Send Test
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Environment Assignments</span>
            <span className="font-mono text-[10px] text-tertiary">
              {assignments?.length ?? 0}
            </span>
          </div>
          {assignmentsLoading ? (
            <div className="divide-y divide-border-dim">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-4">
                  <div className="w-16 h-4 bg-elevated animate-pulse rounded" />
                  <div className="flex-1 h-4 bg-elevated animate-pulse rounded w-40" />
                </div>
              ))}
            </div>
          ) : (assignments?.length ?? 0) === 0 ? (
            <div className="panel__content text-center py-8">
              <p className="text-sm text-secondary mb-3">No assignments yet</p>
              <Button size="sm" onClick={() => setShowAssign(true)}>
                Create your first assignment
              </Button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Template Key</th>
                  <th>Environment</th>
                  <th>Resend Template ID</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {assignments!.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className="font-mono text-xs text-data">
                        {a.templateKey.key}
                      </span>
                    </td>
                    <td>
                      {a.environment ? (
                        <span className="font-mono text-xs">
                          {a.environment.name}
                        </span>
                      ) : (
                        <span className="text-xs text-caution font-medium">
                          Default
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="font-mono text-xs">
                        {a.resendTemplateId}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-xs text-tertiary">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleDeleteAssignment(a.id)}
                        className="text-tertiary hover:text-critical text-xs font-mono uppercase tracking-wider"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
