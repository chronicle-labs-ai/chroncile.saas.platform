import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { Button } from "../primitives/button";
import { FormField } from "../primitives/form-field";
import { Input } from "../primitives/input";
import { Modal } from "../primitives/modal";
import { ProductChip } from "../product/product-chip";
import {
  EmailTemplateRegistryCard,
  type EmailTemplateAssignmentTarget,
  type EmailTemplateRegistryEntry,
  type EmailTemplateResendTemplate,
} from "./email-template-registry-card";

const meta = {
  title: "Env Manager/EmailTemplateRegistryCard",
  component: EmailTemplateRegistryCard,
  parameters: { layout: "padded" },
  args: {
    template: {
      id: "team-invite",
      key: "team-invite",
      name: "Team Invitation",
      description: "Sent when an admin invites a new team member",
      category: "auth",
      variables: ["ORG_NAME", "INVITE_URL", "INVITER_NAME"],
      assignments: ["default", "production"],
    },
    resendTemplate: {
      id: "tmpl_team_invite",
      name: "Team Invite",
      alias: "team-invite",
      status: "published",
      updatedAt: "Apr 25, 2026",
    },
    assignmentTargets: [
      {
        id: "default",
        name: "Default",
        description: "Global fallback",
        selected: true,
      },
      {
        id: "production",
        name: "production",
        description: "app.chroniclelabs.io",
        selected: true,
      },
      {
        id: "staging",
        name: "staging",
        description: "chronicle-staging.vercel.app",
      },
      {
        id: "development",
        name: "development",
        description: "chronicle-dev.vercel.app",
      },
    ],
  },
} satisfies Meta<typeof EmailTemplateRegistryCard>;

export default meta;
type Story = StoryObj<typeof EmailTemplateRegistryCard>;

export const Default: Story = {};

export const MissingResend: Story = {
  args: {
    resendTemplate: null,
  },
};

type ResendVariable = {
  key: string;
  label: string;
  sampleValue: string;
};

type LinkedResendTemplate = EmailTemplateRegistryEntry & {
  subject: string;
  previewText: string;
  resendDashboardUrl: string;
  variablesConfig: ResendVariable[];
};

const linkedTemplate: LinkedResendTemplate = {
  id: "team-invite",
  key: "team-invite",
  name: "Team Invitation",
  description:
    "Linked to a hosted Resend template and assigned per environment.",
  category: "auth",
  subject: "You've been invited to join {{ORG_NAME}} on Chronicle Labs",
  previewText: "A teammate invited you to join their Chronicle Labs workspace.",
  resendDashboardUrl: "https://resend.com/emails/templates/tmpl_team_invite",
  variables: [
    "ORG_NAME",
    "INVITER_NAME",
    "INVITEE_EMAIL",
    "ACCEPT_URL",
    "ROLE",
  ],
  variablesConfig: [
    { key: "ORG_NAME", label: "Organization", sampleValue: "Acme Corp" },
    { key: "INVITER_NAME", label: "Inviter", sampleValue: "Ayman" },
    {
      key: "INVITEE_EMAIL",
      label: "Invitee email",
      sampleValue: "new.user@example.com",
    },
    {
      key: "ACCEPT_URL",
      label: "Accept URL",
      sampleValue: "https://app.chronicle-labs.com/invite/demo",
    },
    { key: "ROLE", label: "Role", sampleValue: "Admin" },
  ],
  assignments: ["staging"],
};

const linkedResendTemplate: EmailTemplateResendTemplate = {
  id: "tmpl_team_invite",
  name: "Team Invite",
  alias: "team-invite",
  status: "published",
  updatedAt: "Apr 28, 2026",
};

const assignmentTargets: EmailTemplateAssignmentTarget[] = [
  {
    id: "production",
    name: "production",
    description: "app.chroniclelabs.io",
  },
  {
    id: "staging",
    name: "staging",
    description: "chronicle-staging.vercel.app",
    selected: true,
  },
  {
    id: "development",
    name: "development",
    description: "chronicle-dev.vercel.app",
  },
];

function createDefaultVariables() {
  return Object.fromEntries(
    linkedTemplate.variablesConfig.map((variable) => [
      variable.key,
      variable.sampleValue,
    ])
  );
}

function interpolate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => {
    return variables[key] ?? `{{${key}}}`;
  });
}

function ResendTemplateCard({
  onOpenResend,
  onSendTest,
}: {
  onOpenResend?: () => void;
  onSendTest?: () => void;
}) {
  const [assignmentIds, setAssignmentIds] = React.useState(
    new Set(["staging"])
  );

  return (
    <div className="max-w-5xl space-y-s-4">
      <div className="rounded-md border border-hairline-strong bg-l-surface-raised p-s-4">
        <div className="mb-s-3 flex flex-wrap items-center justify-between gap-s-3">
          <div>
            <div className="font-sans text-sm font-medium text-l-ink">
              Resend Template Link
            </div>
            <p className="mt-[3px] text-xs text-l-ink-dim">
              Env-manager links registry keys to hosted Resend template IDs,
              then sends tests through the API.
            </p>
          </div>
          <div className="flex gap-s-2">
            <ProductChip tone="nominal">published</ProductChip>
            <ProductChip>Resend source</ProductChip>
          </div>
        </div>

        <EmailTemplateRegistryCard
          template={{
            ...linkedTemplate,
            assignments: Array.from(assignmentIds),
          }}
          resendTemplate={linkedResendTemplate}
          assignmentTargets={assignmentTargets.map((target) => ({
            ...target,
            selected: assignmentIds.has(target.id),
          }))}
          onAssignmentChange={(ids) => setAssignmentIds(new Set(ids))}
          onPreview={onOpenResend}
          onSendTest={onSendTest}
          onDelete={onOpenResend}
        />

        <div className="mt-s-3 grid gap-s-3 rounded-md border border-hairline-strong bg-l-surface px-s-3 py-s-3 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
              Linked Resend Template ID
            </div>
            <div className="mt-[4px] font-mono text-xs text-event-teal">
              {linkedResendTemplate.id}
            </div>
            <div className="mt-[4px] text-xs text-l-ink-dim">
              Alias: {linkedResendTemplate.alias} · Subject:{" "}
              {linkedTemplate.subject}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-s-2">
            <Button size="sm" onClick={onOpenResend}>
              Open in Resend
            </Button>
            <Button size="sm" variant="primary" onClick={onSendTest}>
              Send Test
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResendTemplateDetailsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Linked Resend Template"
      className="max-w-2xl"
      actions={
        <>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() =>
              window.open(linkedTemplate.resendDashboardUrl, "_blank")
            }
          >
            Open in Resend
          </Button>
        </>
      }
    >
      <div className="space-y-s-4">
        <div className="grid gap-s-3 md:grid-cols-2">
          <div className="rounded-md border border-hairline-strong bg-l-surface px-s-3 py-s-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
              Template ID
            </div>
            <div className="mt-[4px] font-mono text-xs text-event-teal">
              {linkedResendTemplate.id}
            </div>
          </div>
          <div className="rounded-md border border-hairline-strong bg-l-surface px-s-3 py-s-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
              Alias
            </div>
            <div className="mt-[4px] font-mono text-xs text-l-ink">
              {linkedResendTemplate.alias}
            </div>
          </div>
          <div className="rounded-md border border-hairline-strong bg-l-surface px-s-3 py-s-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
              Status
            </div>
            <div className="mt-[4px] text-xs text-l-ink">
              {linkedResendTemplate.status}
            </div>
          </div>
          <div className="rounded-md border border-hairline-strong bg-l-surface px-s-3 py-s-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
              Updated
            </div>
            <div className="mt-[4px] text-xs text-l-ink">
              {linkedResendTemplate.updatedAt}
            </div>
          </div>
        </div>

        <div className="rounded-md border border-hairline-strong bg-l-surface px-s-3 py-s-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
            Variables expected by Resend
          </div>
          <div className="mt-s-2 flex flex-wrap gap-[4px]">
            {linkedTemplate.variables.map((variable) => (
              <ProductChip key={String(variable)}>{variable}</ProductChip>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-hairline-strong bg-l-surface px-s-3 py-s-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
            Dashboard URL
          </div>
          <div className="mt-[4px] break-all font-mono text-xs text-event-teal">
            {linkedTemplate.resendDashboardUrl}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function SendTestModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [variables, setVariables] = React.useState<Record<string, string>>(
    createDefaultVariables()
  );
  const [recipient, setRecipient] = React.useState("delivered@resend.dev");
  const [status, setStatus] = React.useState<"idle" | "sent">("idle");
  const subject = interpolate(linkedTemplate.subject, variables);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Send Resend Template Test"
      className="max-w-2xl"
      actions={
        <>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
          <Button size="sm" variant="primary" onClick={() => setStatus("sent")}>
            Send via API
          </Button>
        </>
      }
    >
      <div className="space-y-s-4">
        <div className="rounded-md border border-hairline-strong bg-l-surface px-s-3 py-s-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
            API request
          </div>
          <pre className="mt-s-2 overflow-x-auto rounded-md bg-[#0c0f13] p-s-3 font-mono text-[11px] leading-relaxed text-l-ink-dim">
            {`POST /api/email-templates/resend/${linkedResendTemplate.id}/send-test
{
  "to": "${recipient}",
  "subject": "${subject}",
  "variables": ${JSON.stringify(variables, null, 2)}
}`}
          </pre>
        </div>

        <FormField
          label="Recipient Email"
          htmlFor="test-recipient"
          description="Use delivered@resend.dev for safe tests."
        >
          <Input
            id="test-recipient"
            type="email"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
          />
        </FormField>

        <div>
          <div className="mb-s-2 font-sans text-[12px] font-medium text-l-ink-lo">
            Template Variables
          </div>
          <div className="grid gap-s-2 md:grid-cols-2">
            {linkedTemplate.variablesConfig.map((variable) => (
              <FormField
                key={variable.key}
                label={variable.label}
                htmlFor={`send-${variable.key}`}
              >
                <Input
                  id={`send-${variable.key}`}
                  value={variables[variable.key] ?? ""}
                  onChange={(event) =>
                    setVariables((current) => ({
                      ...current,
                      [variable.key]: event.target.value,
                    }))
                  }
                  className="font-mono text-xs"
                />
              </FormField>
            ))}
          </div>
        </div>

        {status === "sent" ? (
          <div className="rounded-md border border-event-green/30 bg-event-green/10 px-s-3 py-s-2 text-xs text-event-green">
            Test send queued through{" "}
            <span className="font-mono">{linkedResendTemplate.id}</span> to{" "}
            {recipient}.
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function ResendFlowPrototype({
  initialAction,
}: {
  initialAction?: "details" | "send";
}) {
  const [action, setAction] = React.useState<"details" | "send" | null>(
    initialAction ?? null
  );

  return (
    <>
      <ResendTemplateCard
        onOpenResend={() => setAction("details")}
        onSendTest={() => setAction("send")}
      />
      <ResendTemplateDetailsModal
        isOpen={action === "details"}
        onClose={() => setAction(null)}
      />
      <SendTestModal
        isOpen={action === "send"}
        onClose={() => setAction(null)}
      />
    </>
  );
}

export const ResendLinkedTemplate: Story = {
  parameters: { layout: "padded" },
  render: () => <ResendFlowPrototype />,
};

export const ResendTemplateDetails: Story = {
  parameters: { layout: "padded" },
  render: () => <ResendFlowPrototype initialAction="details" />,
};

export const ResendSendTest: Story = {
  parameters: { layout: "padded" },
  render: () => <ResendFlowPrototype initialAction="send" />,
};
