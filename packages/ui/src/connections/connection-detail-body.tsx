"use client";

import * as React from "react";
import {
  Pause,
  Play,
  RefreshCw,
  Activity,
  Trash2,
  KeyRound,
  ExternalLink,
} from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { Chip } from "../primitives/chip";
import { CopyButton } from "../primitives/copy-button";
import { Tabs, TabList, Tab, TabPanel } from "../primitives/tabs";
import { CompanyLogo } from "../icons";
import { InlineAlert } from "../auth/_internal";
import {
  CodeBlock,
  EventRecv,
  FieldRow,
  ReadonlyInput,
  ScopeList,
  type ScopeListItem,
} from "../connectors/_internal";
import { getSource } from "../onboarding/data";
import {
  HUBSPOT_SCOPES,
  REVERSE_WEBHOOK_URL_TEMPLATE,
  SLACK_SCOPES,
  type HubSpotScope,
  type SlackScope,
} from "../connectors/data";
import { ConnectionHealthBadge } from "./connection-health-badge";
import {
  type Connection,
  type ConnectionBackfillRecord,
  type ConnectionDelivery,
  type ConnectionEventTypeSub,
} from "./data";
import {
  RelativeTime,
  formatNumber,
  formatStableDate,
  formatStableDateTime,
  formatStableTime,
} from "./time";

/*
 * ConnectionDetailBody — shared content for both the slide-in drawer
 * and the full-page detail surface. Six tabs:
 *
 *   Overview  — health, last event, scopes summary, primary actions
 *   Scopes    — checkbox editor (vendor scope catalog when known)
 *   Secret    — webhook secret / API key fingerprint + rotate
 *   Backfills — historical run rows + "Run backfill" CTA
 *   Activity  — recent deliveries (200/4xx/5xx) + error payload
 *   Events    — per-event-type toggle list (Stripe-style)
 *
 * Presentational. State lives at the boundary; this body just
 * routes UI events back to the parent via the `on*` props.
 */

export type ConnectionDetailTab =
  | "overview"
  | "scopes"
  | "secret"
  | "backfills"
  | "activity"
  | "events";

export const CONNECTION_DETAIL_TABS: readonly {
  id: ConnectionDetailTab;
  label: string;
}[] = [
  { id: "overview", label: "Overview" },
  { id: "scopes", label: "Scopes" },
  { id: "secret", label: "Secret" },
  { id: "backfills", label: "Backfills" },
  { id: "activity", label: "Activity" },
  { id: "events", label: "Event types" },
];

/**
 * Subset of tabs the drawer shows by default. The drawer is sized for
 * triage (Overview + Activity); the deeper config surfaces (Scopes,
 * Secret, Backfills, Event types) live on the full detail page where
 * they have room to breathe. P0 finding: 6 tabs in a 720px drawer
 * overflowed on narrower viewports.
 */
export const CONNECTION_DRAWER_TABS: readonly ConnectionDetailTab[] = [
  "overview",
  "activity",
];

export interface ConnectionDetailBodyProps {
  connection: Connection;
  /** Active tab id. Defaults to "overview". */
  tab?: ConnectionDetailTab;
  onTabChange?: (next: ConnectionDetailTab) => void;
  /**
   * Subset of tabs to render. Defaults to the full set. Pass
   * `CONNECTION_DRAWER_TABS` (or any custom list) to slim the strip
   * inside narrow surfaces.
   */
  tabs?: readonly ConnectionDetailTab[];
  /** Backfill rows for this connection. */
  backfills?: readonly ConnectionBackfillRecord[];
  /** Recent deliveries for the Activity tab. */
  deliveries?: readonly ConnectionDelivery[];
  /** Event-type subscription rows. Empty array hides the toggle list. */
  events?: readonly ConnectionEventTypeSub[];
  /** Toggle a scope on/off. */
  onToggleScope?: (id: string, next: boolean) => void;
  /** Toggle an event-type subscription. */
  onToggleEvent?: (id: string, next: boolean) => void;
  /** Rotate webhook secret / API key. */
  onRotateSecret?: () => void;
  /** Start a new backfill run. */
  onRunBackfill?: () => void;
  /** Action callbacks (also surfaced in the Overview tab). */
  onPause?: () => void;
  onResume?: () => void;
  onReauth?: () => void;
  onTest?: () => void;
  onDisconnect?: () => void;
  /**
   * Optional handler for the "Open full activity log" affordance in the
   * Activity tab. Omit to hide the link entirely — the previous
   * `href="#"` placeholder hijacked the back-stack and scrolled the page
   * to the top on click.
   */
  onOpenActivityLog?: () => void;
  /**
   * Hide tabs that aren't in the supplied subset and still want to
   * jump to a deeper config surface? Render a small "Configure on
   * detail page" link next to the tab strip. Wired by the drawer.
   */
  onJumpToFullDetail?: (tab: ConnectionDetailTab) => void;
  /** Hide the inner header chrome (used when the parent renders its own). */
  hideHeader?: boolean;
  className?: string;
}

export function ConnectionDetailBody({
  connection,
  tab,
  onTabChange,
  tabs,
  backfills = [],
  deliveries = [],
  events = [],
  onToggleScope,
  onToggleEvent,
  onRotateSecret,
  onRunBackfill,
  onPause,
  onResume,
  onReauth,
  onTest,
  onDisconnect,
  onOpenActivityLog,
  onJumpToFullDetail,
  hideHeader,
  className,
}: ConnectionDetailBodyProps) {
  const src = getSource(connection.source);
  const isPaused = connection.health === "paused";
  const isErrored = connection.health === "error";
  const isExpired = connection.health === "expired";
  const isTesting = connection.lastTestStatus === "pending";

  const visibleTabs = React.useMemo(() => {
    if (!tabs) return CONNECTION_DETAIL_TABS;
    const set = new Set(tabs);
    return CONNECTION_DETAIL_TABS.filter((t) => set.has(t.id));
  }, [tabs]);
  const currentTabId = tab ?? "overview";
  const currentTabVisible = visibleTabs.some((t) => t.id === currentTabId);
  const effectiveTab: ConnectionDetailTab = currentTabVisible
    ? currentTabId
    : visibleTabs[0]?.id ?? "overview";

  return (
    <div className={cx("flex flex-col gap-4", className)}>
      {hideHeader ? null : <DetailHeader connection={connection} />}

      <Tabs
        value={effectiveTab}
        onValueChange={(next) => onTabChange?.(next as ConnectionDetailTab)}
        className="flex flex-col gap-3"
      >
        <TabList>
          {visibleTabs.map((t) => (
            <Tab key={t.id} value={t.id}>
              {t.label}
            </Tab>
          ))}
        </TabList>

        <TabPanel value="overview" className="flex flex-col gap-4">
          {isErrored ? (
            <InlineAlert tone="danger">
              {connection.errorKind === "auth"
                ? "Auth failed — credentials rejected by the upstream API."
                : connection.errorKind === "signature"
                  ? "Recent events failed signature verification."
                  : connection.errorKind === "rate-limit"
                    ? "Upstream rate-limited Chronicle on recent calls."
                    : "Something went wrong with this connection."}
            </InlineAlert>
          ) : null}
          {isExpired ? (
            <InlineAlert tone="warning">
              Token expired{" "}
              {connection.expiresAt
                ? `at ${formatStableDateTime(connection.expiresAt)}`
                : ""}
              . New events buffer upstream until you re-authorize.
            </InlineAlert>
          ) : null}
          {isPaused ? (
            <InlineAlert tone="info">
              Stream paused — new events buffer upstream until you resume.
            </InlineAlert>
          ) : null}

          <SummaryGrid connection={connection} />

          <div className="flex flex-wrap items-center gap-2">
            {isPaused ? (
              <Button
                size="sm"
                variant="primary"
                leadingIcon={<Play className="size-3.5" strokeWidth={1.75} />}
                onPress={onResume}
                isDisabled={!onResume}
              >
                Resume
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                leadingIcon={<Pause className="size-3.5" strokeWidth={1.75} />}
                onPress={onPause}
                isDisabled={!onPause}
              >
                Pause
              </Button>
            )}
            <Button
              size="sm"
              variant={isExpired || isErrored ? "primary" : "secondary"}
              leadingIcon={
                <RefreshCw className="size-3.5" strokeWidth={1.75} />
              }
              onPress={onReauth}
              isDisabled={!onReauth}
            >
              Re-authorize
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leadingIcon={<Activity className="size-3.5" strokeWidth={1.75} />}
              onPress={onTest}
              isDisabled={!onTest}
              isPending={isTesting}
            >
              {isTesting ? "Testing\u2026" : "Test connection"}
            </Button>
          </div>

          {/*
           * Danger zone — pulled out of the primary action row so the
           * destructive button doesn't sit shoulder-to-shoulder with
           * benign actions. Stripe / Linear pattern: visible divider +
           * destructive label below.
           */}
          {onDisconnect ? (
            <DangerZone>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-[2px]">
                  <span className="font-mono text-mono-sm uppercase tracking-tactical text-event-red">
                    Disconnect
                  </span>
                  <span className="font-sans text-[12.5px] text-ink-dim">
                    Stops ingestion and revokes scopes. You'll need to
                    re-authorize from scratch to reconnect.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="critical"
                  leadingIcon={
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                  }
                  onPress={onDisconnect}
                >
                  Disconnect
                </Button>
              </div>
            </DangerZone>
          ) : null}
        </TabPanel>

        <TabPanel value="scopes" className="flex flex-col gap-4">
          <ScopesEditor
            connection={connection}
            onToggleScope={onToggleScope}
            onReauth={onReauth}
          />
        </TabPanel>

        <TabPanel value="secret" className="flex flex-col gap-4">
          <SecretSection
            connection={connection}
            onRotateSecret={onRotateSecret}
          />
        </TabPanel>

        <TabPanel value="backfills" className="flex flex-col gap-4">
          <BackfillsSection
            backfills={backfills}
            onRunBackfill={onRunBackfill}
            sourceSupportsBackfill={!!src?.backfill}
          />
        </TabPanel>

        <TabPanel value="activity" className="flex flex-col gap-4">
          <ActivitySection
            deliveries={deliveries}
            errorPayload={connection.errorPayload}
            onOpenActivityLog={onOpenActivityLog}
          />
        </TabPanel>

        <TabPanel value="events" className="flex flex-col gap-4">
          <EventsSection events={events} onToggleEvent={onToggleEvent} />
        </TabPanel>
      </Tabs>

      {tabs && onJumpToFullDetail ? (
        <HiddenTabsHint
          hiddenTabs={CONNECTION_DETAIL_TABS.filter(
            (t) => !visibleTabs.some((v) => v.id === t.id),
          )}
          onJump={onJumpToFullDetail}
        />
      ) : null}
    </div>
  );
}

/* ── Danger zone wrapper ─────────────────────────────────── */

function DangerZone({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 rounded-[2px] border border-event-red/25 bg-[rgba(239,68,68,0.04)] p-3">
      {children}
    </div>
  );
}

/* ── Hidden-tab hint ─────────────────────────────────────── */

function HiddenTabsHint({
  hiddenTabs,
  onJump,
}: {
  hiddenTabs: readonly { id: ConnectionDetailTab; label: string }[];
  onJump: (tab: ConnectionDetailTab) => void;
}) {
  if (hiddenTabs.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-divider pt-3">
      <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
        Configure
      </span>
      {hiddenTabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onJump(t.id)}
          className="inline-flex items-center gap-1 rounded-xs font-mono text-mono-sm text-ember focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember hover:underline"
        >
          {t.label}
          <ExternalLink className="size-3" strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
}

/* ── Header ──────────────────────────────────────────────── */

function DetailHeader({ connection }: { connection: Connection }) {
  const src = getSource(connection.source);
  return (
    <div className="flex items-center gap-3 border-b border-divider pb-4">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-hairline bg-surface-02"
        aria-hidden
      >
        <CompanyLogo
          name={src?.name ?? connection.name}
          size={22}
          radius={4}
          fallbackBackground="var(--c-surface-02)"
          fallbackColor="var(--c-ink-dim)"
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-display text-[18px] leading-none tracking-[-0.03em] text-ink-hi">
          {connection.name}
        </span>
        <span className="flex min-w-0 items-center gap-2 font-mono text-mono-sm text-ink-dim">
          <span className="truncate">
            {src?.cat ?? "—"} · {src?.auth ?? "—"} · {connection.id}
          </span>
          <CopyButton
            text={connection.id}
            appearance="text"
            label="Copy"
            copiedLabel="Copied"
            aria-label="Copy connection id"
          />
        </span>
      </div>
      <ConnectionHealthBadge health={connection.health} />
    </div>
  );
}

/* ── Overview summary ────────────────────────────────────── */

function SummaryGrid({ connection }: { connection: Connection }) {
  const lastTestedValue = lastTestedSummary(connection);
  const items: { label: string; value: React.ReactNode }[] = [
    {
      label: "Connected",
      value: formatStableDate(connection.connectedAt),
    },
    {
      label: "Last event",
      value: connection.lastEventAt ? (
        <span title={formatStableDateTime(connection.lastEventAt)}>
          <RelativeTime
            iso={connection.lastEventAt}
            fallback={formatStableTime(connection.lastEventAt)}
          />
        </span>
      ) : (
        "—"
      ),
    },
    { label: "Events / 24h", value: formatNumber(connection.eventsLast24h) },
    { label: "Last tested", value: lastTestedValue },
    {
      label: "Owner",
      value: connection.ownerEmail ?? "—",
    },
    {
      label: "Token expires",
      value: formatStableDate(connection.expiresAt),
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col gap-[2px]">
          <dt className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
            {it.label}
          </dt>
          <dd className="font-sans text-[13.5px] tabular-nums text-ink-hi">
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function lastTestedSummary(connection: Connection): React.ReactNode {
  if (connection.lastTestStatus === "pending") {
    return <span className="text-ember">testing now</span>;
  }
  if (!connection.lastTestedAt) return "never";
  const tone =
    connection.lastTestStatus === "fail"
      ? "text-event-red"
      : "text-event-green";
  const label = connection.lastTestStatus === "fail" ? "failed" : "passed";
  return (
    <span
      className="inline-flex items-baseline gap-2"
      title={formatStableDateTime(connection.lastTestedAt)}
    >
      <RelativeTime iso={connection.lastTestedAt} fallback="—" />
      <span className={cx("font-mono text-mono-sm uppercase", tone)}>
        {label}
      </span>
    </span>
  );
}

/* ── Scopes ──────────────────────────────────────────────── */

function ScopesEditor({
  connection,
  onToggleScope,
  onReauth,
}: {
  connection: Connection;
  onToggleScope?: (id: string, next: boolean) => void;
  onReauth?: () => void;
}) {
  const items = scopeCatalogFor(connection);
  const sourceName = getSource(connection.source)?.name ?? "this source";
  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <InlineAlert tone="info">
          Chronicle doesn&rsquo;t maintain a scope catalog for {sourceName}.
          To add or remove scopes, re-authorize and pick the new set on the
          consent screen.
        </InlineAlert>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
            Granted scopes
          </span>
          <span className="break-all font-mono text-mono-sm text-ink-hi">
            {connection.scopes.join(", ") || "none"}
          </span>
        </div>
        {onReauth ? (
          <Button
            size="sm"
            variant="primary"
            leadingIcon={<RefreshCw className="size-3.5" strokeWidth={1.75} />}
            onPress={onReauth}
            className="self-start"
          >
            Re-authorize to edit
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <ScopeList
      items={items}
      selected={connection.scopes}
      onToggle={(id, next) => onToggleScope?.(id, next)}
    />
  );
}

function scopeCatalogFor(connection: Connection): ScopeListItem[] {
  switch (connection.source) {
    case "slack":
      return SLACK_SCOPES.map(
        (s: SlackScope): ScopeListItem => ({
          id: s.id,
          label: s.id,
          reason: s.reason,
          required: s.required,
        }),
      );
    case "hubspot":
      return HUBSPOT_SCOPES.map(
        (s: HubSpotScope): ScopeListItem => ({
          id: s.id,
          label: s.label,
          reason: s.reason,
        }),
      );
    default: {
      if (connection.scopes.length === 0) return [];
      return connection.scopes.map(
        (id): ScopeListItem => ({ id, label: id, reason: "Granted" }),
      );
    }
  }
}

/* ── Secret / endpoint ───────────────────────────────────── */

function SecretSection({
  connection,
  onRotateSecret,
}: {
  connection: Connection;
  onRotateSecret?: () => void;
}) {
  const src = getSource(connection.source);
  const isWebhook = src?.auth === "webhook";
  const isOauth = src?.auth === "oauth";

  const endpoint = REVERSE_WEBHOOK_URL_TEMPLATE.replace(
    "{tenant}",
    connection.id,
  );
  const sampleSecret = `whsec_${connection.id}_${Math.abs(hash(connection.id)).toString(36)}`;
  const sampleKey = `sk_live_${Math.abs(hash(connection.id + "key")).toString(36).padStart(24, "0")}`;

  return (
    <div className="flex flex-col gap-4">
      {isWebhook ? (
        <FieldRow
          label="Ingest endpoint"
          help="Send any JSON to this URL — Chronicle normalizes and streams it."
        >
          <ReadonlyInput value={endpoint} />
        </FieldRow>
      ) : null}

      <FieldRow
        label={isWebhook ? "Signing secret" : isOauth ? "Refresh token" : "API key"}
        hint={
          <span className="inline-flex items-center gap-2">
            {onRotateSecret ? (
              <button
                type="button"
                onClick={onRotateSecret}
                className="inline-flex items-center gap-1 font-mono text-mono-sm text-ember hover:underline"
              >
                <KeyRound className="size-3" strokeWidth={1.75} />
                Rotate
              </button>
            ) : null}
          </span>
        }
        help="Stored encrypted. Reveal copies the secret to the system clipboard."
      >
        <ReadonlyInput
          value={isWebhook ? sampleSecret : sampleKey}
          secret
          reveal={false}
        />
      </FieldRow>

      {isOauth ? (
        <p className="font-sans text-[12.5px] leading-5 text-ink-dim">
          Chronicle uses OAuth refresh tokens for {src?.name}. Rotation
          re-runs the consent screen and replaces the stored token without
          interrupting ingestion.
        </p>
      ) : null}
    </div>
  );
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(31, h) + s.charCodeAt(i);
  }
  return h | 0;
}

/* ── Backfills ───────────────────────────────────────────── */

function BackfillsSection({
  backfills,
  onRunBackfill,
  sourceSupportsBackfill,
}: {
  backfills: readonly ConnectionBackfillRecord[];
  onRunBackfill?: () => void;
  sourceSupportsBackfill: boolean;
}) {
  if (!sourceSupportsBackfill) {
    return (
      <p className="font-sans text-[13px] text-ink-lo">
        This source is stream-only — there is no historical window to
        backfill.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
          <span className="tabular-nums">{backfills.length}</span> run
          {backfills.length === 1 ? "" : "s"}
        </span>
        <Button
          size="sm"
          variant="primary"
          onPress={onRunBackfill}
          isDisabled={!onRunBackfill}
        >
          Run new backfill
        </Button>
      </div>
      {backfills.length === 0 ? (
        <p className="font-sans text-[13px] text-ink-dim">
          No backfill runs yet.
        </p>
      ) : (
        // Currently flat; switch to `<Virtuoso>` if/when a tenant
        // exceeds ~50 historical runs (P2 from the connections review).
        <ul className="flex flex-col gap-2">
          {backfills.map((bf) => (
            <li
              key={bf.id}
              className="grid grid-cols-[110px_minmax(0,1fr)_120px_80px] items-center gap-3 rounded-[2px] border border-divider bg-wash-micro px-3 py-2"
            >
              <span className="font-mono text-mono-sm text-ink-dim">
                {formatStableDate(bf.startedAt)}
              </span>
              <span className="truncate font-mono text-mono-sm text-ink-lo">
                {bf.windowDays}d · {bf.entities.join(", ") || "—"}
              </span>
              <span className="font-mono text-mono-sm tabular-nums text-ink-lo">
                {formatNumber(bf.estEvents)} events
              </span>
              <span
                className={cx(
                  "font-mono text-mono-sm uppercase tracking-tactical",
                  bf.status === "done"
                    ? "text-event-green"
                    : bf.status === "failed"
                      ? "text-event-red"
                      : "text-ember",
                )}
              >
                {bf.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Activity ────────────────────────────────────────────── */

function ActivitySection({
  deliveries,
  errorPayload,
  onOpenActivityLog,
}: {
  deliveries: readonly ConnectionDelivery[];
  errorPayload?: string;
  onOpenActivityLog?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {errorPayload ? (
        <FieldRow label="Most recent failure">
          <CodeBlock code={errorPayload} caption="Last failed payload" />
        </FieldRow>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
            Recent deliveries
          </span>
          <span className="font-mono text-mono-sm tabular-nums text-ink-dim">
            {deliveries.length}
          </span>
        </div>
        {deliveries.length === 0 ? (
          <p className="font-sans text-[13px] text-ink-dim">
            No recent deliveries.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {deliveries.map((d, i) => (
              <EventRecv
                key={`${d.ts}-${i}`}
                ts={d.ts}
                method={d.method}
                preview={d.preview}
                status={d.status}
              />
            ))}
          </div>
        )}
      </div>

      {onOpenActivityLog ? (
        <button
          type="button"
          onClick={onOpenActivityLog}
          className="inline-flex w-fit items-center gap-1 rounded-xs font-mono text-mono-sm text-ember focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember hover:underline"
        >
          Open full activity log
          <ExternalLink className="size-3" strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  );
}

/* ── Event-type subscriptions ────────────────────────────── */

function EventsSection({
  events,
  onToggleEvent,
}: {
  events: readonly ConnectionEventTypeSub[];
  onToggleEvent?: (id: string, next: boolean) => void;
}) {
  if (events.length === 0) {
    return (
      <p className="font-sans text-[13px] text-ink-lo">
        Per-event subscription isn&rsquo;t available for this source.
        Chronicle ingests every event the upstream sends.
      </p>
    );
  }
  const grouped = new Map<string, ConnectionEventTypeSub[]>();
  for (const e of events) {
    const k = e.object ?? "—";
    const arr = grouped.get(k) ?? [];
    arr.push(e);
    grouped.set(k, arr);
  }
  const enabledCount = events.filter((e) => e.enabled).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
          <span className="tabular-nums">{enabledCount}</span> of{" "}
          <span className="tabular-nums">{events.length}</span> enabled
        </span>
      </div>
      {Array.from(grouped.entries()).map(([object, items]) => (
        <div key={object} className="flex flex-col gap-2">
          <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
            {object}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {items.map((e) => (
              <Chip
                key={e.id}
                active={e.enabled}
                aria-pressed={e.enabled}
                onClick={() => onToggleEvent?.(e.id, !e.enabled)}
                className="font-mono"
              >
                {e.id}
              </Chip>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
