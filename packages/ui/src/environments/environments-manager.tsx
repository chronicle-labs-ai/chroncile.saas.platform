"use client";

import * as React from "react";
import {
  Activity,
  ArrowLeft,
  Boxes,
  Building2,
  ChevronRight,
  CirclePlus,
  Cpu,
  Database,
  Folder,
  HardDrive,
  Layers,
  LayoutGrid,
  List,
  MemoryStick,
  Play,
  Plug,
  Plus,
  Server,
  Square,
  Terminal,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

import { cx } from "../utils/cx";
import { useReducedMotion } from "../utils/use-reduced-motion";
import { Button } from "../primitives/button";
import { CompanyLogo } from "../icons";
import { StatusDot } from "../primitives/status-dot";
import { Switch } from "../primitives/switch";
import { useSetSiteBreadcrumb } from "../layout/site-breadcrumb";
import { RelativeTime, formatNumber } from "../connections/time";
import { DatasetTraceDetailDrawer } from "../datasets/dataset-trace-detail-drawer";
import { SourceLogoStack } from "../datasets/source-logo-stack";
import type { DatasetSnapshot, TraceSummary } from "../datasets/types";
import { sourceColor } from "../stream-timeline/source-color";

import { environmentsSeed } from "./data";
import type {
  EnvironmentActivity,
  EnvironmentActivityKind,
  EnvironmentLens,
  EnvironmentResources,
  EnvironmentStatus,
  EnvironmentTool,
  EnvironmentToolKind,
  EnvironmentToolMode,
  EnvironmentToolStatus,
  EnvironmentToolTemplate,
  EnvironmentTraceSeed,
  EnvironmentView,
  SandboxEnvironment,
  SandboxExecutor,
  SandboxLifecycleAction,
  SandboxLiveStats,
  SandboxRuntimeStatus,
  SandboxStatsFetcher,
} from "./types";
import { AddToolPicker } from "./add-tool-picker";

export interface EnvironmentsManagerProps {
  environments?: readonly SandboxEnvironment[];
  initialView?: EnvironmentView;
  onChange?: (next: readonly SandboxEnvironment[]) => void;
  /**
   * When provided, the Terminal lens runs commands against this executor
   * (e.g. a server-side Daytona sandbox proxy) instead of the local mock
   * shell. Resolved output is appended to the terminal as info lines and
   * non-zero exit codes are surfaced as warn lines.
   */
  onExecute?: SandboxExecutor;
  /**
   * When provided, the Activity lens polls this fetcher every few seconds
   * for real CPU / memory / disk numbers from the running sandbox. The
   * detail header also shows the live runtime status returned alongside.
   */
  onFetchStats?: SandboxStatsFetcher;
  /** Starts a stopped sandbox (called from the detail header power button). */
  onStartSandbox?: SandboxLifecycleAction;
  /** Stops a running sandbox (called from the detail header power button). */
  onStopSandbox?: SandboxLifecycleAction;
  className?: string;
}

const ENV_STATUS_META: Record<
  EnvironmentStatus,
  {
    label: string;
    dot: React.ComponentProps<typeof StatusDot>["variant"];
    className: string;
  }
> = {
  ready: {
    label: "Ready",
    dot: "green",
    className: "bg-event-green/10 text-event-green",
  },
  seeding: {
    label: "Seeding",
    dot: "teal",
    className: "bg-event-teal/10 text-event-teal",
  },
  running: {
    label: "Running",
    dot: "violet",
    className: "bg-event-violet/10 text-event-violet",
  },
  degraded: {
    label: "Degraded",
    dot: "amber",
    className: "bg-event-amber/10 text-event-amber",
  },
  "needs-reset": {
    label: "Needs reset",
    dot: "red",
    className: "bg-event-red/10 text-event-red",
  },
};

const TOOL_STATUS_META: Record<
  EnvironmentToolStatus,
  {
    label: string;
    dot: React.ComponentProps<typeof StatusDot>["variant"];
    className: string;
  }
> = {
  available: {
    label: "Available",
    dot: "green",
    className: "text-event-green",
  },
  faulted: {
    label: "Faulted",
    dot: "red",
    className: "text-event-red",
  },
  disabled: {
    label: "Disabled",
    dot: "offline",
    className: "text-l-ink-dim",
  },
  warming: {
    label: "Warming",
    dot: "amber",
    className: "text-event-amber",
  },
};

const LENSES: readonly {
  value: EnvironmentLens;
  label: string;
  Icon: LucideIcon;
}[] = [
  { value: "overview", label: "Overview", Icon: Building2 },
  { value: "tools", label: "Tools", Icon: Wrench },
  { value: "data", label: "Data", Icon: Database },
  { value: "activity", label: "Activity", Icon: Activity },
  { value: "terminal", label: "Terminal", Icon: Terminal },
];

const TOOL_ICONS: Record<EnvironmentToolKind, LucideIcon> = {
  mcp: Server,
  cli: Terminal,
  api: Plug,
  database: Database,
  filesystem: Folder,
};

export function EnvironmentsManager({
  environments: initialEnvironments = environmentsSeed,
  initialView = "list",
  onChange,
  onExecute,
  onFetchStats,
  onStartSandbox,
  onStopSandbox,
  className,
}: EnvironmentsManagerProps) {
  const [list, setList] = React.useState<SandboxEnvironment[]>(() => [
    ...initialEnvironments,
  ]);
  const [view, setView] = React.useState<EnvironmentView>(initialView);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const selectedEnvironment = React.useMemo(
    () =>
      selectedId ? (list.find((env) => env.id === selectedId) ?? null) : null,
    [list, selectedId]
  );

  useSetSiteBreadcrumb(
    selectedEnvironment
      ? [{ label: "Environments" }, { label: selectedEnvironment.name }]
      : [{ label: "Environments" }]
  );

  const propagate = React.useCallback(
    (next: SandboxEnvironment[]) => {
      setList(next);
      onChange?.(next);
    },
    [onChange]
  );

  const updateEnvironment = React.useCallback(
    (
      id: string,
      updater: (environment: SandboxEnvironment) => SandboxEnvironment
    ) => {
      propagate(list.map((env) => (env.id === id ? updater(env) : env)));
    },
    [list, propagate]
  );

  const summary = React.useMemo(() => buildSummary(list), [list]);

  const createEnvironment = React.useCallback(() => {
    const now = new Date().toISOString();
    const template = list[0] ?? environmentsSeed[0]!;
    const created: SandboxEnvironment = {
      ...template,
      id: `env_${Date.now().toString(36)}`,
      name: "New Sandbox Company",
      company: "Sandbox Co",
      description:
        "Draft environment ready for tool runtime, data snapshot, and scenario seeds.",
      owner: "you",
      status: "ready",
      updatedAt: now,
      eventsPerMin: 0,
      activeAgents: 0,
      currentSnapshot: {
        ...template.currentSnapshot,
        id: `snap_${Date.now().toString(36)}`,
        name: "Empty company snapshot",
        sourceDataset: "unseeded",
        seededAt: now,
        scenarios: 0,
        entities: 0,
        records: 0,
        files: 0,
        traces: 0,
      },
      failures: template.failures.map((failure) => ({
        ...failure,
        active: false,
      })),
      tools: template.tools.map((tool) => ({
        ...tool,
        status: tool.enabled ? "available" : "disabled",
      })),
      activity: [
        {
          id: `act_${Date.now().toString(36)}`,
          kind: "seed",
          title: "Created sandbox company",
          detail: "Add tool runtime and seed data before running agents.",
          at: now,
          actor: "you",
        },
      ],
      tags: ["draft"],
    };
    propagate([created, ...list]);
    setSelectedId(created.id);
  }, [list, propagate]);

  const toggleTool = React.useCallback(
    (id: string, toolId: string, enabled: boolean) => {
      updateEnvironment(id, (env) => ({
        ...env,
        updatedAt: new Date().toISOString(),
        status: env.status === "needs-reset" ? env.status : "ready",
        tools: env.tools.map((tool) =>
          tool.id === toolId
            ? {
                ...tool,
                enabled,
                status: enabled ? "available" : "disabled",
                latencyMs: enabled ? Math.max(tool.latencyMs, 12) : 0,
              }
            : tool
        ),
        activity: [
          makeActivity(
            "tool",
            `${enabled ? "Enabled" : "Disabled"} ${toolId}`,
            enabled
              ? "Tool runtime is available to agents in this sandbox."
              : "Tool runtime is hidden from agent execution."
          ),
          ...env.activity,
        ],
      }));
    },
    [updateEnvironment]
  );

  const addTool = React.useCallback(
    (id: string, template: EnvironmentToolTemplate): string => {
      const slug = `${template.id}_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 5)}`;
      let createdName = template.name;
      updateEnvironment(id, (env) => {
        const taken = new Set(env.tools.map((tool) => tool.name));
        let candidate = template.name;
        let suffix = 2;
        while (taken.has(candidate)) {
          candidate = `${template.name}-${suffix}`;
          suffix += 1;
        }
        createdName = candidate;
        const tool: EnvironmentTool = {
          id: slug,
          name: candidate,
          source: template.source,
          kind: template.kind,
          mode: template.mode,
          status: "available",
          latencyMs: 18,
          enabled: true,
          capabilities: template.capabilities,
          description: template.description,
        };
        return {
          ...env,
          updatedAt: new Date().toISOString(),
          tools: [...env.tools, tool],
          activity: [
            makeActivity(
              "tool",
              `Attached ${candidate}`,
              `${template.description}`
            ),
            ...env.activity,
          ],
        };
      });
      return slug;
    },
    [updateEnvironment]
  );

  const runAgent = React.useCallback(
    (id: string) => {
      updateEnvironment(id, (env) => ({
        ...env,
        status: "running",
        updatedAt: new Date().toISOString(),
        activeAgents: env.activeAgents + 1,
        eventsPerMin: env.eventsPerMin + 8,
        activity: [
          makeActivity(
            "agent",
            "Started agent run",
            "Agent placed inside the sandbox with seeded tools, identities, data, and failure state."
          ),
          ...env.activity,
        ],
      }));
    },
    [updateEnvironment]
  );

  return (
    <div
      className={cx(
        "flex h-full min-h-0 flex-col bg-l-surface text-l-ink",
        selectedEnvironment
          ? "gap-0 p-0"
          : "min-h-[calc(100svh-var(--header-height,3.5rem)-2rem)] gap-4 p-4",
        className
      )}
    >
      {selectedEnvironment ? (
        <EnvironmentDetailPage
          environment={selectedEnvironment}
          onBack={() => setSelectedId(null)}
          onToggleTool={toggleTool}
          onAddTool={addTool}
          onExecute={onExecute}
          onFetchStats={onFetchStats}
          onStartSandbox={onStartSandbox}
          onStopSandbox={onStopSandbox}
        />
      ) : (
        <>
          <EnvironmentsHeader
            count={list.length}
            summary={summary}
            onCreate={createEnvironment}
          />
          <EnvironmentsToolbar view={view} onViewChange={setView} />

          {view === "list" ? (
            <div className="min-h-0 flex-1 overflow-hidden rounded-[6px] border border-hairline-strong bg-l-surface-raised">
              <div className="grid h-8 grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_96px_88px_92px] items-center gap-3 border-b border-l-border-faint px-3 font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
                <span />
                <span>Environment</span>
                <span>Seed</span>
                <span>Runtime</span>
                <span className="text-right">Scenarios</span>
                <span className="text-right">Agents</span>
                <span>Status</span>
              </div>
              <div className="chron-scrollbar-hidden h-full overflow-auto">
                {list.map((environment) => (
                  <EnvironmentRow
                    key={environment.id}
                    environment={environment}
                    onOpen={setSelectedId}
                    onRunAgent={runAgent}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="chron-scrollbar-hidden min-h-0 flex-1 overflow-auto">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((environment) => (
                  <EnvironmentCard
                    key={environment.id}
                    environment={environment}
                    onOpen={setSelectedId}
                    onRunAgent={runAgent}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function makeActivity(
  kind: EnvironmentActivityKind,
  title: string,
  detail: string
): EnvironmentActivity {
  return {
    id: `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    kind,
    title,
    detail,
    at: new Date().toISOString(),
    actor: "you",
  };
}

function buildSummary(environments: readonly SandboxEnvironment[]) {
  return environments.reduce(
    (acc, env) => ({
      ready: acc.ready + (env.status === "ready" ? 1 : 0),
      attention:
        acc.attention +
        (env.status === "degraded" || env.status === "needs-reset" ? 1 : 0),
      tools: acc.tools + env.tools.filter((tool) => tool.enabled).length,
      scenarios: acc.scenarios + env.currentSnapshot.scenarios,
      agents: acc.agents + env.activeAgents,
    }),
    { ready: 0, attention: 0, tools: 0, scenarios: 0, agents: 0 }
  );
}

function EnvironmentsHeader({
  count,
  summary,
  onCreate,
}: {
  count: number;
  summary: ReturnType<typeof buildSummary>;
  onCreate: () => void;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-l-border-faint pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="font-display text-[34px] font-normal leading-none tracking-[-0.04em] text-l-ink-hi md:text-[44px]">
          Your agent{" "}
          <em className="font-normal italic text-ember">sandboxes.</em>
        </h1>
        <p className="mt-2 max-w-2xl text-[12.5px] leading-5 text-l-ink-dim">
          Spin up sandbox companies with seeded data, MCP servers, CLIs,
          identities, scenarios, and failure states.{" "}
          {count > 0
            ? `${count} ${count === 1 ? "environment" : "environments"} (${summary.ready} ready) running ${formatNumber(summary.tools)} tool runtimes across ${formatNumber(summary.scenarios)} scenarios.`
            : "Create your first sandbox to give agents a safe, isolated place to operate."}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          onPress={onCreate}
          leadingIcon={<CirclePlus className="size-3.5" strokeWidth={1.75} />}
        >
          New environment
        </Button>
      </div>
    </header>
  );
}

function EnvironmentsToolbar({
  view,
  onViewChange,
}: {
  view: EnvironmentView;
  onViewChange: (next: EnvironmentView) => void;
}) {
  return (
    <div className="flex items-center justify-end">
      <div className="inline-flex overflow-hidden rounded-[2px] border border-hairline-strong">
        <button
          type="button"
          aria-label="List view"
          aria-pressed={view === "list"}
          data-active={view === "list" || undefined}
          onClick={() => onViewChange("list")}
          className="flex h-7 w-7 items-center justify-center text-l-ink-dim hover:bg-l-surface-hover data-[active=true]:bg-l-wash-3 data-[active=true]:text-l-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
        >
          <List className="size-3.5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label="Grid view"
          aria-pressed={view === "grid"}
          data-active={view === "grid" || undefined}
          onClick={() => onViewChange("grid")}
          className="flex h-7 w-7 items-center justify-center border-l border-hairline-strong text-l-ink-dim hover:bg-l-surface-hover data-[active=true]:bg-l-wash-3 data-[active=true]:text-l-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
        >
          <LayoutGrid className="size-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

function EnvironmentRow({
  environment,
  onOpen,
  onRunAgent,
}: {
  environment: SandboxEnvironment;
  onOpen: (id: string) => void;
  onRunAgent: (id: string) => void;
}) {
  const status = ENV_STATUS_META[environment.status];
  const activeFailures = environment.failures.filter(
    (failure) => failure.active
  );
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(environment.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(environment.id);
        }
      }}
      className="group grid h-[58px] cursor-pointer grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_96px_88px_92px] items-center gap-3 border-b border-l-border-faint px-3 text-[12.5px] last:border-b-0 hover:bg-l-surface-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
    >
      <span className="flex size-7 items-center justify-center rounded-[5px] bg-l-wash-3 text-l-ink-lo">
        <Building2 className="size-4" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="truncate font-medium text-l-ink">
          {environment.name}
        </div>
        <div className="truncate text-[11px] text-l-ink-dim">
          {environment.company} - {environment.description}
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate font-medium text-l-ink">
          {environment.currentSnapshot.name}
        </div>
        <div className="truncate font-mono text-[11px] text-l-ink-dim">
          <RelativeTime
            iso={environment.currentSnapshot.seededAt}
            fallback="-"
          />
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <SourceLogoStack
          sources={environment.tools.map((tool) => tool.source)}
        />
        <span className="truncate font-mono text-[11px] text-l-ink-dim">
          {environment.tools.filter((tool) => tool.enabled).length} tools
          {activeFailures.length > 0 ? ` - ${activeFailures.length} fault` : ""}
        </span>
      </div>
      <span className="text-right font-mono text-[11px] tabular-nums text-l-ink-lo">
        {formatNumber(environment.currentSnapshot.scenarios)}
      </span>
      <span className="text-right font-mono text-[11px] tabular-nums text-l-ink-lo">
        {formatNumber(environment.activeAgents)}
      </span>
      <div className="flex items-center justify-between gap-2">
        <StatusPill status={environment.status} />
        <button
          type="button"
          aria-label={`Run agent in ${environment.name}`}
          title="Run agent"
          onClick={(event) => {
            event.stopPropagation();
            onRunAgent(environment.id);
          }}
          className="flex size-7 items-center justify-center rounded-md text-l-ink-dim opacity-0 hover:bg-l-wash-3 hover:text-l-ink group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
        >
          <Play className="size-3.5" strokeWidth={1.75} />
        </button>
      </div>
      <span className="sr-only">{status.label}</span>
    </div>
  );
}

function EnvironmentCard({
  environment,
  onOpen,
  onRunAgent,
}: {
  environment: SandboxEnvironment;
  onOpen: (id: string) => void;
  onRunAgent: (id: string) => void;
}) {
  const activeFailures = environment.failures.filter(
    (failure) => failure.active
  );
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(environment.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(environment.id);
        }
      }}
      className="group flex min-h-[238px] cursor-pointer flex-col gap-3 rounded-[6px] border border-hairline-strong bg-l-surface-raised p-3.5 hover:bg-l-surface-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[5px] bg-l-wash-3 text-l-ink-lo">
          <Building2 className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-sans text-[14px] font-medium text-l-ink">
            {environment.name}
          </div>
          <div className="truncate font-mono text-[11px] text-l-ink-dim">
            {environment.company} - {environment.owner}
          </div>
        </div>
        <StatusPill status={environment.status} />
      </div>

      <p className="line-clamp-2 text-[12.5px] leading-snug text-l-ink-lo">
        {environment.description}
      </p>

      <div className="grid grid-cols-3 gap-1.5">
        <MiniStat
          label="Scenarios"
          value={environment.currentSnapshot.scenarios}
        />
        <MiniStat
          label="Tools"
          value={environment.tools.filter((tool) => tool.enabled).length}
        />
        <MiniStat label="Agents" value={environment.activeAgents} />
      </div>

      <div className="flex min-h-[40px] items-center gap-2 rounded-[5px] border border-l-border-faint bg-l-wash-1 px-2">
        <SourceLogoStack
          sources={environment.tools.map((tool) => tool.source)}
        />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-l-ink-dim">
          {environment.tools.map((tool) => tool.name).join(", ")}
        </span>
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-l-border-faint pt-2">
        {activeFailures.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-event-amber">
            <StatusDot variant="amber" pulse />
            {activeFailures.length} active fault
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-event-green">
            <StatusDot variant="green" pulse />
            live sandbox
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          leadingIcon={<Play className="size-3.5" strokeWidth={1.75} />}
          onClick={(event) => {
            event.stopPropagation();
            onRunAgent(environment.id);
          }}
        >
          Run
        </Button>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-[2px] rounded-[5px] border border-l-border-faint bg-l-wash-1 px-2 py-1.5">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-l-ink-dim">
        {label}
      </span>
      <span className="font-sans text-[15px] font-medium tabular-nums text-l-ink">
        {formatNumber(value)}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: EnvironmentStatus }) {
  const meta = ENV_STATUS_META[status];
  return (
    <span
      className={cx(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2 font-mono text-[10.5px] uppercase tracking-[0.06em]",
        meta.className
      )}
    >
      <StatusDot variant={meta.dot} pulse={status === "running"} />
      {meta.label}
    </span>
  );
}

function EnvironmentDetailPage({
  environment,
  onBack,
  onToggleTool,
  onAddTool,
  onExecute,
  onFetchStats,
  onStartSandbox,
  onStopSandbox,
}: {
  environment: SandboxEnvironment;
  onBack: () => void;
  onToggleTool: (id: string, toolId: string, enabled: boolean) => void;
  onAddTool: (id: string, template: EnvironmentToolTemplate) => string;
  onExecute?: SandboxExecutor;
  onFetchStats?: SandboxStatsFetcher;
  onStartSandbox?: SandboxLifecycleAction;
  onStopSandbox?: SandboxLifecycleAction;
}) {
  const runtimeControl = useSandboxRuntime({
    environmentId: environment.id,
    onFetchStats,
    onStartSandbox,
    onStopSandbox,
  });
  const [lens, setLens] = React.useState<EnvironmentLens>("overview");
  const [selectedTraceId, setSelectedTraceId] = React.useState<string | null>(
    null
  );
  const [selectedToolId, setSelectedToolId] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    if (lens !== "data") setSelectedTraceId(null);
    if (lens !== "tools") setSelectedToolId(null);
  }, [lens]);

  const selectedTool = React.useMemo(
    () =>
      selectedToolId
        ? (environment.tools.find((tool) => tool.id === selectedToolId) ?? null)
        : null,
    [environment.tools, selectedToolId]
  );

  const traceDatasetSnapshot = React.useMemo(
    () => buildTraceDatasetSnapshot(environment),
    [environment]
  );
  const selectedTrace = React.useMemo(
    () =>
      selectedTraceId
        ? (traceDatasetSnapshot.traces.find(
            (trace) => trace.traceId === selectedTraceId
          ) ?? null)
        : null,
    [selectedTraceId, traceDatasetSnapshot]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-l-surface-raised">
      <header className="flex min-h-[96px] flex-wrap items-start gap-3 border-b border-l-border-faint bg-l-surface px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to environments"
          className="mt-0.5 flex size-8 items-center justify-center rounded-md text-l-ink-dim hover:bg-l-wash-3 hover:text-l-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-sans text-[20px] font-semibold leading-tight text-l-ink">
            {environment.name}
          </h1>
          <p className="mt-1 max-w-[780px] text-[13px] leading-snug text-l-ink-lo">
            {environment.description}
          </p>
        </div>
        {runtimeControl.enabled ? (
          <SandboxRuntimeControl runtime={runtimeControl} />
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex h-11 shrink-0 items-center gap-1 border-b border-l-border-faint px-3">
            {LENSES.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={lens === value}
                data-active={lens === value || undefined}
                onClick={() => setLens(value)}
                className="inline-flex h-8 items-center gap-1.5 rounded-[5px] px-2.5 text-[12.5px] text-l-ink-lo hover:bg-l-wash-3 hover:text-l-ink data-[active=true]:bg-l-wash-3 data-[active=true]:text-l-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
              >
                <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
                {label}
              </button>
            ))}
          </div>

          <div className="chron-scrollbar-hidden min-h-0 flex-1 overflow-auto p-4">
            {lens === "overview" ? (
              <EnvironmentOverview environment={environment} />
            ) : lens === "tools" ? (
              <ToolsLens
                environment={environment}
                selectedToolId={selectedToolId}
                onSelectTool={setSelectedToolId}
                onAddTool={(template) => {
                  const newId = onAddTool(environment.id, template);
                  setSelectedToolId(newId);
                }}
              />
            ) : lens === "data" ? (
              <DataLens
                environment={environment}
                selectedTraceId={selectedTraceId}
                onSelectTrace={setSelectedTraceId}
              />
            ) : lens === "activity" ? (
              <ActivityLens
                environment={environment}
                runtime={runtimeControl}
              />
            ) : (
              <TerminalLens environment={environment} onExecute={onExecute} />
            )}
          </div>
        </main>

        {lens === "data" && selectedTrace ? (
          <DatasetTraceDetailDrawer
            isOpen={selectedTrace != null}
            onClose={() => setSelectedTraceId(null)}
            snapshot={traceDatasetSnapshot}
            trace={selectedTrace}
            className="hidden xl:block"
          />
        ) : null}

        {lens === "tools" && selectedTool ? (
          <ToolConfigDrawer
            tool={selectedTool}
            onClose={() => setSelectedToolId(null)}
            onToggle={(enabled) =>
              onToggleTool(environment.id, selectedTool.id, enabled)
            }
          />
        ) : null}
      </div>
    </div>
  );
}

function buildTraceDatasetSnapshot(
  environment: SandboxEnvironment
): DatasetSnapshot {
  const snap = environment.currentSnapshot;
  const seededAtMs = Date.parse(snap.seededAt);
  const baseMs = Number.isFinite(seededAtMs) ? seededAtMs : Date.now();

  const traces: TraceSummary[] = snap.traceSeeds.map((seed, idx) => {
    const startedAt = new Date(baseMs - (idx + 1) * 60_000).toISOString();
    return {
      traceId: seed.id,
      label: seed.title,
      primarySource: seed.sources[0] ?? "unknown",
      sources: seed.sources,
      eventCount: seed.events,
      startedAt,
      durationMs: Math.max(2_500, seed.events * 850),
      status: "ok" as const,
      addedAt: snap.seededAt,
      addedBy: environment.owner,
    };
  });

  const totalEvents = traces.reduce(
    (sum, trace) => sum + trace.eventCount,
    0
  );

  return {
    dataset: {
      id: snap.id,
      name: snap.sourceDataset,
      description: snap.name,
      traceCount: snap.traces,
      eventCount: Math.max(totalEvents, snap.traces),
      updatedAt: snap.seededAt,
      createdBy: environment.owner,
    },
    traces,
    clusters: [],
    edges: [],
  };
}

function EnvironmentOverview({
  environment,
}: {
  environment: SandboxEnvironment;
}) {
  return (
    <div className="flex flex-col gap-4">
      <SnapshotImageCard environment={environment} />
      <ResourcesCard resources={environment.resources} />
      <AttachedToolsCard tools={environment.tools} />
    </div>
  );
}

function SnapshotImageCard({
  environment,
}: {
  environment: SandboxEnvironment;
}) {
  const snapshot = environment.currentSnapshot;
  const tag = `chronicle/${snapshot.sourceDataset}:${snapshot.id}`;
  const layers: { label: string; value: number }[] = [
    { label: "scenarios", value: snapshot.scenarios },
    { label: "entities", value: snapshot.entities },
    { label: "records", value: snapshot.records },
    { label: "files", value: snapshot.files },
    { label: "traces", value: snapshot.traces },
  ];
  return (
    <section className="rounded-[6px] border border-l-border-faint bg-l-surface">
      <div className="flex items-start gap-3 border-b border-l-border-faint px-3 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[5px] bg-l-wash-3 text-l-ink">
          <Layers className="size-5" strokeWidth={1.6} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
            Snapshot image
          </div>
          <div className="mt-0.5 truncate font-mono text-[13px] text-l-ink">
            {tag}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10.5px] text-l-ink-dim">
            <span>source: {snapshot.sourceDataset}</span>
            <span aria-hidden>-</span>
            <span>
              seeded{" "}
              <RelativeTime iso={snapshot.seededAt} fallback="-" />
            </span>
          </div>
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
          Layers
        </div>
        <ul className="mt-2 flex flex-col divide-y divide-l-border-faint rounded-[5px] border border-l-border-faint bg-l-wash-1">
          <li className="flex items-baseline justify-between gap-3 px-3 py-1.5 font-mono text-[11.5px]">
            <span className="text-l-ink-dim">FROM</span>
            <span className="truncate text-l-ink">
              dataset/{snapshot.sourceDataset}
            </span>
          </li>
          {layers.map((layer) => (
            <li
              key={layer.label}
              className="flex items-baseline justify-between gap-3 px-3 py-1.5 font-mono text-[11.5px]"
            >
              <span className="text-l-ink-dim">ADD {layer.label}</span>
              <span className="text-l-ink tabular-nums">
                {formatNumber(layer.value)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ResourcesCard({ resources }: { resources: EnvironmentResources }) {
  return (
    <section className="rounded-[6px] border border-l-border-faint bg-l-surface">
      <div className="border-b border-l-border-faint px-3 py-2">
        <h2 className="font-sans text-[14px] font-medium text-l-ink">
          Resources
        </h2>
        <p className="text-[12px] text-l-ink-dim">
          Compute, memory, and disk allocated to this sandbox.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-3">
        <ResourceTile
          icon={Cpu}
          label="vCPU"
          value={`${resources.vCpu}`}
          unit={resources.vCpu === 1 ? "vCPU" : "vCPUs"}
        />
        <ResourceTile
          icon={MemoryStick}
          label="Memory"
          value={`${resources.memoryGib}`}
          unit="GiB"
        />
        <ResourceTile
          icon={HardDrive}
          label="Disk"
          value={`${resources.diskGib}`}
          unit="GiB"
        />
      </div>
    </section>
  );
}

function ResourceTile({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[5px] border border-l-border-faint bg-l-wash-1 p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[5px] bg-l-wash-3 text-l-ink-lo">
        <Icon className="size-4" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
          {label}
        </div>
        <div className="mt-1 font-sans text-[20px] font-medium leading-none text-l-ink">
          <span className="tabular-nums">{value}</span>
          <span className="ml-1 font-mono text-[11px] text-l-ink-dim">
            {unit}
          </span>
        </div>
      </div>
    </div>
  );
}

function AttachedToolsCard({
  tools,
}: {
  tools: readonly EnvironmentTool[];
}) {
  const enabledCount = tools.filter((tool) => tool.enabled).length;
  return (
    <section className="rounded-[6px] border border-l-border-faint bg-l-surface">
      <div className="flex items-center justify-between gap-2 border-b border-l-border-faint px-3 py-2">
        <div>
          <h2 className="font-sans text-[14px] font-medium text-l-ink">
            Tools
          </h2>
          <p className="text-[12px] text-l-ink-dim">
            Tool runtime mounted inside the sandbox boundary.
          </p>
        </div>
        <span className="font-mono text-[10.5px] tabular-nums text-l-ink-dim">
          {enabledCount}/{tools.length} active
        </span>
      </div>
      {tools.length === 0 ? (
        <div className="px-3 py-3 text-[12px] text-l-ink-dim">
          No tools attached.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-l-border-faint">
          {tools.map((tool) => (
            <AttachedToolRow key={tool.id} tool={tool} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AttachedToolRow({ tool }: { tool: EnvironmentTool }) {
  const KindIcon = TOOL_ICONS[tool.kind];
  const status = TOOL_STATUS_META[tool.status];
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-l-wash-3 text-l-ink-lo">
        <CompanyLogo
          name={tool.source}
          size={20}
          radius={4}
          fallbackIcon={KindIcon}
          fallbackBackground="transparent"
          fallbackColor="currentColor"
          aria-hidden
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-sans text-[13px] font-medium text-l-ink">
            {tool.name}
          </span>
          <span className="rounded-full bg-l-wash-3 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.06em] text-l-ink-dim">
            {formatKind(tool.kind)}
          </span>
        </div>
        <div className="mt-0.5 truncate font-mono text-[10.5px] text-l-ink-dim">
          {tool.source} - {formatMode(tool.mode)}
        </div>
      </div>
      <div className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
        <span
          className={cx(
            "inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.06em]",
            status.className
          )}
        >
          <StatusDot variant={status.dot} pulse={tool.status === "faulted"} />
          {status.label}
        </span>
        <span className="font-mono text-[10.5px] tabular-nums text-l-ink-dim">
          {tool.enabled ? `${tool.latencyMs}ms` : "off"}
        </span>
      </div>
    </li>
  );
}

function ToolsLens({
  environment,
  selectedToolId,
  onSelectTool,
  onAddTool,
}: {
  environment: SandboxEnvironment;
  selectedToolId: string | null;
  onSelectTool: (toolId: string | null) => void;
  onAddTool: (template: EnvironmentToolTemplate) => void;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const enabledCount = environment.tools.filter((tool) => tool.enabled).length;

  return (
    <>
      <section className="overflow-hidden rounded-[6px] border border-l-border-faint bg-l-surface">
        <div className="flex items-center justify-between gap-3 border-b border-l-border-faint px-3 py-2">
          <div className="min-w-0">
            <h2 className="font-sans text-[14px] font-medium text-l-ink">
              Tool runtimes
            </h2>
            <p className="text-[12px] text-l-ink-dim">
              Mounted MCP servers, CLIs, databases, and APIs available to
              agents in this sandbox.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-mono text-[10.5px] tabular-nums text-l-ink-dim">
              {enabledCount}/{environment.tools.length} active
            </span>
            <Button
              variant="secondary"
              size="sm"
              onPress={() => setPickerOpen(true)}
              leadingIcon={<Plus className="size-3.5" strokeWidth={1.75} />}
            >
              Add tool
            </Button>
          </div>
        </div>
        <div className="grid h-9 grid-cols-[36px_minmax(0,1.6fr)_72px_minmax(0,1fr)_88px_72px_44px] items-center gap-3 border-b border-l-border-faint px-3 font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
          <span aria-hidden />
          <span>Tool</span>
          <span>Kind</span>
          <span>Mode</span>
          <span>Status</span>
          <span className="text-right">Latency</span>
          <span className="text-right">
            <span className="sr-only">Enabled</span>
            on
          </span>
        </div>
        {environment.tools.length === 0 ? (
          <div className="flex flex-col items-start gap-2 px-3 py-4">
            <p className="text-[12px] text-l-ink-dim">
              No tool runtimes are mounted in this sandbox yet.
            </p>
            <Button
              variant="primary"
              size="sm"
              onPress={() => setPickerOpen(true)}
              leadingIcon={<Plus className="size-3.5" strokeWidth={1.75} />}
            >
              Attach your first tool
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-l-border-faint">
            {environment.tools.map((tool) => (
              <ToolRow
                key={tool.id}
                tool={tool}
                selected={tool.id === selectedToolId}
                onSelect={() =>
                  onSelectTool(tool.id === selectedToolId ? null : tool.id)
                }
              />
            ))}
          </ul>
        )}
      </section>
      <AddToolPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        attachedTools={environment.tools}
        onPick={(template) => onAddTool(template)}
      />
    </>
  );
}

function ToolRow({
  tool,
  selected,
  onSelect,
}: {
  tool: EnvironmentTool;
  selected: boolean;
  onSelect: () => void;
}) {
  const KindIcon = TOOL_ICONS[tool.kind];
  const status = TOOL_STATUS_META[tool.status];
  return (
    <li
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Configure ${tool.name}`}
      aria-current={selected ? "true" : undefined}
      data-active={selected || undefined}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className="grid h-11 cursor-pointer grid-cols-[36px_minmax(0,1.6fr)_72px_minmax(0,1fr)_88px_72px_44px] items-center gap-3 px-3 transition-colors duration-fast ease-out hover:bg-l-wash-3 data-[active=true]:bg-l-surface-selected focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
    >
      <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-l-wash-3 text-l-ink-lo">
        <CompanyLogo
          name={tool.source}
          size={18}
          radius={3}
          fallbackIcon={KindIcon}
          fallbackBackground="transparent"
          fallbackColor="currentColor"
          aria-hidden
        />
      </span>
      <div className="min-w-0">
        <div className="truncate font-sans text-[13px] font-medium text-l-ink">
          {tool.name}
        </div>
        <div className="truncate font-mono text-[10.5px] text-l-ink-dim">
          {tool.source}
        </div>
      </div>
      <span className="truncate font-mono text-[10.5px] uppercase tracking-[0.06em] text-l-ink-dim">
        {formatKind(tool.kind)}
      </span>
      <span className="truncate font-mono text-[11px] text-l-ink-lo">
        {formatMode(tool.mode)}
      </span>
      <span
        className={cx(
          "inline-flex items-center gap-1.5 truncate font-mono text-[10.5px] uppercase tracking-[0.06em]",
          status.className
        )}
      >
        <StatusDot variant={status.dot} pulse={tool.status === "faulted"} />
        {status.label}
      </span>
      <span className="text-right font-mono text-[11px] tabular-nums text-l-ink-lo">
        {tool.enabled ? `${tool.latencyMs}ms` : "off"}
      </span>
      <span className="flex justify-end" aria-hidden>
        <span
          className={cx(
            "h-1.5 w-6 rounded-full",
            tool.enabled ? "bg-event-green/70" : "bg-l-wash-5"
          )}
        />
      </span>
    </li>
  );
}

function ToolConfigDrawer({
  tool,
  onClose,
  onToggle,
}: {
  tool: EnvironmentTool;
  onClose: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  const KindIcon = TOOL_ICONS[tool.kind];
  const status = TOOL_STATUS_META[tool.status];
  const titleId = React.useId();

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Don't steal Escape from inputs, dialogs, etc. — only close when
      // focus is outside any text-entry widget so users can keep typing.
      const target = event.target as HTMLElement | null;
      if (target && target.closest("input, textarea, [contenteditable=true]")) {
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <aside
      role="complementary"
      aria-labelledby={titleId}
      className="hidden w-[380px] shrink-0 flex-col overflow-hidden border-l border-l-border-faint bg-l-surface xl:flex"
    >
      <header className="flex shrink-0 items-start gap-3 border-b border-l-border-faint px-4 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-l-wash-3 text-l-ink-lo">
          <CompanyLogo
            name={tool.source}
            size={24}
            radius={5}
            fallbackIcon={KindIcon}
            fallbackBackground="transparent"
            fallbackColor="currentColor"
            aria-hidden
          />
        </span>
        <div className="min-w-0 flex-1">
          <h3
            id={titleId}
            className="truncate font-sans text-[14px] font-medium text-l-ink"
          >
            {tool.name}
          </h3>
          <div className="mt-0.5 truncate font-mono text-[10.5px] text-l-ink-dim">
            {tool.source} · {formatKind(tool.kind)}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tool configuration"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-l-ink-dim transition-colors duration-fast ease-out hover:bg-l-wash-3 hover:text-l-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
        >
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </header>

      <div className="chron-scrollbar-hidden flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-4 py-4">
        <p className="text-[12.5px] leading-snug text-l-ink-lo">
          {tool.description}
        </p>

        <DrawerSection title="Configuration">
          <div className="flex items-start justify-between gap-3 rounded-[5px] border border-l-border-faint bg-l-wash-1 px-3 py-2.5">
            <div className="min-w-0">
              <div className="font-sans text-[12.5px] font-medium text-l-ink">
                Enabled
              </div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-l-ink-dim">
                {tool.enabled
                  ? "Available to agents in this sandbox."
                  : "Hidden from agent execution."}
              </div>
            </div>
            <Switch
              aria-label={`${tool.enabled ? "Disable" : "Enable"} ${tool.name}`}
              isSelected={tool.enabled}
              onCheckedChange={onToggle}
            />
          </div>
          <DetailRow label="Mode" value={formatMode(tool.mode)} mono />
          <DetailRow
            label="Source"
            value={tool.source}
            mono
          />
        </DrawerSection>

        <DrawerSection title="Health">
          <DetailRow
            label="Status"
            value={
              <span
                className={cx(
                  "inline-flex items-center gap-1.5",
                  status.className
                )}
              >
                <StatusDot
                  variant={status.dot}
                  pulse={tool.status === "faulted"}
                />
                {status.label}
              </span>
            }
          />
          <DetailRow
            label="Latency"
            value={
              <span className="font-mono tabular-nums">
                {tool.enabled ? `${tool.latencyMs}ms` : "off"}
              </span>
            }
          />
        </DrawerSection>

        <DrawerSection title={`Capabilities (${tool.capabilities.length})`}>
          {tool.capabilities.length === 0 ? (
            <div className="text-[12px] text-l-ink-dim">
              No capabilities exposed.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {tool.capabilities.map((capability) => (
                <CapabilityChip key={capability}>{capability}</CapabilityChip>
              ))}
            </div>
          )}
        </DrawerSection>
      </div>
    </aside>
  );
}

function DrawerSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
        {title}
      </h4>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex min-h-[28px] items-center justify-between gap-3 px-1">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-l-ink-dim">
        {label}
      </span>
      <span
        className={cx(
          "min-w-0 truncate text-[12.5px]",
          mono ? "font-mono text-l-ink" : "text-l-ink"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function DataLens({
  environment,
  selectedTraceId,
  onSelectTrace,
}: {
  environment: SandboxEnvironment;
  selectedTraceId: string | null;
  onSelectTrace: (traceId: string | null) => void;
}) {
  const snapshot = environment.currentSnapshot;
  const seeds = snapshot.traceSeeds;

  const sourceTotals = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const seed of seeds) {
      for (const src of seed.sources) {
        counts.set(src, (counts.get(src) ?? 0) + seed.events);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [seeds]);

  const totalEvents = React.useMemo(
    () => seeds.reduce((sum, seed) => sum + seed.events, 0),
    [seeds]
  );

  return (
    <div className="flex flex-col gap-4">
      <DataLineageStrip environment={environment} sampleCount={seeds.length} />
      {totalEvents > 0 ? (
        <SourceContributionCard
          sources={sourceTotals}
          totalEvents={totalEvents}
        />
      ) : null}
      <TraceSeedTable
        seeds={seeds}
        totalTraces={snapshot.traces}
        selectedTraceId={selectedTraceId}
        onSelectTrace={onSelectTrace}
      />
    </div>
  );
}

function DataLineageStrip({
  environment,
  sampleCount,
}: {
  environment: SandboxEnvironment;
  sampleCount: number;
}) {
  const snapshot = environment.currentSnapshot;
  return (
    <section className="rounded-[6px] border border-l-border-faint bg-l-surface p-3">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <LineageNode
          icon={Database}
          eyebrow="Source dataset"
          title={snapshot.sourceDataset}
          sub={`${formatNumber(snapshot.scenarios)} scenarios`}
        />
        <LineageArrow />
        <LineageNode
          icon={Activity}
          eyebrow="Traces"
          title={`${formatNumber(snapshot.traces)}`}
          sub={
            sampleCount > 0
              ? `${sampleCount} shown below`
              : "no sample previews"
          }
          tone="emphasis"
        />
        <LineageArrow />
        <LineageNode
          icon={Boxes}
          eyebrow="Materialized seed"
          title="Sandbox state"
          sub={`${formatNumber(snapshot.entities)} entities · ${formatNumber(snapshot.records)} records · ${formatNumber(snapshot.files)} files`}
        />
      </div>
    </section>
  );
}

function LineageNode({
  icon: Icon,
  eyebrow,
  title,
  sub,
  tone = "default",
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  sub: string;
  tone?: "default" | "emphasis";
}) {
  return (
    <div
      className={cx(
        "flex min-w-0 flex-1 items-start gap-3 rounded-[6px] border bg-l-wash-1 px-3 py-2.5",
        tone === "emphasis"
          ? "border-ember/40 bg-l-surface-selected"
          : "border-l-border-faint"
      )}
    >
      <span
        className={cx(
          "flex size-8 shrink-0 items-center justify-center rounded-[5px]",
          tone === "emphasis"
            ? "bg-ember/15 text-ember"
            : "bg-l-wash-3 text-l-ink-lo"
        )}
      >
        <Icon className="size-4" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
          {eyebrow}
        </div>
        <div className="mt-0.5 truncate font-sans text-[14px] font-medium text-l-ink">
          {title}
        </div>
        <div className="mt-0.5 truncate font-mono text-[10.5px] text-l-ink-dim">
          {sub}
        </div>
      </div>
    </div>
  );
}

function LineageArrow() {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center text-l-ink-dim sm:px-0.5"
    >
      <ChevronRight className="size-4 rotate-90 sm:rotate-0" strokeWidth={1.75} />
    </span>
  );
}

function SourceContributionCard({
  sources,
  totalEvents,
}: {
  sources: readonly (readonly [string, number])[];
  totalEvents: number;
}) {
  return (
    <section className="rounded-[6px] border border-l-border-faint bg-l-surface">
      <div className="flex items-center justify-between gap-2 border-b border-l-border-faint px-3 py-2">
        <div>
          <h2 className="font-sans text-[14px] font-medium text-l-ink">
            Where the seed came from
          </h2>
          <p className="text-[12px] text-l-ink-dim">
            Event volume per source across the sampled traces.
          </p>
        </div>
        <span className="font-mono text-[10.5px] tabular-nums text-l-ink-dim">
          {formatNumber(totalEvents)} events
        </span>
      </div>
      <div className="px-3 py-3">
        <div
          role="img"
          aria-label="Source contribution stacked bar"
          className="flex h-2.5 w-full overflow-hidden rounded-full bg-l-wash-1 ring-1 ring-l-border-faint"
        >
          {sources.map(([source, events]) => {
            const pct = (events / totalEvents) * 100;
            return (
              <span
                key={source}
                title={`${source} - ${pct.toFixed(0)}%`}
                style={{
                  width: `${pct}%`,
                  background: sourceColor(source),
                }}
              />
            );
          })}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {sources.map(([source, events]) => {
            const pct = (events / totalEvents) * 100;
            return (
              <li
                key={source}
                className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-l-ink-lo"
              >
                <span
                  aria-hidden
                  className="block size-2 shrink-0 rounded-full"
                  style={{ background: sourceColor(source) }}
                />
                <CompanyLogo
                  name={source}
                  size={12}
                  radius={2}
                  fallbackBackground="transparent"
                  fallbackColor="currentColor"
                  aria-hidden
                />
                <span className="truncate text-l-ink">{source}</span>
                <span className="tabular-nums text-l-ink-dim">
                  {pct.toFixed(0)}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function TraceSeedTable({
  seeds,
  totalTraces,
  selectedTraceId,
  onSelectTrace,
}: {
  seeds: readonly EnvironmentTraceSeed[];
  totalTraces: number;
  selectedTraceId: string | null;
  onSelectTrace: (traceId: string | null) => void;
}) {
  return (
    <section className="rounded-[6px] border border-l-border-faint bg-l-surface">
      <div className="flex items-center justify-between gap-2 border-b border-l-border-faint px-3 py-2">
        <div>
          <h2 className="font-sans text-[14px] font-medium text-l-ink">
            Source traces
          </h2>
          <p className="text-[12px] text-l-ink-dim">
            What each trace contributed to the sandbox seed.
          </p>
        </div>
        <span className="font-mono text-[10.5px] tabular-nums text-l-ink-dim">
          showing {seeds.length} of {formatNumber(totalTraces)}
        </span>
      </div>
      {seeds.length === 0 ? (
        <div className="px-3 py-3 text-[12px] text-l-ink-dim">
          No trace previews are available for this snapshot.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-l-border-faint">
          {seeds.map((seed) => (
            <TraceSeedRow
              key={seed.id}
              seed={seed}
              selected={seed.id === selectedTraceId}
              onSelect={() =>
                onSelectTrace(seed.id === selectedTraceId ? null : seed.id)
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function TraceSeedRow({
  seed,
  selected,
  onSelect,
}: {
  seed: EnvironmentTraceSeed;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-current={selected ? "true" : undefined}
      data-active={selected || undefined}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className="grid min-h-[44px] cursor-pointer grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 transition-colors duration-fast ease-out hover:bg-l-wash-3 data-[active=true]:bg-l-surface-selected focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
    >
      <span className="truncate font-mono text-[11px] text-l-ink-dim">
        {seed.id}
      </span>
      <div className="min-w-0">
        <div className="truncate font-sans text-[13px] font-medium text-l-ink">
          {seed.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10.5px] text-l-ink-dim">
          <span className="tabular-nums">
            {formatNumber(seed.events)} events
          </span>
          <span aria-hidden>·</span>
          <ContributionChip label="records" value={seed.records} />
          <ContributionChip label="entities" value={seed.entities} />
          <ContributionChip label="files" value={seed.files} />
        </div>
      </div>
      <div className="hidden shrink-0 sm:block">
        <SourceLogoStack sources={seed.sources} max={4} size={14} />
      </div>
    </li>
  );
}

function ContributionChip({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-l-wash-3 px-1.5 py-0.5 text-l-ink-lo">
      <span className="tabular-nums">{formatNumber(value)}</span>
      <span>{label}</span>
    </span>
  );
}

function ActivityLens({
  environment,
  runtime,
}: {
  environment: SandboxEnvironment;
  runtime: SandboxRuntimeControlState;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ResourceUsageStrip environment={environment} runtime={runtime} />
      <LogStream activity={environment.activity} />
    </div>
  );
}

const RUNTIME_STATUS_META: Record<
  string,
  {
    label: string;
    className: string;
    dot: React.ComponentProps<typeof StatusDot>["variant"];
    pulse?: boolean;
  }
> = {
  started: {
    label: "running",
    className: "bg-event-green/10 text-event-green",
    dot: "green",
    pulse: true,
  },
  stopped: {
    label: "stopped",
    className: "bg-l-wash-3 text-l-ink-dim",
    dot: "offline",
  },
  starting: {
    label: "starting",
    className: "bg-event-amber/10 text-event-amber",
    dot: "amber",
    pulse: true,
  },
  stopping: {
    label: "stopping",
    className: "bg-event-amber/10 text-event-amber",
    dot: "amber",
    pulse: true,
  },
  creating: {
    label: "creating",
    className: "bg-event-amber/10 text-event-amber",
    dot: "amber",
    pulse: true,
  },
  pulling_snapshot: {
    label: "pulling",
    className: "bg-event-teal/10 text-event-teal",
    dot: "teal",
    pulse: true,
  },
  building_snapshot: {
    label: "building",
    className: "bg-event-teal/10 text-event-teal",
    dot: "teal",
    pulse: true,
  },
  pending_build: {
    label: "queued",
    className: "bg-event-teal/10 text-event-teal",
    dot: "teal",
    pulse: true,
  },
  restoring: {
    label: "restoring",
    className: "bg-event-amber/10 text-event-amber",
    dot: "amber",
    pulse: true,
  },
  archiving: {
    label: "archiving",
    className: "bg-event-amber/10 text-event-amber",
    dot: "amber",
    pulse: true,
  },
  archived: {
    label: "archived",
    className: "bg-l-wash-3 text-l-ink-dim",
    dot: "offline",
  },
  destroying: {
    label: "destroying",
    className: "bg-event-red/10 text-event-red",
    dot: "red",
    pulse: true,
  },
  destroyed: {
    label: "destroyed",
    className: "bg-l-wash-3 text-l-ink-dim",
    dot: "offline",
  },
  error: {
    label: "error",
    className: "bg-event-red/10 text-event-red",
    dot: "red",
  },
  build_failed: {
    label: "build failed",
    className: "bg-event-red/10 text-event-red",
    dot: "red",
  },
  unknown: {
    label: "—",
    className: "bg-l-wash-3 text-l-ink-dim",
    dot: "offline",
  },
};

function getRuntimeStatusMeta(status: SandboxRuntimeStatus | null) {
  if (!status) return RUNTIME_STATUS_META.unknown!;
  return RUNTIME_STATUS_META[status] ?? RUNTIME_STATUS_META.unknown!;
}

interface SandboxRuntimeControlState {
  enabled: boolean;
  hasFetchStats: boolean;
  status: SandboxRuntimeStatus | null;
  stats: SandboxLiveStats | null;
  error: string | null;
  starting: boolean;
  stopping: boolean;
  canStart: boolean;
  canStop: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

function useSandboxRuntime({
  environmentId,
  onFetchStats,
  onStartSandbox,
  onStopSandbox,
}: {
  environmentId: string;
  onFetchStats?: SandboxStatsFetcher;
  onStartSandbox?: SandboxLifecycleAction;
  onStopSandbox?: SandboxLifecycleAction;
}): SandboxRuntimeControlState {
  const enabled = Boolean(onFetchStats || onStartSandbox || onStopSandbox);
  const [status, setStatus] = React.useState<SandboxRuntimeStatus | null>(null);
  const [stats, setStats] = React.useState<SandboxLiveStats | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [stopping, setStopping] = React.useState(false);
  const fetchInFlight = React.useRef(false);

  const fetchStatsNow = React.useCallback(async () => {
    if (!onFetchStats || fetchInFlight.current) return;
    fetchInFlight.current = true;
    try {
      const next = await onFetchStats(environmentId);
      setStats(next);
      setStatus(next.status);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "stats failed");
    } finally {
      fetchInFlight.current = false;
    }
  }, [environmentId, onFetchStats]);

  React.useEffect(() => {
    setStats(null);
    setStatus(null);
    setError(null);
  }, [environmentId]);

  React.useEffect(() => {
    if (!onFetchStats) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      // Skip the network call entirely while the tab is hidden; we'll
      // poll once the user returns. This avoids burning Daytona quota
      // and prevents stale numbers from flashing in on visibility-change.
      if (typeof document === "undefined" || !document.hidden) {
        await fetchStatsNow();
      }
      if (cancelled) return;
      const delay = status === "started" ? 5000 : 15000;
      timeoutId = setTimeout(tick, delay);
    };

    const onVisibilityChange = () => {
      if (
        typeof document !== "undefined" &&
        !document.hidden &&
        !cancelled
      ) {
        // User returned to the tab — refresh immediately so the
        // header status pill reflects reality without waiting for
        // the next scheduled poll.
        void fetchStatsNow();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    timeoutId = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [fetchStatsNow, onFetchStats, status]);

  const start = React.useCallback(async () => {
    if (!onStartSandbox || starting) return;
    setStarting(true);
    setError(null);
    try {
      const result = await onStartSandbox(environmentId);
      setStatus(result.status);
      void fetchStatsNow();
    } catch (err) {
      setError(err instanceof Error ? err.message : "start failed");
    } finally {
      setStarting(false);
    }
  }, [environmentId, fetchStatsNow, onStartSandbox, starting]);

  const stop = React.useCallback(async () => {
    if (!onStopSandbox || stopping) return;
    setStopping(true);
    setError(null);
    try {
      const result = await onStopSandbox(environmentId);
      setStatus(result.status);
      void fetchStatsNow();
    } catch (err) {
      setError(err instanceof Error ? err.message : "stop failed");
    } finally {
      setStopping(false);
    }
  }, [environmentId, fetchStatsNow, onStopSandbox, stopping]);

  const canStart =
    Boolean(onStartSandbox) &&
    !starting &&
    !stopping &&
    (status === "stopped" ||
      status === "archived" ||
      status === "destroyed" ||
      status === "error" ||
      status === null);
  const canStop =
    Boolean(onStopSandbox) && !starting && !stopping && status === "started";

  return {
    enabled,
    hasFetchStats: Boolean(onFetchStats),
    status,
    stats,
    error,
    starting,
    stopping,
    canStart,
    canStop,
    start,
    stop,
  };
}

function SandboxRuntimeControl({
  runtime,
}: {
  runtime: SandboxRuntimeControlState;
}) {
  const meta = getRuntimeStatusMeta(runtime.status);
  // Reserve a fixed slot for the action button so swapping Start ↔ Stop
  // (or hiding it during transitional states) doesn't reflow the header.
  const showStart = runtime.canStart;
  const showStop = runtime.canStop;
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span
        // Min-width keeps the pill from snapping smaller when the label
        // is short ("error", "—") and longer transitional states swap in.
        className={cx(
          "inline-flex h-7 min-w-[88px] items-center justify-center gap-1.5 rounded-full px-2.5 font-mono text-[10.5px] uppercase tracking-[0.06em]",
          meta.className
        )}
        aria-live="polite"
      >
        <StatusDot variant={meta.dot} pulse={meta.pulse} />
        {meta.label}
      </span>
      <div className="flex w-[80px] shrink-0 justify-end" aria-hidden={!showStart && !showStop}>
        {showStart ? (
          <Button
            variant="secondary"
            size="sm"
            onPress={runtime.start}
            isPending={runtime.starting}
            leadingIcon={<Play className="size-3.5" strokeWidth={1.75} />}
            className="w-full"
          >
            Start
          </Button>
        ) : null}
        {showStop ? (
          <Button
            variant="critical"
            size="sm"
            onPress={runtime.stop}
            isPending={runtime.stopping}
            leadingIcon={<Square className="size-3.5" strokeWidth={1.75} />}
            className="w-full"
          >
            Stop
          </Button>
        ) : null}
      </div>
      {runtime.error ? (
        <span
          className="hidden max-w-[180px] truncate font-mono text-[10.5px] text-event-red md:inline-block"
          title={runtime.error}
          role="status"
        >
          {runtime.error}
        </span>
      ) : null}
    </div>
  );
}

const USAGE_HISTORY = 40;
const USAGE_TICK_MS = 2000;

interface UsageSeries {
  values: readonly number[];
  current: number;
  pct: number;
}

interface UsageSnapshot {
  cpu: UsageSeries;
  memory: UsageSeries;
  disk: UsageSeries;
}

function hashSeed(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function clamp01(v: number) {
  return Math.max(0.01, Math.min(0.99, v));
}

function buildSeries(
  tick: number,
  seed: number,
  base: number,
  ampSlow: number,
  ampFast: number
): number[] {
  const out: number[] = [];
  for (let i = 0; i < USAGE_HISTORY; i++) {
    const t = tick - USAGE_HISTORY + 1 + i;
    const slow = Math.sin(t * 0.16 + seed * 0.7) * ampSlow;
    const fast = Math.sin(t * 0.55 + seed * 1.3) * ampFast * 0.6;
    const noise = Math.sin(t * 1.9 + seed * 0.4) * ampFast * 0.2;
    out.push(clamp01(base + slow + fast + noise));
  }
  return out;
}

function buildUsage(
  environment: SandboxEnvironment,
  tick: number
): UsageSnapshot {
  const seed = hashSeed(environment.id);
  const enabled = environment.tools.filter((tool) => tool.enabled).length;
  const total = Math.max(1, environment.tools.length);
  const activeBonus = environment.activeAgents > 0 ? 0.18 : 0;

  const cpuBase = 0.32 + activeBonus;
  const memBase = 0.28 + (enabled / total) * 0.4 + activeBonus * 0.6;
  const diskBase = 0.18 + Math.min(0.45, environment.currentSnapshot.records / 60_000);

  const cpu = buildSeries(tick, seed, cpuBase, 0.18, 0.32);
  const memory = buildSeries(tick, seed + 1, memBase, 0.04, 0.06);
  const disk = buildSeries(tick, seed + 2, diskBase, 0.005, 0.01);

  return {
    cpu: {
      values: cpu,
      current: cpu[cpu.length - 1]!,
      pct: Math.round(cpu[cpu.length - 1]! * 100),
    },
    memory: {
      values: memory,
      current: memory[memory.length - 1]!,
      pct: Math.round(memory[memory.length - 1]! * 100),
    },
    disk: {
      values: disk,
      current: disk[disk.length - 1]!,
      pct: Math.round(disk[disk.length - 1]! * 100),
    },
  };
}

function ResourceUsageStrip({
  environment,
  runtime,
}: {
  environment: SandboxEnvironment;
  runtime: SandboxRuntimeControlState;
}) {
  const liveMode = runtime.hasFetchStats;
  const liveStats = runtime.stats;
  const liveActive = liveMode && runtime.status === "started" && Boolean(liveStats);

  const reducedMotion = useReducedMotion();
  const [mockTick, setMockTick] = React.useState(0);
  const [liveHistory, setLiveHistory] = React.useState({
    cpu: [] as number[],
    memory: [] as number[],
    disk: [] as number[],
  });

  React.useEffect(() => {
    if (liveMode) return;
    if (reducedMotion) return; // Hold the sparkline still under reduced motion.
    const id = setInterval(() => setMockTick((t) => t + 1), USAGE_TICK_MS);
    return () => clearInterval(id);
  }, [liveMode, reducedMotion]);

  React.useEffect(() => {
    if (!liveActive || !liveStats) return;
    setLiveHistory((prev) => {
      const append = (arr: number[], v: number) => {
        const next = [...arr, v];
        return next.length > USAGE_HISTORY
          ? next.slice(next.length - USAGE_HISTORY)
          : next;
      };
      return {
        cpu: append(prev.cpu, liveStats.cpuPct / 100),
        memory: append(prev.memory, liveStats.memoryPct / 100),
        disk: append(prev.disk, liveStats.diskPct / 100),
      };
    });
  }, [liveActive, liveStats]);

  React.useEffect(() => {
    if (!liveMode) return;
    setLiveHistory({ cpu: [], memory: [], disk: [] });
  }, [environment.id, liveMode]);

  const fallbackResources = environment.resources;
  const totalVCpu = liveStats?.vCpu ?? fallbackResources.vCpu;
  const totalMemGib = liveStats?.memoryTotalGib ?? fallbackResources.memoryGib;
  const totalDiskGib = liveStats?.diskTotalGib ?? fallbackResources.diskGib;

  const usage = React.useMemo<UsageSnapshot>(() => {
    if (liveActive && liveStats) {
      const padSeries = (arr: number[]): number[] => {
        if (arr.length === 0) return [0];
        if (arr.length >= 2) return arr;
        return [arr[0]!, arr[0]!];
      };
      const seriesFrom = (arr: number[], pct: number): UsageSeries => ({
        values: padSeries(arr),
        current: pct / 100,
        pct,
      });
      return {
        cpu: seriesFrom(liveHistory.cpu, liveStats.cpuPct),
        memory: seriesFrom(liveHistory.memory, liveStats.memoryPct),
        disk: seriesFrom(liveHistory.disk, liveStats.diskPct),
      };
    }
    if (liveMode) {
      const flat: number[] = Array.from({ length: 2 }, () => 0);
      const idle: UsageSeries = { values: flat, current: 0, pct: 0 };
      return { cpu: idle, memory: idle, disk: idle };
    }
    return buildUsage(environment, mockTick);
  }, [environment, liveActive, liveHistory, liveMode, liveStats, mockTick]);

  const indicator = (() => {
    if (!liveMode) {
      return { label: "streaming", dot: "green" as const, pulse: true };
    }
    if (runtime.error) {
      return { label: "error", dot: "red" as const, pulse: false };
    }
    if (runtime.status === "started") {
      return { label: "live", dot: "green" as const, pulse: true };
    }
    if (runtime.status) {
      return { label: runtime.status, dot: "amber" as const, pulse: false };
    }
    return { label: "connecting", dot: "amber" as const, pulse: true };
  })();

  return (
    <section className="rounded-[6px] border border-l-border-faint bg-l-surface">
      <div className="flex items-center justify-between gap-2 border-b border-l-border-faint px-3 py-2">
        <h2 className="font-sans text-[14px] font-medium text-l-ink">
          {liveMode ? "Live resource usage" : "Simulated resource usage"}
        </h2>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-l-ink-dim">
          <StatusDot variant={indicator.dot} pulse={indicator.pulse} />
          {indicator.label}
        </span>
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-3">
        <ResourceGauge
          icon={Cpu}
          label="CPU"
          series={usage.cpu}
          formatCurrent={(s) =>
            liveMode
              ? `${s.pct}% of ${totalVCpu} vCPU`
              : `${(s.current * totalVCpu).toFixed(2)} / ${totalVCpu} vCPU`
          }
        />
        <ResourceGauge
          icon={MemoryStick}
          label="Memory"
          series={usage.memory}
          formatCurrent={(s) =>
            liveMode && liveStats
              ? `${liveStats.memoryUsedGib.toFixed(2)} / ${totalMemGib.toFixed(2)} GiB`
              : `${(s.current * totalMemGib).toFixed(2)} / ${totalMemGib} GiB`
          }
        />
        <ResourceGauge
          icon={HardDrive}
          label="Disk"
          series={usage.disk}
          formatCurrent={(s) =>
            liveMode && liveStats
              ? `${liveStats.diskUsedGib.toFixed(1)} / ${totalDiskGib.toFixed(1)} GiB`
              : `${(s.current * totalDiskGib).toFixed(1)} / ${totalDiskGib} GiB`
          }
        />
      </div>
    </section>
  );
}

function ResourceGauge({
  icon: Icon,
  label,
  series,
  formatCurrent,
}: {
  icon: LucideIcon;
  label: string;
  series: UsageSeries;
  formatCurrent: (series: UsageSeries) => string;
}) {
  const tone =
    series.pct >= 85
      ? "var(--c-event-red)"
      : series.pct >= 65
        ? "var(--c-event-amber)"
        : "var(--c-event-green)";
  return (
    <div className="flex flex-col gap-2 rounded-[5px] border border-l-border-faint bg-l-wash-1 p-3">
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[5px] bg-l-wash-3 text-l-ink-lo">
          <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
            {label}
          </div>
          <div className="truncate font-mono text-[12px] tabular-nums text-l-ink">
            {formatCurrent(series)}
          </div>
        </div>
        <span
          className="font-mono text-[14px] tabular-nums"
          style={{ color: tone }}
        >
          {series.pct}%
        </span>
      </div>
      <Sparkline values={series.values} color={tone} />
    </div>
  );
}

function Sparkline({
  values,
  color,
  height = 26,
}: {
  values: readonly number[];
  color: string;
  height?: number;
}) {
  const w = 100;
  const last = values.length - 1;
  const points = values
    .map((v, i) => `${(i / last) * w},${(1 - v) * height}`)
    .join(" ");
  const fillPath = `M0,${height} L${points} L${w},${height} Z`;
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="block overflow-visible"
      aria-hidden
    >
      <path d={fillPath} fill={color} fillOpacity={0.12} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const ACTIVITY_LEVEL: Record<
  EnvironmentActivityKind,
  { label: string; className: string }
> = {
  seed: { label: "INFO", className: "text-event-teal" },
  tool: { label: "DEBUG", className: "text-l-ink-dim" },
  agent: { label: "INFO", className: "text-event-green" },
  failure: { label: "WARN", className: "text-event-amber" },
  reset: { label: "INFO", className: "text-event-violet" },
};

function formatLogTimestamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function LogStream({
  activity,
}: {
  activity: readonly EnvironmentActivity[];
}) {
  return (
    <section className="overflow-hidden rounded-[6px] border border-l-border-faint bg-l-surface">
      <div className="flex items-center justify-between gap-2 border-b border-l-border-faint px-3 py-2">
        <h2 className="font-sans text-[14px] font-medium text-l-ink">
          Sandbox log
        </h2>
        <span className="font-mono text-[10.5px] tabular-nums text-l-ink-dim">
          {activity.length} {activity.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      {activity.length === 0 ? (
        <div className="px-3 py-3 font-mono text-[11.5px] text-l-ink-dim">
          // no events recorded yet
        </div>
      ) : (
        <ol className="divide-y divide-l-border-faint bg-l-wash-1 font-mono text-[11.5px] leading-snug">
          {activity.map((entry) => {
            const level = ACTIVITY_LEVEL[entry.kind];
            return (
              <li
                key={entry.id}
                className="grid grid-cols-[88px_56px_72px_minmax(0,1fr)] gap-3 px-3 py-1.5 hover:bg-l-wash-3"
              >
                <span className="text-l-ink-dim tabular-nums">
                  {formatLogTimestamp(entry.at)}
                </span>
                <span className={cx("font-medium", level.className)}>
                  {level.label}
                </span>
                <span className="truncate text-l-ink-lo">{entry.kind}</span>
                <span className="min-w-0">
                  <span className="text-l-ink">{entry.title}</span>
                  {entry.detail ? (
                    <span className="ml-2 text-l-ink-dim">— {entry.detail}</span>
                  ) : null}
                  <span className="ml-2 text-l-ink-dim">[{entry.actor}]</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

type TerminalLineKind =
  | "boot"
  | "ok"
  | "info"
  | "prompt"
  | "agent"
  | "tool"
  | "warn";

interface TerminalLine {
  id: number;
  kind: TerminalLineKind;
  text: string;
}

const TERMINAL_LINE_TONES: Record<TerminalLineKind, string> = {
  boot: "text-l-ink-dim",
  ok: "text-event-green",
  info: "text-event-teal",
  prompt: "text-l-ink",
  agent: "text-event-violet",
  tool: "text-l-ink-lo",
  warn: "text-event-amber",
};

const TERMINAL_LINE_LABELS: Record<TerminalLineKind, string | null> = {
  boot: "[boot]",
  ok: "[ok]  ",
  info: "[info]",
  prompt: null,
  agent: "[agnt]",
  tool: "[tool]",
  warn: "[warn]",
};

const TERMINAL_BUFFER_LIMIT = 160;
const TERMINAL_TICK_MIN_MS = 1100;
const TERMINAL_TICK_MAX_MS = 2400;

function envSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function nowIso() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function buildBootSequence(
  environment: SandboxEnvironment,
  remoteMode: boolean
): readonly Omit<TerminalLine, "id">[] {
  const slug = envSlug(environment.name);
  const snapshot = environment.currentSnapshot;
  const enabledTools = environment.tools.filter((tool) => tool.enabled);
  const toolNames = enabledTools.map((tool) => tool.name).join(", ") || "none";
  const agents = environment.agentIdentities
    .map((identity) => identity.principal.split("@")[0])
    .join(", ");

  const lines: Omit<TerminalLine, "id">[] = [
    {
      kind: "prompt",
      text: `chronicle@${slug}:~$ chron sandbox attach ${environment.id}`,
    },
    { kind: "boot", text: "spinning up sandbox container" },
    {
      kind: "boot",
      text: `pulling snapshot image: chronicle/${snapshot.sourceDataset}:${snapshot.id}`,
    },
    {
      kind: "boot",
      text: `layers loaded: ${formatNumber(snapshot.scenarios)}s · ${formatNumber(snapshot.entities)}e · ${formatNumber(snapshot.records)}r · ${formatNumber(snapshot.files)}f · ${formatNumber(snapshot.traces)}t`,
    },
    {
      kind: "boot",
      text: `resources: ${environment.resources.vCpu} vCPU · ${environment.resources.memoryGib} GiB · ${environment.resources.diskGib} GiB`,
    },
    { kind: "boot", text: `mounting tool runtime: ${toolNames}` },
    {
      kind: "boot",
      text: `attaching agent identities: ${agents || "none"}`,
    },
    {
      kind: "ok",
      text: `sandbox ready (${environment.activeAgents} active agents)`,
    },
  ];

  if (remoteMode) {
    lines.push({
      kind: "info",
      text: "remote shell attached via daytona — type a real command (or `help`)",
    });
  } else {
    lines.push({
      kind: "prompt",
      text: `chronicle@${slug}:~$ tail -f /var/log/sandbox.log`,
    });
  }

  return lines;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function generateStreamLine(
  environment: SandboxEnvironment
): Omit<TerminalLine, "id"> {
  const time = nowIso();
  const enabledTools = environment.tools.filter((tool) => tool.enabled);
  const tool = enabledTools.length > 0 ? pickRandom(enabledTools) : null;
  const trace =
    environment.currentSnapshot.traceSeeds.length > 0
      ? pickRandom(environment.currentSnapshot.traceSeeds)
      : null;
  const agent =
    environment.agentIdentities.length > 0
      ? pickRandom(environment.agentIdentities)
      : null;

  const roll = Math.random();

  if (tool && roll < 0.45) {
    const cap = tool.capabilities[
      Math.floor(Math.random() * tool.capabilities.length)
    ];
    const latency =
      tool.latencyMs > 0
        ? tool.latencyMs + Math.floor(Math.random() * 12) - 4
        : 8;
    return {
      kind: "tool",
      text: `${time}  ${tool.name}(${cap ?? "call"}) -> ok ${latency}ms`,
    };
  }

  if (agent && trace && roll < 0.7) {
    const action = pickRandom([
      `claimed trace ${trace.id}`,
      `processing trace ${trace.id} (${trace.events} events)`,
      `wrote response for ${trace.id}`,
      `completed trace ${trace.id}`,
    ]);
    return {
      kind: "agent",
      text: `${time}  ${agent.principal.split("@")[0]} ${action}`,
    };
  }

  if (roll < 0.85) {
    return {
      kind: "info",
      text: `${time}  events/min ${environment.eventsPerMin + Math.floor(Math.random() * 4) - 2}`,
    };
  }

  if (tool) {
    return {
      kind: "warn",
      text: `${time}  ${tool.name} retry: transient timeout, backing off 200ms`,
    };
  }

  return { kind: "info", text: `${time}  heartbeat ok` };
}

function executeCommand(
  cmd: string,
  environment: SandboxEnvironment
): readonly Omit<TerminalLine, "id">[] | "clear" {
  const trimmed = cmd.trim();
  if (!trimmed) return [];

  const parts = trimmed.split(/\s+/);
  const head = (parts[0] ?? "").toLowerCase();
  const arg1 = (parts[1] ?? "").toLowerCase();

  if (head === "help" || head === "?") {
    return [
      { kind: "info", text: "available commands:" },
      { kind: "info", text: "  help              show this message" },
      { kind: "info", text: "  ls tools          list mounted tool runtimes" },
      { kind: "info", text: "  ls traces         list trace seeds" },
      { kind: "info", text: "  ls agents         list agent identities" },
      { kind: "info", text: "  inspect <tool>    show tool details" },
      { kind: "info", text: "  cat snapshot      print snapshot manifest" },
      { kind: "info", text: "  top               show resource allocation" },
      { kind: "info", text: "  ps                list active agent identities" },
      { kind: "info", text: "  whoami            print current sandbox" },
      { kind: "info", text: "  clear             clear the screen" },
      { kind: "info", text: "  exit              detach hint" },
    ];
  }

  if (head === "ls") {
    if (arg1 === "tools") {
      return environment.tools.map((tool) => ({
        kind: "info",
        text: `${tool.name.padEnd(20)} ${formatKind(tool.kind).padEnd(12)} ${(
          tool.enabled ? "active" : "disabled"
        ).padEnd(10)} ${tool.latencyMs}ms`,
      }));
    }
    if (arg1 === "traces") {
      return environment.currentSnapshot.traceSeeds.map((seed) => ({
        kind: "info",
        text: `${seed.id.padEnd(12)} ${String(seed.events).padStart(4)} events  ${seed.title}`,
      }));
    }
    if (arg1 === "agents") {
      return environment.agentIdentities.map((agent) => ({
        kind: "info",
        text: `${agent.principal.padEnd(40)} ${agent.label}`,
      }));
    }
    if (arg1 === "") {
      return [
        { kind: "info", text: "tools  traces  agents" },
      ];
    }
    return [
      { kind: "warn", text: `ls: unknown collection: ${arg1}` },
    ];
  }

  if (head === "inspect") {
    const name = parts[1];
    if (!name) {
      return [{ kind: "warn", text: "inspect: missing tool name" }];
    }
    const tool = environment.tools.find(
      (t) => t.name === name || t.id === name
    );
    if (!tool) {
      return [{ kind: "warn", text: `inspect: tool not found: ${name}` }];
    }
    return [
      { kind: "info", text: `${tool.name}` },
      { kind: "info", text: `  source       : ${tool.source}` },
      { kind: "info", text: `  kind         : ${formatKind(tool.kind)}` },
      { kind: "info", text: `  mode         : ${formatMode(tool.mode)}` },
      { kind: "info", text: `  status       : ${tool.status}` },
      { kind: "info", text: `  latency      : ${tool.latencyMs}ms` },
      { kind: "info", text: `  enabled      : ${tool.enabled ? "true" : "false"}` },
      { kind: "info", text: `  capabilities : ${tool.capabilities.join(", ")}` },
      { kind: "info", text: `  description  : ${tool.description}` },
    ];
  }

  if (head === "cat" && arg1 === "snapshot") {
    const snap = environment.currentSnapshot;
    return [
      { kind: "info", text: "{" },
      { kind: "info", text: `  "id":            "${snap.id}",` },
      { kind: "info", text: `  "image":         "chronicle/${snap.sourceDataset}",` },
      { kind: "info", text: `  "scenarios":     ${snap.scenarios},` },
      { kind: "info", text: `  "entities":      ${snap.entities},` },
      { kind: "info", text: `  "records":       ${snap.records},` },
      { kind: "info", text: `  "files":         ${snap.files},` },
      { kind: "info", text: `  "traces":        ${snap.traces},` },
      { kind: "info", text: `  "seededAt":      "${snap.seededAt}"` },
      { kind: "info", text: "}" },
    ];
  }

  if (head === "top") {
    const r = environment.resources;
    return [
      { kind: "info", text: `cpu      ${r.vCpu} vCPU allocated` },
      { kind: "info", text: `memory   ${r.memoryGib} GiB allocated` },
      { kind: "info", text: `disk     ${r.diskGib} GiB allocated` },
      {
        kind: "info",
        text: `agents   ${environment.activeAgents} active · events/min ${environment.eventsPerMin}`,
      },
    ];
  }

  if (head === "ps") {
    if (environment.agentIdentities.length === 0) {
      return [{ kind: "info", text: "no agent identities attached" }];
    }
    return environment.agentIdentities.map((agent) => ({
      kind: "agent",
      text: `${agent.principal.padEnd(40)} scopes=[${agent.scopes.join(", ")}]`,
    }));
  }

  if (head === "whoami") {
    return [
      {
        kind: "info",
        text: `${environment.owner}@${environment.id} (${environment.name})`,
      },
    ];
  }

  if (head === "clear") {
    return "clear";
  }

  if (head === "exit") {
    return [
      { kind: "ok", text: "use the back arrow to detach from the sandbox" },
    ];
  }

  return [
    {
      kind: "warn",
      text: `chron: command not found: ${head} (try "help")`,
    },
  ];
}

function TerminalLens({
  environment,
  onExecute,
}: {
  environment: SandboxEnvironment;
  onExecute?: SandboxExecutor;
}) {
  const [lines, setLines] = React.useState<readonly TerminalLine[]>([]);
  const [bootDone, setBootDone] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [history, setHistory] = React.useState<readonly string[]>([]);
  const [historyIdx, setHistoryIdx] = React.useState<number | null>(null);
  const [executing, setExecuting] = React.useState(false);
  const idRef = React.useRef(0);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const slug = envSlug(environment.name);
  const remoteMode = Boolean(onExecute);
  const reducedMotion = useReducedMotion();

  const appendLines = React.useCallback(
    (newLines: readonly Omit<TerminalLine, "id">[]) => {
      setLines((prev) => {
        const next = [...prev];
        for (const ln of newLines) {
          next.push({ id: idRef.current++, kind: ln.kind, text: ln.text });
        }
        if (next.length > TERMINAL_BUFFER_LIMIT) {
          return next.slice(next.length - TERMINAL_BUFFER_LIMIT);
        }
        return next;
      });
    },
    []
  );

  React.useEffect(() => {
    setLines([]);
    setBootDone(false);
    setInputValue("");
    setHistory([]);
    setHistoryIdx(null);
    idRef.current = 0;
  }, [environment.id]);

  React.useEffect(() => {
    if (bootDone) return;
    const boot = buildBootSequence(environment, remoteMode);

    // Under reduced motion, dump the whole boot output in one paint.
    if (reducedMotion) {
      appendLines(boot);
      setBootDone(true);
      return;
    }

    let i = 0;
    const id = setInterval(() => {
      const next = boot[i];
      if (!next) {
        clearInterval(id);
        setBootDone(true);
        return;
      }
      appendLines([next]);
      i++;
    }, 220);
    return () => clearInterval(id);
  }, [environment, bootDone, appendLines, remoteMode, reducedMotion]);

  React.useEffect(() => {
    if (!bootDone || remoteMode) return;
    if (reducedMotion) return; // No synthetic streaming under reduced motion.
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      // Pause when the tab isn't visible — saves CPU and avoids
      // surprising users with a wall of buffered events on return.
      if (typeof document !== "undefined" && document.hidden) {
        timeoutId = setTimeout(tick, 1500);
        return;
      }
      const line = generateStreamLine(environment);
      appendLines([line]);
      const delay =
        TERMINAL_TICK_MIN_MS +
        Math.random() * (TERMINAL_TICK_MAX_MS - TERMINAL_TICK_MIN_MS);
      timeoutId = setTimeout(tick, delay);
    };
    let timeoutId = setTimeout(tick, 600);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [bootDone, environment, appendLines, remoteMode, reducedMotion]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  React.useEffect(() => {
    if (bootDone) inputRef.current?.focus();
  }, [bootDone]);

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (executing) return;
      const cmd = inputValue;
      const trimmed = cmd.trim();
      const echoed: Omit<TerminalLine, "id"> = {
        kind: "prompt",
        text: `chronicle@${slug}:~$ ${cmd}`,
      };

      if (!trimmed) {
        appendLines([echoed]);
        setInputValue("");
        setHistoryIdx(null);
        return;
      }

      const head = trimmed.split(/\s+/)[0]?.toLowerCase() ?? "";
      const isBuiltin =
        head === "help" || head === "?" || head === "clear" || head === "exit";

      if (!remoteMode || isBuiltin) {
        const result = executeCommand(trimmed, environment);
        if (result === "clear") {
          setLines([]);
        } else {
          appendLines([echoed, ...result]);
        }
        setHistory((prev) =>
          prev[prev.length - 1] === trimmed ? prev : [...prev, trimmed]
        );
        setInputValue("");
        setHistoryIdx(null);
        return;
      }

      appendLines([echoed]);
      setInputValue("");
      setHistoryIdx(null);
      setHistory((prev) =>
        prev[prev.length - 1] === trimmed ? prev : [...prev, trimmed]
      );
      setExecuting(true);
      try {
        const result = await onExecute!(environment.id, trimmed);
        const trimmedOutput = result.output.replace(/\n+$/, "");
        const lineKind: TerminalLineKind =
          result.exitCode === 0 ? "info" : "warn";
        const emitted: Omit<TerminalLine, "id">[] =
          trimmedOutput.length > 0
            ? trimmedOutput
                .split("\n")
                .map((text) => ({ kind: lineKind, text }))
            : [
                {
                  kind: "info",
                  text:
                    result.exitCode === 0
                      ? "(no output)"
                      : `(no output, exit ${result.exitCode})`,
                },
              ];
        if (result.exitCode !== 0 && trimmedOutput.length > 0) {
          emitted.push({
            kind: "warn",
            text: `exit ${result.exitCode}`,
          });
        }
        appendLines(emitted);
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        appendLines([
          { kind: "warn", text: `chron: exec failed: ${message}` },
        ]);
      } finally {
        setExecuting(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [
      appendLines,
      environment,
      executing,
      inputValue,
      onExecute,
      remoteMode,
      slug,
    ]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowUp") {
        if (history.length === 0) return;
        event.preventDefault();
        const next =
          historyIdx === null
            ? history.length - 1
            : Math.max(0, historyIdx - 1);
        setHistoryIdx(next);
        setInputValue(history[next] ?? "");
        return;
      }
      if (event.key === "ArrowDown") {
        if (historyIdx === null) return;
        event.preventDefault();
        const next = historyIdx + 1;
        if (next >= history.length) {
          setHistoryIdx(null);
          setInputValue("");
        } else {
          setHistoryIdx(next);
          setInputValue(history[next] ?? "");
        }
        return;
      }
      if (event.key === "l" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setLines([]);
      }
    },
    [history, historyIdx]
  );

  const handleSurfaceClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (window.getSelection()?.toString()) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, button, a")) return;
      inputRef.current?.focus();
    },
    []
  );

  const inputId = React.useId();

  return (
    <section className="flex h-full min-h-[440px] flex-col overflow-hidden rounded-[6px] border border-l-border-faint bg-l-wash-1">
      <div className="flex items-center justify-between gap-2 border-b border-l-border-faint bg-l-surface px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5" aria-hidden>
            <span className="block size-2.5 rounded-full bg-event-red/70" />
            <span className="block size-2.5 rounded-full bg-event-amber/70" />
            <span className="block size-2.5 rounded-full bg-event-green/70" />
          </span>
          <span className="font-mono text-[11.5px] text-l-ink">
            chronicle@{slug}
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-l-ink-dim">
          <StatusDot
            variant={executing ? "amber" : "green"}
            pulse
          />
          {executing
            ? "executing"
            : remoteMode
              ? "daytona"
              : "live"}
        </span>
      </div>
      <div
        ref={containerRef}
        onClick={handleSurfaceClick}
        className="chron-scrollbar-hidden min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-[11.5px] leading-snug"
        aria-live="polite"
      >
        {lines.map((line) => {
          const tone = TERMINAL_LINE_TONES[line.kind];
          const label = TERMINAL_LINE_LABELS[line.kind];
          return (
            <div key={line.id} className="flex items-baseline gap-2">
              {label ? (
                <span className={cx("shrink-0 select-none", tone)}>
                  {label}
                </span>
              ) : null}
              <span
                className={cx(
                  "min-w-0 whitespace-pre-wrap break-words",
                  line.kind === "prompt" ? "text-l-ink" : "text-l-ink-lo"
                )}
              >
                {line.text}
              </span>
            </div>
          );
        })}
      </div>
      <form
        onSubmit={handleSubmit}
        // Prompt + input rendered at 16px so iOS Safari doesn't auto-zoom
        // on focus. The visual scale is preserved by the surrounding mono
        // glyphs being slightly larger than the body log lines.
        className="flex shrink-0 items-center gap-2 border-t border-l-border-faint bg-l-surface px-3 py-2 font-mono text-[16px] leading-tight focus-within:bg-l-wash-1 sm:text-[12.5px]"
      >
        <label
          htmlFor={inputId}
          className="shrink-0 select-none text-l-ink"
        >
          chronicle@{slug}:~$
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(event) => setInputValue(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="text"
          aria-label="Sandbox terminal command"
          aria-busy={executing}
          placeholder={
            executing
              ? "running..."
              : bootDone
                ? remoteMode
                  ? "type a real shell command (or `help`)"
                  : "type a command... (try help)"
                : ""
          }
          disabled={!bootDone || executing}
          className="min-w-0 flex-1 bg-transparent text-l-ink caret-ember outline-none placeholder:text-l-ink-dim disabled:opacity-60"
        />
      </form>
    </section>
  );
}

function CapabilityChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 max-w-full items-center rounded-full bg-l-wash-3 px-2 font-mono text-[10.5px] text-l-ink-dim">
      <span className="truncate">{children}</span>
    </span>
  );
}

function formatKind(kind: EnvironmentToolKind) {
  const labels: Record<EnvironmentToolKind, string> = {
    mcp: "MCP server",
    cli: "CLI",
    api: "API shim",
    database: "Database",
    filesystem: "Filesystem",
  };
  return labels[kind];
}

function formatMode(mode: EnvironmentToolMode) {
  const labels: Record<EnvironmentToolMode, string> = {
    "sandboxed-writes": "Sandboxed writes",
    "read-only": "Read only",
    mocked: "Mocked",
    "replay-backed": "Replay backed",
  };
  return labels[mode];
}
