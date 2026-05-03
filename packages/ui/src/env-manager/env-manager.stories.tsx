import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import {
  EnvCubeIcon,
  EnvDatabaseIcon,
  EnvMailIcon,
  EnvPlusIcon,
  EnvUsersIcon,
} from "../icons";
import { Logo } from "../primitives/logo";
import { Button } from "../primitives/button";
import { FormField } from "../primitives/form-field";
import { Input } from "../primitives/input";
import { Modal } from "../primitives/modal";
import { NativeSelect } from "../primitives/native-select";
import { StatusDot, type StatusDotVariant } from "../primitives/status-dot";
import { Textarea } from "../primitives/textarea";
import { ProductChip } from "../product/product-chip";
import { Sidebar } from "../layout/sidebar";
import { EmailTemplateRegistryCard } from "./email-template-registry-card";
import { EnvBadge, type EnvBadgeVariant } from "./env-badge";
import { LogStream } from "./log-stream";
import { ProvisioningTimeline } from "./provisioning-timeline";

const meta: Meta = {
  title: "Env Manager/Composed",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

type EmailAction =
  | { kind: "register" }
  | {
      kind: "preview" | "send" | "delete";
      template: (typeof mockTemplateKeys)[number];
      resendTemplate?: (typeof mockResendTemplates)[number];
    }
  | null;

type MockEnvironment = {
  id: string;
  name: string;
  type: EnvBadgeVariant;
  typeLabel?: string;
  status: "RUNNING" | "PROVISIONING" | "ERROR" | "STOPPED";
  gitBranch?: string;
  gitSha?: string;
  flyAppUrl?: string;
  vercelUrl?: string;
  isHealthy: boolean;
  lastHealthLabel: string;
  expiresLabel?: string;
};

const mockEnvironments: MockEnvironment[] = [
  {
    id: "prod",
    name: "production",
    type: "prod",
    status: "RUNNING",
    gitBranch: "main",
    gitSha: "9f81abc3",
    flyAppUrl: "https://api.chroniclelabs.io",
    vercelUrl: "https://app.chroniclelabs.io",
    isHealthy: true,
    lastHealthLabel: "2m ago",
  },
  {
    id: "staging",
    name: "staging",
    type: "stg",
    status: "RUNNING",
    gitBranch: "staging",
    gitSha: "42ab109",
    flyAppUrl: "https://chronicle-staging.fly.dev",
    vercelUrl: "https://chronicle-staging.vercel.app",
    isHealthy: true,
    lastHealthLabel: "4m ago",
  },
  {
    id: "dev",
    name: "development",
    type: "dev",
    status: "RUNNING",
    gitBranch: "develop",
    gitSha: "7c3e801",
    flyAppUrl: "https://chronicle-dev.fly.dev",
    vercelUrl: "https://chronicle-dev.vercel.app",
    isHealthy: true,
    lastHealthLabel: "just now",
  },
  {
    id: "pr-1276",
    name: "invite-flow · pr-1276",
    type: "ephemeral",
    typeLabel: "EPHEMERAL",
    status: "RUNNING",
    gitBranch: "feature/invite-flow",
    gitSha: "8f3a91c",
    flyAppUrl: "https://chronicle-pr-1276.fly.dev",
    vercelUrl: "https://chronicle-pr-1276.vercel.app",
    isHealthy: true,
    lastHealthLabel: "6m ago",
    expiresLabel: "18h remaining",
  },
  {
    id: "pr-1291",
    name: "env-redesign · pr-1291",
    type: "ephemeral",
    typeLabel: "EPHEMERAL",
    status: "PROVISIONING",
    gitBranch: "feature/env-manager-redesign",
    gitSha: "d2b5450",
    flyAppUrl: "https://chronicle-pr-1291.fly.dev",
    isHealthy: false,
    lastHealthLabel: "never",
    expiresLabel: "24h remaining",
  },
];

const statusTone: Record<MockEnvironment["status"], StatusDotVariant> = {
  RUNNING: "green",
  PROVISIONING: "amber",
  ERROR: "red",
  STOPPED: "offline",
};

const mockBranches = [
  { name: "main", sha: "9f81abc3", isDefault: true },
  { name: "feature/invite-flow", sha: "8f3a91c", isDefault: false },
  { name: "feature/env-manager-redesign", sha: "d2b5450", isDefault: false },
  { name: "fix/doppler-sync", sha: "4a18cc2", isDefault: false },
];

const ttlOptions = ["4 hours", "12 hours", "24 hours", "48 hours", "7 days"];

const mockDbTemplates = [
  {
    id: "fresh",
    name: "Fresh empty database",
    description: "New Fly Postgres cluster with only migrations applied",
    mode: null,
  },
  {
    id: "support-seed",
    name: "Support demo seed",
    description: "Fresh DB with fixture tenants, tickets, and billing state",
    mode: "Seed",
  },
  {
    id: "staging-fork",
    name: "Fork from staging",
    description: "Snapshot data from the staging environment",
    mode: "Env",
  },
];

const mockDevelopers = [
  {
    id: "dev-ayman",
    name: "ayman",
    email: "ayman@chronicle-labs.com",
    tunnelDomain: "ayman.chronicle-labs.com",
    dopplerSuffix: "ayman",
  },
  {
    id: "dev-sarah",
    name: "sarah",
    email: "sarah@chronicle-labs.com",
    tunnelDomain: "sarah.chronicle-labs.com",
    dopplerSuffix: "sarah",
  },
  {
    id: "dev-ernesto",
    name: "ernesto",
    email: null,
    tunnelDomain: "ernesto.chronicle-labs.com",
    dopplerSuffix: "ernesto",
  },
];

function assignmentTargetsFor(template: (typeof mockTemplateKeys)[number]) {
  const targets = [
    {
      id: "default",
      name: "Default",
      description: "Global fallback",
    },
    ...mockEnvironments
      .filter((env) => env.type !== "ephemeral")
      .map((env) => ({
        id: env.id,
        name: env.name,
        description: env.vercelUrl?.replace("https://", "") ?? env.id,
      })),
  ];

  return targets.map((target) => ({
    ...target,
    selected: template.assignments.some(
      (assignment) =>
        assignment.toString().toLowerCase() === target.id ||
        assignment.toString().toLowerCase() === target.name.toLowerCase()
    ),
  }));
}

const mockTemplateKeys = [
  {
    id: "key-team-invite",
    key: "team-invite",
    name: "Team Invitation",
    description: "Sent when an admin invites a new team member",
    category: "auth",
    variables: ["ORG_NAME", "INVITE_URL", "INVITER_NAME"],
    assignments: ["default", "production"],
  },
  {
    id: "key-billing-alert",
    key: "billing-alert",
    name: "Billing Alert",
    description: "Notifies workspace admins about payment failures",
    category: "transactional",
    variables: ["ORG_NAME", "INVOICE_URL"],
    assignments: ["staging"],
  },
];

const mockResendTemplates = [
  {
    id: "tmpl_team_invite",
    name: "Team Invite",
    alias: "team-invite",
    status: "published",
    updatedAt: "Apr 25, 2026",
  },
  {
    id: "tmpl_billing_alert",
    name: "Billing Alert",
    alias: "billing-alert",
    status: "draft",
    updatedAt: "Apr 22, 2026",
  },
];

function Brand() {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-[10px]">
      <Logo className="h-6 w-6 shrink-0" variant="icon" theme="auto" />
      <span className="min-w-0 flex-1 leading-none">
        <span className="block truncate font-sans text-sm font-thin tracking-[-0.01em] text-ink-hi">
          Chronicle Labs
        </span>
        <span className="mt-[3px] block truncate font-mono text-[9px] uppercase tracking-[0.08em] text-ink-dim">
          Environment Manager
        </span>
      </span>
    </div>
  );
}

function EnvSidebar({
  active = "environments",
}: {
  active?: "environments" | "new" | "templates" | "developers" | "email";
}) {
  return (
    <Sidebar variant="static">
      <Sidebar.Header>
        <Brand />
      </Sidebar.Header>
      <Sidebar.Nav aria-label="Env manager">
        <Sidebar.NavSection title="Navigation">
          <Sidebar.NavItem
            icon={<EnvCubeIcon />}
            isActive={active === "environments"}
          >
            Environments
          </Sidebar.NavItem>
          <Sidebar.NavItem icon={<EnvPlusIcon />} isActive={active === "new"}>
            New Environment
          </Sidebar.NavItem>
          <Sidebar.NavItem
            icon={<EnvDatabaseIcon />}
            isActive={active === "templates"}
          >
            DB Templates
          </Sidebar.NavItem>
          <Sidebar.NavItem
            icon={<EnvUsersIcon />}
            isActive={active === "developers"}
          >
            Developers
          </Sidebar.NavItem>
          <Sidebar.NavItem icon={<EnvMailIcon />} isActive={active === "email"}>
            Email Templates
          </Sidebar.NavItem>
        </Sidebar.NavSection>
      </Sidebar.Nav>
      <Sidebar.Meta rows={[{ label: "Version", value: "0.1.0" }]} />
      <Sidebar.Footer>
        <Sidebar.UserCard name="Ayman Saleh" email="ayman@chronicle-labs.com" />
      </Sidebar.Footer>
    </Sidebar>
  );
}

function BranchIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0 text-l-ink-dim"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
      />
    </svg>
  );
}

function EnvironmentDashboardCard({ env }: { env: MockEnvironment }) {
  return (
    <div className="flex cursor-pointer flex-col gap-s-3 rounded-md border border-hairline-strong bg-l-surface-raised transition-colors hover:border-l-border-strong hover:bg-l-surface-hover">
      <div className="flex items-center justify-between gap-s-3 border-b border-l-border-faint px-s-4 py-s-3">
        <div className="flex min-w-0 items-center gap-s-2">
          <EnvBadge variant={env.type}>{env.typeLabel}</EnvBadge>
          <h3 className="truncate font-mono text-sm text-l-ink">{env.name}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-s-2">
          <StatusDot
            variant={statusTone[env.status]}
            pulse={env.status === "RUNNING" || env.status === "PROVISIONING"}
          />
          <span className="font-mono text-[10px] uppercase tracking-wider text-l-ink-dim">
            {env.status}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-s-3 px-s-4 pb-s-4">
        {env.gitBranch ? (
          <div className="flex items-center gap-s-2 text-xs text-l-ink-lo">
            <BranchIcon />
            <span className="truncate font-mono">{env.gitBranch}</span>
            {env.gitSha ? (
              <span className="font-mono text-l-ink-dim">
                {env.gitSha.slice(0, 7)}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-[6px] text-xs">
          {env.flyAppUrl ? (
            <div className="flex items-center gap-s-2">
              <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
                Backend
              </span>
              <span className="truncate font-mono text-l-ink-lo">
                {env.flyAppUrl.replace("https://", "")}
              </span>
            </div>
          ) : null}
          {env.vercelUrl ? (
            <div className="flex items-center gap-s-2">
              <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
                Frontend
              </span>
              <span className="truncate font-mono text-l-ink-lo">
                {env.vercelUrl.replace("https://", "")}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-s-3 border-t border-l-border-faint pt-s-2">
          <div className="flex items-center gap-s-2">
            <StatusDot variant={env.isHealthy ? "green" : "red"} />
            <span className="font-mono text-[10px] text-l-ink-dim">
              {env.lastHealthLabel}
            </span>
          </div>
          <div className="flex items-center gap-s-3">
            {env.expiresLabel ? (
              <span className="font-mono text-[10px] text-event-amber">
                TTL: {env.expiresLabel}
              </span>
            ) : null}
            {env.type === "ephemeral" && env.status === "RUNNING" ? (
              <Button size="sm" variant="critical">
                Destroy
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function EnvironmentSection({
  title,
  environments,
  empty,
}: {
  title: string;
  environments: MockEnvironment[];
  empty?: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-s-3 flex items-center gap-s-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
          {title}
        </span>
        <span className="font-mono text-[10px] text-l-ink-dim">
          {environments.length}
        </span>
      </div>
      {environments.length === 0 ? (
        empty
      ) : (
        <div className="grid grid-cols-1 gap-s-4 md:grid-cols-2 xl:grid-cols-3">
          {environments.map((env) => (
            <EnvironmentDashboardCard key={env.id} env={env} />
          ))}
        </div>
      )}
    </section>
  );
}

function NewEnvironmentPanel({
  title,
  action,
  children,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-hairline-strong bg-l-surface-raised">
      <div className="flex items-center justify-between gap-s-3 border-b border-l-border-faint px-s-4 py-s-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
          {title}
        </span>
        {action}
      </div>
      <div className="p-s-4">{children}</div>
    </div>
  );
}

function BranchSelectMock() {
  const selected = mockBranches[1]!;
  return (
    <button
      type="button"
      className="flex w-full items-center gap-s-3 rounded-md border border-hairline-strong bg-l-surface px-s-3 py-[10px] text-left transition-colors hover:border-l-border-strong"
    >
      <BranchIcon />
      <div className="flex min-w-0 flex-1 items-center gap-s-2">
        <span className="truncate font-mono text-sm text-l-ink">
          {selected.name}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[10px] text-l-ink-dim">
          {selected.sha.slice(0, 7)}
        </span>
      </div>
      <svg
        className="h-4 w-4 shrink-0 text-l-ink-dim"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 8.25l-7.5 7.5-7.5-7.5"
        />
      </svg>
    </button>
  );
}

function RadioChoice({
  selected = false,
  title,
  description,
  badge,
}: {
  selected?: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-s-3 rounded-md border p-s-3 transition-colors ${
        selected
          ? "border-[var(--l-accent)] bg-[var(--l-accent-muted)]"
          : "border-hairline-strong hover:border-l-border-strong"
      }`}
    >
      <input
        type="radio"
        checked={selected}
        readOnly
        className="mt-[3px] accent-[var(--l-accent)]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-s-2">
          <span
            className={`text-sm font-medium ${
              selected ? "text-[color:var(--l-accent)]" : "text-l-ink"
            }`}
          >
            {title}
          </span>
          {badge ? (
            <span className="rounded-sm bg-l-surface px-[6px] py-[2px] font-mono text-[9px] uppercase tracking-wider text-l-ink-dim">
              {badge}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="mt-[2px] text-[10px] text-l-ink-dim">{description}</p>
        ) : null}
      </div>
    </label>
  );
}

function NewEnvironmentSurface() {
  return (
    <div className="grid min-h-screen grid-cols-[256px_1fr] bg-l-surface">
      <EnvSidebar active="new" />
      <main className="px-s-6 py-s-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-s-6">
            <Button variant="ghost" size="sm">
              {"<-"} Back to Dashboard
            </Button>
          </div>

          <div className="mb-s-6">
            <h1 className="font-sans text-xl font-semibold text-l-ink">
              New Ephemeral Environment
            </h1>
            <p className="mt-1 text-xs text-l-ink-dim">
              Spin up an isolated environment for any git branch
            </p>
          </div>

          <form className="space-y-s-6">
            <NewEnvironmentPanel title="Git Branch">
              <BranchSelectMock />
            </NewEnvironmentPanel>

            <NewEnvironmentPanel title="Time to Live">
              <div className="flex flex-wrap gap-s-2">
                {ttlOptions.map((ttl) => (
                  <Button
                    key={ttl}
                    size="sm"
                    variant={ttl === "24 hours" ? "primary" : "secondary"}
                  >
                    {ttl}
                  </Button>
                ))}
              </div>
            </NewEnvironmentPanel>

            <NewEnvironmentPanel
              title="Database"
              action={
                <span className="font-mono text-[10px] text-event-teal">
                  Manage Templates
                </span>
              }
            >
              <div className="space-y-s-3">
                {mockDbTemplates.map((template) => (
                  <RadioChoice
                    key={template.id}
                    selected={template.id === "fresh"}
                    title={template.name}
                    description={template.description}
                    badge={template.mode}
                  />
                ))}
              </div>
            </NewEnvironmentPanel>

            <NewEnvironmentPanel
              title="Secrets"
              action={
                <span className="font-mono text-[10px] text-l-ink-dim">
                  Optional overrides
                </span>
              }
            >
              <div className="space-y-s-4">
                <p className="text-xs text-l-ink-dim">
                  Leave blank to use defaults from SECRETS_TEMPLATE.
                </p>
                <FormField label="Auth Secret" htmlFor="auth-secret">
                  <Input
                    id="auth-secret"
                    placeholder="Override or leave blank for default"
                    className="font-mono text-xs"
                  />
                </FormField>
                <FormField label="Stripe Secret Key" htmlFor="stripe-secret">
                  <Input
                    id="stripe-secret"
                    placeholder="sk_test_..."
                    className="font-mono text-xs"
                  />
                </FormField>
              </div>
            </NewEnvironmentPanel>

            <Button variant="primary" className="w-full justify-center py-s-3">
              Create Environment
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}

function DevelopersSurface() {
  return (
    <div className="grid min-h-screen grid-cols-[256px_1fr] bg-l-surface">
      <EnvSidebar active="developers" />
      <main className="px-s-6 py-s-6">
        <div className="mx-auto max-w-6xl space-y-s-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-sans text-xl font-semibold text-l-ink">
                Developers
              </h1>
              <p className="mt-1 text-xs text-l-ink-dim">
                Manage developer environments, tunnel domains, and Doppler
                configs
              </p>
            </div>
            <Button variant="primary">Add Developer</Button>
          </div>

          <NewEnvironmentPanel title="New Developer">
            <div className="space-y-s-4">
              <div className="grid grid-cols-1 gap-s-4 md:grid-cols-3">
                <div>
                  <FormField label="Name" htmlFor="developer-name">
                    <Input
                      id="developer-name"
                      placeholder="ernesto"
                      className="font-mono text-xs"
                    />
                  </FormField>
                  <p className="mt-1 text-[10px] text-l-ink-dim">
                    Used for Doppler configs and Makefile
                  </p>
                </div>
                <FormField label="Email" htmlFor="developer-email">
                  <Input
                    id="developer-email"
                    placeholder="ernesto@chronicle-labs.com"
                    className="font-mono text-xs"
                  />
                </FormField>
                <FormField label="Tunnel Domain" htmlFor="developer-domain">
                  <Input
                    id="developer-domain"
                    placeholder="ernesto.chronicle-labs.com"
                    className="font-mono text-xs"
                  />
                </FormField>
              </div>
              <div className="flex items-center gap-s-3 border-t border-l-border-faint pt-s-3">
                <Button size="sm" variant="primary">
                  Create Developer
                </Button>
                <p className="text-[10px] text-l-ink-dim">
                  Creates Doppler branch configs{" "}
                  <span className="font-mono text-l-ink-lo">
                    dev_frontend_ernesto
                  </span>{" "}
                  and{" "}
                  <span className="font-mono text-l-ink-lo">
                    dev_backend_ernesto
                  </span>
                </p>
              </div>
            </div>
          </NewEnvironmentPanel>

          <NewEnvironmentPanel
            title="Registered Developers"
            action={
              <span className="font-mono text-[10px] text-l-ink-dim">
                {mockDevelopers.length} developers
              </span>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-l-border-faint">
                    <th className="py-s-2 pr-s-4 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
                      Name
                    </th>
                    <th className="py-s-2 pr-s-4 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
                      Email
                    </th>
                    <th className="py-s-2 pr-s-4 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
                      Tunnel Domain
                    </th>
                    <th className="py-s-2 pr-s-4 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
                      Doppler Configs
                    </th>
                    <th className="py-s-2 pr-s-4 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
                      Command
                    </th>
                    <th className="py-s-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-l-ink-dim">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mockDevelopers.map((dev) => (
                    <tr
                      key={dev.id}
                      className="border-b border-l-border-faint last:border-0"
                    >
                      <td className="py-s-3 pr-s-4 font-mono font-medium text-event-teal">
                        {dev.name}
                      </td>
                      <td className="py-s-3 pr-s-4 font-mono text-l-ink-lo">
                        {dev.email ?? "-"}
                      </td>
                      <td className="py-s-3 pr-s-4 font-mono text-l-ink">
                        {dev.tunnelDomain}
                      </td>
                      <td className="py-s-3 pr-s-4">
                        <div className="space-y-[3px]">
                          <ProductChip tone="data">
                            dev_frontend_{dev.dopplerSuffix}
                          </ProductChip>
                          <span className="ml-[4px]">
                            <ProductChip>
                              dev_backend_{dev.dopplerSuffix}
                            </ProductChip>
                          </span>
                        </div>
                      </td>
                      <td className="py-s-3 pr-s-4">
                        <code className="rounded-md bg-l-surface px-[6px] py-[2px] font-mono text-[10px] text-l-ink-lo">
                          make dev-all DEV_USER={dev.name}
                        </code>
                      </td>
                      <td className="py-s-3 text-right">
                        <Button size="sm" variant="critical">
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </NewEnvironmentPanel>

          <NewEnvironmentPanel title="Quick Start">
            <div className="space-y-s-2 text-xs text-l-ink-lo">
              <p className="font-medium text-l-ink">For each developer:</p>
              <ol className="list-inside list-decimal space-y-[6px]">
                <li>Add them above with their ngrok tunnel domain</li>
                <li>Reserve the domain in ngrok dashboard</li>
                <li>
                  Add Google OAuth redirect URI:{" "}
                  <code className="rounded-md bg-l-surface px-[4px] py-[2px] font-mono text-[10px]">
                    https://DOMAIN/api/auth/callback/google
                  </code>
                </li>
                <li>
                  Run:{" "}
                  <code className="rounded-md bg-l-surface px-[4px] py-[2px] font-mono text-[10px]">
                    make dev-all DEV_USER=name
                  </code>
                </li>
              </ol>
            </div>
          </NewEnvironmentPanel>
        </div>
      </main>
    </div>
  );
}

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
    <NewEnvironmentPanel
      title={title}
      action={
        <span className="font-mono text-[10px] text-l-ink-dim">{count}</span>
      }
    >
      {children}
    </NewEnvironmentPanel>
  );
}

function EmailActionModal({
  action,
  onClose,
}: {
  action: EmailAction;
  onClose: () => void;
}) {
  if (!action) return null;

  if (action.kind === "register") {
    return (
      <Modal
        isOpen
        onClose={onClose}
        title="Register Email Template Key"
        actions={
          <>
            <Button size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" variant="primary">
              Register Key
            </Button>
          </>
        }
      >
        <div className="space-y-s-4">
          <FormField label="Key (slug)" htmlFor="template-key">
            <Input
              id="template-key"
              placeholder="team-invite"
              className="font-mono text-xs"
            />
          </FormField>
          <FormField label="Display Name" htmlFor="template-name">
            <Input id="template-name" placeholder="Team Invitation" />
          </FormField>
          <FormField label="Description" htmlFor="template-description">
            <Input
              id="template-description"
              placeholder="Sent when an admin invites a new team member"
            />
          </FormField>
          <FormField label="Category" htmlFor="template-category">
            <NativeSelect id="template-category">
              <option value="transactional">Transactional</option>
              <option value="auth">Auth</option>
              <option value="notification">Notification</option>
            </NativeSelect>
          </FormField>
          <FormField label="Variables (JSON)" htmlFor="template-variables">
            <Textarea
              id="template-variables"
              className="h-32 font-mono text-xs"
              defaultValue={`[
  { "key": "ORG_NAME", "type": "string", "sampleValue": "Acme Corp" }
]`}
            />
          </FormField>
        </div>
      </Modal>
    );
  }

  if (action.kind === "preview") {
    const resend = action.resendTemplate;
    return (
      <Modal
        isOpen
        onClose={onClose}
        title={resend?.name ?? action.template.name}
        className="max-w-3xl"
        actions={
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        }
      >
        <div className="overflow-hidden rounded-md border border-hairline-strong bg-white text-[#1a140a]">
          <div className="border-b border-black/10 px-s-6 py-s-5">
            <div className="text-xs uppercase tracking-[0.12em] text-black/45">
              Chronicle Labs
            </div>
            <h2 className="mt-s-2 text-2xl font-semibold">
              {action.template.name}
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
      </Modal>
    );
  }

  if (action.kind === "send") {
    return (
      <Modal
        isOpen
        onClose={onClose}
        title="Send Test Email"
        actions={
          <>
            <Button size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={action.resendTemplate?.status !== "published"}
            >
              Send Test
            </Button>
          </>
        }
      >
        <div className="space-y-s-4">
          <div className="flex items-center gap-s-2 rounded-md border border-hairline-strong bg-l-surface px-s-3 py-s-2">
            <ProductChip
              tone={
                action.resendTemplate?.status === "published"
                  ? "nominal"
                  : "caution"
              }
            >
              {action.resendTemplate?.status ?? "missing"}
            </ProductChip>
            <span className="text-sm font-medium text-l-ink">
              {action.template.name}
            </span>
            <span className="font-mono text-[10px] text-l-ink-dim">
              {action.resendTemplate?.alias ?? action.template.key}
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
              {action.template.variables.map((variable) => (
                <div
                  key={String(variable)}
                  className="flex items-center gap-s-2"
                >
                  <span className="w-32 shrink-0 text-right font-mono text-[10px] text-event-teal">
                    {variable}
                  </span>
                  <Input
                    defaultValue={
                      variable === "ORG_NAME"
                        ? "Acme Corp"
                        : variable === "INVITER_NAME"
                          ? "Ayman"
                          : ""
                    }
                    className="flex-1 font-mono text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Delete Template Key"
      variant="danger"
      actions={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="critical">
            Delete
          </Button>
        </>
      }
    >
      <p>
        Delete template key{" "}
        <span className="font-mono text-l-ink">{action.template.key}</span>?
        This will fail if there are active assignments.
      </p>
    </Modal>
  );
}

function EmailTemplatesSurface() {
  const [action, setAction] = React.useState<EmailAction>(null);
  return (
    <div className="grid min-h-screen grid-cols-[256px_1fr] bg-l-surface">
      <EnvSidebar active="email" />
      <main className="px-s-6 py-s-6">
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
            <div className="flex gap-s-2">
              <Button
                variant="primary"
                onClick={() => setAction({ kind: "register" })}
              >
                Register Key
              </Button>
            </div>
          </div>

          <TemplateTableShell
            title="Template Registry"
            count={mockTemplateKeys.length}
          >
            <div className="space-y-s-3">
              {mockTemplateKeys.map((template) => (
                <EmailTemplateRegistryCard
                  key={template.id}
                  template={template}
                  assignmentTargets={assignmentTargetsFor(template)}
                  resendTemplate={
                    mockResendTemplates.find(
                      (resend) => resend.alias === template.key
                    ) ?? null
                  }
                  onPreview={() =>
                    setAction({
                      kind: "preview",
                      template,
                      resendTemplate: mockResendTemplates.find(
                        (resend) => resend.alias === template.key
                      ),
                    })
                  }
                  onSendTest={() =>
                    setAction({
                      kind: "send",
                      template,
                      resendTemplate: mockResendTemplates.find(
                        (resend) => resend.alias === template.key
                      ),
                    })
                  }
                  onDelete={() => setAction({ kind: "delete", template })}
                />
              ))}
            </div>
          </TemplateTableShell>
        </div>
      </main>
      <EmailActionModal action={action} onClose={() => setAction(null)} />
    </div>
  );
}

function DashboardSurface() {
  const permanentEnvs = mockEnvironments.filter(
    (env) => env.type !== "ephemeral"
  );
  const ephemeralEnvs = mockEnvironments.filter(
    (env) => env.type === "ephemeral"
  );

  return (
    <div className="grid min-h-screen grid-cols-[256px_1fr] bg-l-surface">
      <EnvSidebar />
      <main className="px-s-6 py-s-6">
        <div className="mx-auto max-w-6xl space-y-s-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-sans text-xl font-semibold text-l-ink">
                Environments
              </h1>
              <p className="mt-1 text-xs text-l-ink-dim">
                Monitor and manage all platform environments
              </p>
            </div>
            <Button variant="primary">New Environment</Button>
          </div>

          <EnvironmentSection
            title="Permanent Environments"
            environments={permanentEnvs}
          />
          <EnvironmentSection
            title="Ephemeral Environments"
            environments={ephemeralEnvs}
            empty={
              <div className="rounded-md border border-dashed border-hairline-strong bg-l-surface-raised">
                <div className="px-s-5 py-s-8 text-center">
                  <p className="mb-s-3 text-sm text-l-ink-lo">
                    No ephemeral environments running
                  </p>
                  <Button size="sm">Spin one up from a branch</Button>
                </div>
              </div>
            }
          />
        </div>
      </main>
    </div>
  );
}

function DetailSurface() {
  return (
    <div className="grid min-h-screen grid-cols-[256px_1fr] bg-surface-00">
      <EnvSidebar />
      <main className="max-w-[1280px] px-s-10 py-s-8">
        <div className="grid grid-cols-1 gap-s-4 lg:grid-cols-2">
          <ProvisioningTimeline title="Provisioning..." meta="4/8 steps">
            <ProvisioningTimeline.Step
              status="done"
              label="Fetch Branch Info"
              time="1.2s"
            />
            <ProvisioningTimeline.Step
              status="done"
              label="Create Fly App"
              description="chronicle-pr-1276"
              time="4.1s"
            />
            <ProvisioningTimeline.Step
              status="active"
              label="Configure Vercel"
              description="frontend env convergence"
              time="running..."
              isLast
            />
          </ProvisioningTimeline>
          <div className="overflow-hidden rounded-md border border-hairline bg-surface-01">
            <LogStream>
              <LogStream.Line time="12:04:11" level="info">
                fetching branch info for <em>feature/invite-flow</em>
              </LogStream.Line>
              <LogStream.Line time="12:04:14" level="ok">
                branch sha resolved <em>8f3a91c</em>
              </LogStream.Line>
              <LogStream.Line time="12:04:20" level="warn">
                waiting for Vercel propagation
              </LogStream.Line>
            </LogStream>
          </div>
        </div>
      </main>
    </div>
  );
}

export const Dashboard: Story = {
  render: () => <DashboardSurface />,
};

export const NewEnvironment: Story = {
  render: () => <NewEnvironmentSurface />,
};

export const Developers: Story = {
  render: () => <DevelopersSurface />,
};

export const EmailTemplates: Story = {
  render: () => <EmailTemplatesSurface />,
};

export const Detail: Story = {
  render: () => <DetailSurface />,
};
