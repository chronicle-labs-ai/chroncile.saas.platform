"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Eyebrow } from "../primitives/eyebrow";
import { Input } from "../primitives/input";
import { Modal } from "../primitives/modal";
import { SourceGlyph } from "../icons/source-glyph";
import { ArrowLeftIcon, ArrowRightIcon } from "../icons/glyphs";
import { AuthDisplay, AuthLede } from "../auth/_internal";
import { cx } from "../utils/cx";
import {
  SOURCES,
  getSource,
  type Source,
  type SourceCategory,
  type SourceId,
} from "./data";
import {
  ConnectShared,
  ConnectStripe,
  ConnectSlack,
  ConnectHubSpot,
  ConnectReverseWebhook,
  ConnectWizard,
} from "../connectors";

/*
 * StepConnect — `list` variant of the Connect step.
 *
 * Layout:
 *   1. Header (eyebrow / display / lede).
 *   2. Sandbox banner (when sandbox === true).
 *   3. Detected shelf — only when intendedSources is non-empty (or
 *      sandbox is on); shows priority sources as compact rows with
 *      inline backfill state.
 *   4. Library — search bar + sources grouped by category, each
 *      category collapsible with a 2-col tile grid.
 *   5. Status bar + Continue.
 *
 * Connecting opens `<ConnectModal>` which dispatches on
 * `Source.auth` (oauth / apikey / webhook) and offers an inline
 * `<BackfillConfig>` block when the source has a backfill spec.
 */

/* ── Connection + backfill state shape ─────────────────────── */

export interface BackfillRunConfig {
  /** Lookback window in days. */
  windowDays: number;
  /** Subset of entity ids the user picked. */
  entities: string[];
  /** Estimator output. */
  estEvents: number;
}

export interface BackfillRun extends BackfillRunConfig {
  status: "running" | "done";
  /** Progress 0..1 — drives the inline progress strip. */
  progress: number;
}

export interface ConnectState {
  /** Connected source ids. */
  connected: SourceId[];
  /** Per-source backfill run state. */
  backfills: Partial<Record<SourceId, BackfillRun>>;
  /** Sources detected from describe-step parse. Drives the shelf. */
  intendedSources?: SourceId[];
  /** Whether the user took the sandbox off-ramp. */
  sandbox?: boolean;
}

export interface StepConnectProps {
  value: ConnectState;
  onChange: (next: ConnectState) => void;
  onNext?: () => void;
  onBack?: () => void;
  /** Override the catalog (e.g. only the rows your backend supports). */
  sources?: readonly Source[];
}

const CAT_ORDER: SourceCategory[] = [
  "Support",
  "Commerce",
  "Billing",
  "CRM",
  "Messaging",
  "Email",
  "Analytics",
  "Warehouse",
  "Database",
  "Stream",
  "Product",
  "Docs",
  "Custom",
];

/**
 * Onboarding step 02 — source library + detected-shelf + the
 * connector-modal launcher. Connecting opens a per-source modal
 * (OAuth / API-key / webhook) with optional inline backfill
 * configuration via `BackfillConfig`.
 */
export function StepConnect({
  value,
  onChange,
  onNext,
  onBack,
  sources = SOURCES,
}: StepConnectProps) {
  const [query, setQuery] = React.useState("");
  const [openCats, setOpenCats] = React.useState<Set<string>>(new Set());
  const [connecting, setConnecting] = React.useState<SourceId | null>(null);
  const [backfillTarget, setBackfillTarget] = React.useState<SourceId | null>(
    null
  );
  const [expandedRow, setExpandedRow] = React.useState<SourceId | null>(null);

  /* ── Sandbox auto-connect ─────────────────────────────── */
  const initRef = React.useRef(false);
  React.useEffect(() => {
    if (!value.sandbox || initRef.current) return;
    if (value.connected.length > 0) {
      initRef.current = true;
      return;
    }
    const ids: SourceId[] =
      value.intendedSources && value.intendedSources.length > 0
        ? value.intendedSources
        : (["intercom", "shopify", "stripe"] as SourceId[]);
    const bf: Partial<Record<SourceId, BackfillRun>> = {};
    for (const id of ids) {
      const src = getSource(id);
      if (src?.backfill) {
        bf[id] = {
          status: "done",
          progress: 1,
          windowDays: 30,
          entities: src.backfill.entities.map((e) => e.id),
          estEvents: 1240,
        };
      }
    }
    initRef.current = true;
    onChange({ ...value, connected: ids, backfills: bf });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.sandbox]);

  /* ── Tick running backfills ───────────────────────────── */
  React.useEffect(() => {
    const running = (
      Object.entries(value.backfills) as [SourceId, BackfillRun][]
    ).filter(([, b]) => b?.status === "running");
    if (!running.length) return;
    const id = setInterval(() => {
      const next = { ...value.backfills };
      let changed = false;
      for (const [sid] of running) {
        const cur = next[sid];
        if (!cur || cur.status !== "running") continue;
        const p = Math.min(1, cur.progress + 0.04 + Math.random() * 0.05);
        next[sid] = {
          ...cur,
          progress: p,
          status: p >= 1 ? "done" : "running",
        };
        changed = true;
      }
      if (changed) onChange({ ...value, backfills: next });
    }, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.backfills]);

  /* ── Derived ──────────────────────────────────────────── */
  const intended = new Set<SourceId>(value.intendedSources ?? []);
  const detectedSources = sources.filter(
    (s) =>
      intended.has(s.id) ||
      (value.sandbox && value.connected.includes(s.id) && intended.size === 0)
  );
  const inDetected = new Set(detectedSources.map((s) => s.id));

  const filteredAll = sources.filter(
    (s) =>
      !query ||
      `${s.name} ${s.cat} ${s.blurb}`
        .toLowerCase()
        .includes(query.toLowerCase())
  );
  const libSources = filteredAll.filter((s) => !inDetected.has(s.id));
  const groups: Partial<Record<SourceCategory, Source[]>> = {};
  for (const s of libSources) {
    (groups[s.cat] = groups[s.cat] ?? []).push(s);
  }
  const orderedCats = [
    ...CAT_ORDER.filter((c) => groups[c]),
    ...(Object.keys(groups) as SourceCategory[]).filter(
      (c) => !CAT_ORDER.includes(c)
    ),
  ];

  /* Auto-open all categories when there's a search. */
  React.useEffect(() => {
    if (!query) return;
    setOpenCats(new Set(orderedCats));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  /* ── Handlers ─────────────────────────────────────────── */
  const toggleCat = (c: string) => {
    setOpenCats((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  };

  const onConnectDone = (id: SourceId, bf: BackfillRunConfig | null) => {
    const nextConn = value.connected.includes(id)
      ? value.connected
      : [...value.connected, id];
    const nextBfs = bf
      ? {
          ...value.backfills,
          [id]: { ...bf, status: "running" as const, progress: 0 },
        }
      : value.backfills;
    onChange({ ...value, connected: nextConn, backfills: nextBfs });
    setConnecting(null);
  };

  const startBackfill = (id: SourceId, cfg: BackfillRunConfig) => {
    onChange({
      ...value,
      backfills: {
        ...value.backfills,
        [id]: { ...cfg, status: "running", progress: 0 },
      },
    });
    setBackfillTarget(null);
  };

  const disconnect = (id: SourceId) => {
    const { [id]: _, ...restBf } = value.backfills;
    void _;
    onChange({
      ...value,
      connected: value.connected.filter((x) => x !== id),
      backfills: restBf,
    });
  };

  const numConnected = value.connected.length;
  const numRunning = Object.values(value.backfills).filter(
    (b) => b?.status === "running"
  ).length;
  const totalQueued = Object.values(value.backfills).reduce(
    (a, b) => a + (b?.estEvents ?? 0),
    0
  );

  const lede = value.sandbox
    ? "We've pre-connected three sample sources so you can keep exploring. Swap them for the real thing whenever you're ready."
    : intended.size > 0
      ? `We spotted ${intended.size} source${intended.size === 1 ? "" : "s"} in your description. Authorize them first — add more below.`
      : "Pick the systems your agent reads from or writes to. Start with one — you can always add more.";

  return (
    <div className="flex flex-col">
      <Eyebrow>Step 02</Eyebrow>
      <AuthDisplay>
        Connect your <em>data</em>.
      </AuthDisplay>
      <AuthLede>{lede}</AuthLede>

      {/* Sandbox banner */}
      {value.sandbox ? (
        <div className="cg-fade-up cg-fade-up-1 mt-s-4 flex items-center gap-s-3 rounded-sm border border-ember/40 bg-ember/[0.04] px-s-3 py-s-2">
          <span className="font-mono text-mono-sm uppercase tracking-tactical text-ember">
            SANDBOX
          </span>
          <span className="font-mono text-mono text-ink-lo flex-1">
            Sample events from Intercom, Shopify and Stripe.
          </span>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => {
              onChange({
                ...value,
                sandbox: false,
                intendedSources: [],
                connected: [],
                backfills: {},
              });
              initRef.current = false;
            }}
          >
            Exit
          </Button>
        </div>
      ) : null}

      {/* Detected shelf */}
      {detectedSources.length > 0 ? (
        <section className="cg-fade-up cg-fade-up-2 mt-s-6">
          <SectionHeader
            label={
              value.sandbox && intended.size === 0
                ? "Sample sources"
                : "Detected from your description"
            }
            tone="ember"
            count={detectedSources.length}
          />
          <div className="mt-s-3 flex flex-col gap-s-2">
            {detectedSources.map((s) => (
              <SourceRow
                key={s.id}
                source={s}
                isConnected={value.connected.includes(s.id)}
                wasIntended={intended.has(s.id)}
                backfill={value.backfills[s.id]}
                expanded={expandedRow === s.id}
                onToggleExpand={() =>
                  setExpandedRow((x) => (x === s.id ? null : s.id))
                }
                onConnect={() => setConnecting(s.id)}
                onDisconnect={() => disconnect(s.id)}
                onStartBackfill={() => setBackfillTarget(s.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Library */}
      <section
        className={cx(
          "cg-fade-up cg-fade-up-3",
          detectedSources.length > 0 ? "mt-s-8" : "mt-s-6"
        )}
      >
        <div className="mb-s-3 flex items-center justify-between gap-s-3">
          <SectionHeader
            label={
              detectedSources.length > 0
                ? "Or browse the catalog"
                : "Source catalog"
            }
            count={sources.length - detectedSources.length}
          />
          <div className="w-[240px]">
            <Input
              density="compact"
              search
              placeholder={`Search ${sources.length} sources`}
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
          </div>
        </div>

        <div className="flex flex-col">
          {orderedCats.length === 0 && query ? (
            <div className="py-s-5 text-center font-mono text-mono text-ink-dim">
              No sources match &ldquo;{query}&rdquo;.
            </div>
          ) : null}
          {orderedCats.map((cat) => {
            const items = groups[cat] ?? [];
            const isOpen = openCats.has(cat) || !!query;
            const anyConnected = items.some((s) =>
              value.connected.includes(s.id)
            );
            const numCatConnected = items.filter((s) =>
              value.connected.includes(s.id)
            ).length;
            return (
              <div key={cat} className="border-t border-hairline py-s-2">
                <button
                  type="button"
                  onClick={() => toggleCat(cat)}
                  className="flex w-full items-center gap-s-2 py-[2px] text-left"
                >
                  <span
                    className={cx(
                      "inline-block w-[12px] font-mono text-mono-sm text-ink-dim transition-transform duration-fast",
                      isOpen ? "rotate-90" : "rotate-0"
                    )}
                    aria-hidden
                  >
                    ›
                  </span>
                  <span className="flex-1 font-sans text-[13.5px] text-ink-hi">
                    {cat}
                  </span>
                  <span className="font-mono text-mono-sm text-ink-dim">
                    {anyConnected ? (
                      <span className="mr-s-2 text-event-green">
                        ● {numCatConnected} connected
                      </span>
                    ) : null}
                    {items.length}
                  </span>
                </button>
                {isOpen ? (
                  <div className="mt-s-2 grid grid-cols-2 gap-s-2 pl-s-5">
                    {items.map((s) => (
                      <SourceTile
                        key={s.id}
                        source={s}
                        isConnected={value.connected.includes(s.id)}
                        backfill={value.backfills[s.id]}
                        onConnect={() => setConnecting(s.id)}
                        onDisconnect={() => disconnect(s.id)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          <div className="border-t border-hairline" />
        </div>
      </section>

      {/* Connect modal */}
      {connecting ? (
        <ConnectModal
          source={getSource(connecting)!}
          onClose={() => setConnecting(null)}
          onDone={onConnectDone}
        />
      ) : null}

      {/* Re-config backfill modal */}
      {backfillTarget ? (
        <BackfillModal
          source={getSource(backfillTarget)!}
          existing={value.backfills[backfillTarget]}
          onClose={() => setBackfillTarget(null)}
          onStart={(cfg) => startBackfill(backfillTarget, cfg)}
        />
      ) : null}

      {/* Summary + Continue */}
      <div className="cg-step-foot flex-col items-stretch gap-s-3">
        {numConnected > 0 ? (
          <div className="flex flex-wrap items-center gap-s-3 rounded-sm border border-hairline bg-surface-01 px-s-3 py-s-2">
            <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
              READY
            </span>
            <span className="inline-flex items-center gap-[6px] font-mono text-mono text-ink-hi">
              <span className="h-[6px] w-[6px] rounded-pill bg-event-green" />
              {numConnected} source{numConnected === 1 ? "" : "s"} live
            </span>
            {numRunning > 0 ? (
              <span className="inline-flex items-center gap-[6px] font-mono text-mono text-ink-lo">
                <span className="cg-pulse-ember h-[6px] w-[6px] rounded-pill bg-ember" />
                {numRunning} backfilling
              </span>
            ) : null}
            {totalQueued > 0 ? (
              <span className="ml-auto font-mono text-mono text-ink-dim">
                ~{totalQueued.toLocaleString()} events queued
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onPress={onBack}
            leadingIcon={<ArrowLeftIcon />}
          >
            Back
          </Button>
          <Button
            variant="ember"
            onPress={onNext}
            isDisabled={numConnected === 0}
            trailingIcon={<ArrowRightIcon />}
          >
            Continue {numConnected > 0 ? `· ${numConnected}` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Helpers ─────────────── */

function SectionHeader({
  label,
  count,
  tone,
}: {
  label: React.ReactNode;
  count?: number;
  tone?: "ember";
}) {
  return (
    <div className="flex items-baseline gap-s-2">
      <span
        className={cx(
          "font-mono text-mono uppercase tracking-eyebrow",
          tone === "ember" ? "text-ember" : "text-ink-dim"
        )}
      >
        {label}
      </span>
      {count != null ? (
        <span className="font-mono text-mono-sm text-ink-dim">{count}</span>
      ) : null}
    </div>
  );
}

interface SourceRowProps {
  source: Source;
  isConnected: boolean;
  wasIntended: boolean;
  backfill: BackfillRun | undefined;
  expanded: boolean;
  onToggleExpand: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onStartBackfill: () => void;
}

function SourceRow({
  source,
  isConnected,
  wasIntended,
  backfill,
  expanded,
  onToggleExpand,
  onConnect,
  onDisconnect,
  onStartBackfill,
}: SourceRowProps) {
  const hasBf = !!source.backfill;
  const running = backfill?.status === "running";
  const bfDone = backfill?.status === "done";

  const accent = isConnected
    ? "border-event-green/30 bg-event-green/[0.03]"
    : wasIntended
      ? "border-ember/35 bg-ember/[0.04]"
      : "border-hairline bg-surface-01";

  return (
    <div className={cx("rounded-sm border", accent)}>
      <div className="flex items-center gap-s-3 px-s-3 py-s-3">
        <span
          className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-sm border border-hairline bg-white/[0.03]"
          style={{ color: source.color }}
        >
          <SourceGlyph id={source.glyph} size={16} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <div className="flex items-center gap-s-2">
            <span className="font-sans text-[14px] text-ink-hi">
              {source.name}
            </span>
            {wasIntended && !isConnected ? (
              <span className="font-mono text-mono-sm uppercase tracking-tactical text-ember">
                DETECTED
              </span>
            ) : null}
            {isConnected ? (
              <span className="inline-flex items-center gap-[4px] font-mono text-mono-sm uppercase tracking-tactical text-event-green">
                <span className="h-[5px] w-[5px] rounded-pill bg-event-green" />
                LIVE
              </span>
            ) : null}
            {isConnected && running ? (
              <span className="font-mono text-mono-sm uppercase tracking-tactical text-ember">
                BACKFILLING {Math.round((backfill!.progress ?? 0) * 100)}%
              </span>
            ) : null}
            {isConnected && bfDone ? (
              <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
                {(backfill!.estEvents ?? 0).toLocaleString()} historical events
              </span>
            ) : null}
          </div>
          <span className="font-mono text-mono-sm text-ink-dim">
            {source.blurb}
          </span>
        </div>
        {isConnected ? (
          <>
            {hasBf ? (
              <Button
                variant="ghost"
                size="sm"
                onPress={onToggleExpand}
                aria-label="More options"
              >
                ⋯
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onPress={onDisconnect}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button
            variant={wasIntended ? "ember" : "secondary"}
            size="sm"
            onPress={onConnect}
          >
            {source.auth === "oauth"
              ? "Connect"
              : source.auth === "apikey"
                ? "Add key"
                : "Configure"}
          </Button>
        )}
      </div>

      {/* Running progress strip */}
      {isConnected && hasBf && running ? (
        <div className="h-[2px] overflow-hidden border-t border-hairline bg-surface-02">
          <div
            className="h-full bg-ember transition-[width] duration-500 ease-linear"
            style={{ width: `${(backfill!.progress ?? 0) * 100}%` }}
          />
        </div>
      ) : null}

      {/* Expanded backfill drawer */}
      {expanded && isConnected && hasBf ? (
        <div className="flex items-center gap-s-3 border-t border-hairline pl-[60px] pr-s-3 py-s-2">
          {bfDone ? (
            <>
              <span className="flex-1 font-mono text-mono-sm text-ink-dim">
                Last {backfill!.windowDays}d imported ·{" "}
                {(backfill!.estEvents ?? 0).toLocaleString()} events
              </span>
              <Button variant="ghost" size="sm" onPress={onStartBackfill}>
                Extend window
              </Button>
            </>
          ) : null}
          {!backfill ? (
            <>
              <span className="flex-1 font-mono text-mono-sm text-ink-dim">
                History available — last {source.backfill?.maxDays}d
              </span>
              <Button variant="ember" size="sm" onPress={onStartBackfill}>
                Backfill →
              </Button>
            </>
          ) : null}
          {running ? (
            <span className="flex-1 font-mono text-mono-sm text-ink-dim">
              Importing…{" "}
              {Math.round(
                (backfill!.progress ?? 0) * (backfill!.estEvents ?? 1000)
              ).toLocaleString()}{" "}
              / {(backfill!.estEvents ?? 1000).toLocaleString()}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface SourceTileProps {
  source: Source;
  isConnected: boolean;
  backfill: BackfillRun | undefined;
  onConnect: () => void;
  onDisconnect: () => void;
}

function SourceTile({
  source,
  isConnected,
  backfill,
  onConnect,
  onDisconnect,
}: SourceTileProps) {
  const running = backfill?.status === "running";
  return (
    <div
      className={cx(
        "flex min-w-0 items-center gap-s-2 rounded-sm border px-s-3 py-s-2",
        isConnected
          ? "border-event-green/30 bg-event-green/[0.03]"
          : "border-hairline bg-surface-01"
      )}
    >
      <span
        className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-sm border border-hairline bg-white/[0.03]"
        style={{ color: source.color }}
      >
        <SourceGlyph id={source.glyph} size={13} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
        <div className="flex items-center gap-[6px]">
          <span className="truncate font-sans text-[13px] text-ink-hi">
            {source.name}
          </span>
          {isConnected ? (
            <span className="h-[5px] w-[5px] shrink-0 rounded-pill bg-event-green" />
          ) : null}
          {running ? (
            <span className="font-mono text-mono-sm uppercase tracking-tactical text-ember">
              SYNC
            </span>
          ) : null}
        </div>
        <span className="truncate font-mono text-mono-sm text-ink-dim">
          {source.blurb}
        </span>
      </div>
      {isConnected ? (
        <Button variant="ghost" size="sm" onPress={onDisconnect}>
          Remove
        </Button>
      ) : (
        <Button variant="secondary" size="sm" onPress={onConnect}>
          +
        </Button>
      )}
    </div>
  );
}

/* ─────────────── ConnectModal — dispatcher ─────────────── */

const PRESETS = [7, 30, 90, 365] as const;

interface ConnectModalProps {
  source: Source;
  onClose: () => void;
  onDone: (id: SourceId, bf: BackfillRunConfig | null) => void;
}

/**
 * Dispatcher that picks an archetype modal based on `source.id`.
 * The archetypes live in `../connectors/` — keep this switch in sync
 * when adding new vendor-specific flows. Anything that isn't matched
 * falls back to `ConnectShared` (the OAuth/API-key/webhook generic).
 */
function ConnectModal({ source, onClose, onDone }: ConnectModalProps) {
  switch (source.id) {
    case "stripe":
      return (
        <ConnectStripe source={source} onClose={onClose} onDone={onDone} />
      );
    case "slack":
      return <ConnectSlack source={source} onClose={onClose} onDone={onDone} />;
    case "hubspot":
      return (
        <ConnectHubSpot source={source} onClose={onClose} onDone={onDone} />
      );
    case "salesforce":
      return (
        <ConnectWizard source={source} onClose={onClose} onDone={onDone} />
      );
    case "webhooks":
    case "http":
      return (
        <ConnectReverseWebhook
          source={source}
          onClose={onClose}
          onDone={onDone}
        />
      );
    default:
      return (
        <ConnectShared source={source} onClose={onClose} onDone={onDone} />
      );
  }
}

interface BackfillConfigProps {
  spec: NonNullable<Source["backfill"]>;
  enabled: boolean;
  onToggleEnabled: (next: boolean) => void;
  windowDays: number;
  onWindowChange: (next: number) => void;
  entities: string[];
  onEntitiesChange: (next: string[]) => void;
  estEvents: number;
}

/**
 * Inline backfill configuration block surfaced inside connector
 * modals. Toggle on/off, lookback slider, per-entity slice
 * checkboxes, and a live event-count estimator.
 */
export function BackfillConfig({
  spec,
  enabled,
  onToggleEnabled,
  windowDays,
  onWindowChange,
  entities,
  onEntitiesChange,
  estEvents,
}: BackfillConfigProps) {
  const toggleEntity = (id: string) => {
    onEntitiesChange(
      entities.includes(id)
        ? entities.filter((e) => e !== id)
        : [...entities, id]
    );
  };

  return (
    <div className="flex flex-col gap-s-4">
      <label className="flex items-center gap-s-3 rounded-sm border border-hairline bg-surface-02 px-s-3 py-s-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggleEnabled(e.target.checked)}
          className="h-4 w-4 accent-ember"
        />
        <span className="flex-1 font-sans text-[13px] text-ink">
          Backfill the last{" "}
          <b className="text-ink-hi font-medium">{windowDays} days</b>
        </span>
        <span className="font-mono text-mono-sm text-ink-dim">
          ~{estEvents.toLocaleString()} events
        </span>
      </label>

      {enabled ? (
        <>
          <div>
            <div className="mb-s-2 font-mono text-mono uppercase tracking-tactical text-ink-dim">
              Lookback window
            </div>
            <div className="flex flex-wrap gap-[6px]">
              {PRESETS.filter((p) => p <= spec.maxDays).map((p) => (
                <Button
                  key={p}
                  variant={windowDays === p ? "ember" : "secondary"}
                  size="sm"
                  onPress={() => onWindowChange(p)}
                >
                  {p}d
                </Button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-s-2 font-mono text-mono uppercase tracking-tactical text-ink-dim">
              Entities
            </div>
            <div className="flex flex-col gap-[6px]">
              {spec.entities.map((e) => (
                <label
                  key={e.id}
                  className="flex cursor-pointer items-center gap-s-2 rounded-sm border border-hairline bg-surface-02 px-s-3 py-s-2"
                >
                  <input
                    type="checkbox"
                    checked={entities.includes(e.id)}
                    onChange={() => toggleEntity(e.id)}
                    className="h-4 w-4 accent-ember"
                  />
                  <span className="flex-1 font-sans text-[13px] text-ink">
                    {e.label}
                  </span>
                  <span className="font-mono text-mono-sm text-ink-dim">
                    ~{e.est}/day
                  </span>
                </label>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ─────────────── BackfillModal (re-config existing) ─────────────── */

interface BackfillModalProps {
  source: Source;
  existing?: BackfillRun;
  onClose: () => void;
  onStart: (cfg: BackfillRunConfig) => void;
}

function BackfillModal({
  source,
  existing,
  onClose,
  onStart,
}: BackfillModalProps) {
  const spec = source.backfill;
  const [bfWindow, setBfWindow] = React.useState(
    existing?.windowDays ?? spec?.windowDays ?? 30
  );
  const [bfEntities, setBfEntities] = React.useState<string[]>(
    existing?.entities ?? spec?.entities.map((e) => e.id) ?? []
  );
  const [enabled, setEnabled] = React.useState(true);

  const estEvents = React.useMemo(() => {
    if (!spec) return 0;
    const selected = spec.entities.filter((e) => bfEntities.includes(e.id));
    return Math.round(selected.reduce((a, b) => a + b.est, 0) * bfWindow);
  }, [spec, bfEntities, bfWindow]);

  if (!spec) {
    return (
      <Modal
        isOpen
        onClose={onClose}
        title="Backfill not supported"
        actions={
          <Button variant="ember" onPress={onClose}>
            Close
          </Button>
        }
      >
        <p className="font-sans text-[13.5px] text-ink-lo">
          {source.name} is stream-only — there&rsquo;s no historical window to
          backfill.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Backfill ${source.name}`}
      actions={
        <>
          <Button variant="ghost" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="ember"
            onPress={() =>
              onStart({
                windowDays: bfWindow,
                entities: bfEntities,
                estEvents,
              })
            }
            isDisabled={bfEntities.length === 0}
          >
            Start backfill · {estEvents.toLocaleString()} events
          </Button>
        </>
      }
    >
      <BackfillConfig
        spec={spec}
        enabled={enabled}
        onToggleEnabled={setEnabled}
        windowDays={bfWindow}
        onWindowChange={setBfWindow}
        entities={bfEntities}
        onEntitiesChange={setBfEntities}
        estEvents={estEvents}
      />
    </Modal>
  );
}
