"use client";

import * as React from "react";
import {
  Activity,
  Beaker,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Fingerprint,
  GitBranch,
  Hash,
  Layers as LayersIcon,
  MessageSquare,
  Repeat,
  Sparkles,
  User,
  X,
} from "lucide-react";

import { cx } from "../utils/cx";
import { CompanyLogo } from "../icons/brand-icons";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../primitives/collapsible";
import { CopyButton } from "../primitives/copy-button";
import { DatasetPicker } from "./dataset-picker";
import { sourceColor, sourceTintedBackground } from "./source-color";
import type {
  AddTraceToDatasetHandler,
  Dataset,
  DatasetPurpose,
  StreamTimelineEvent,
  TraceDatasetMembership,
} from "./types";

export interface StreamEventDetailProps {
  event: StreamTimelineEvent | null;
  className?: string;
  /** When true, the JSON payload section is open by default. */
  defaultPayloadOpen?: boolean;
  /**
   * When provided, renders an X button in the header that calls this
   * handler. Wire to the viewer to clear the selection and dismiss the
   * inline detail sidebar.
   */
  onClose?: () => void;
  /**
   * All events on the same trace as `event`, sorted by `occurredAt`
   * ascending. When two or more entries are present, the panel shows
   * a unified view with a navigable trace list above the event
   * details and prev/next stepping in the header. Pass an empty
   * array (or `undefined`) for trace-of-one events.
   */
  traceEvents?: readonly StreamTimelineEvent[];
  /** Click handler fired when the user picks an event from the trace
   *  list or the prev/next buttons. Wire to your selection state. */
  onSelectTraceEvent?: (event: StreamTimelineEvent) => void;
  /**
   * Datasets the user can add the active trace (or trace-of-one) to.
   * Combined with `onAddTraceToDataset`, drives the bottom-right
   * "Add trace" call-to-action.
   */
  datasets?: readonly Dataset[];
  /** Handler fired when the user confirms adding to a dataset. */
  onAddTraceToDataset?: AddTraceToDatasetHandler;
  /**
   * Datasets the active trace is already a member of. When non-empty,
   * the sidebar grows an `In datasets` section above the details and
   * the footer shows an inline membership count. The picker also
   * tags these datasets with an `Added` check so the user doesn't
   * accidentally re-add the trace.
   */
  traceDatasetMemberships?: readonly TraceDatasetMembership[];
}

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const traceItemTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * StreamEventDetail — Linear-density inspector for a selected event.
 *
 * Visual model (modelled on Linear's right-side issue inspector):
 *
 *   1. Header — compact 40 px chrome with parent breadcrumb,
 *      prev/next stepper through the trace, copy id, close.
 *   2. Trace strip — when the event is part of a trace of >1
 *      events, a navigable list shows every sibling. Active row
 *      highlighted; clicks fire `onSelectTraceEvent`.
 *   3. Details section — Linear-style label/value rows. The label
 *      column is fixed at 92 px; the value column fills with an
 *      icon + text + optional inline action.
 *   4. Payload section — collapsible JSON viewer with an eyebrow
 *      header matching Linear's "Sub-issues" treatment.
 *   5. Footer — dataset CTA when both `datasets` and
 *      `onAddTraceToDataset` are provided.
 */
export function StreamEventDetail({
  event,
  className,
  defaultPayloadOpen = false,
  onClose,
  traceEvents,
  onSelectTraceEvent,
  datasets,
  onAddTraceToDataset,
  traceDatasetMemberships,
}: StreamEventDetailProps) {
  const payloadJson = React.useMemo(
    () => JSON.stringify(event?.payload ?? {}, null, 2),
    [event?.payload],
  );

  if (!event) {
    return (
      <div
        className={cx(
          "flex flex-col bg-l-surface-bar text-l-ink",
          className,
        )}
      >
        {onClose ? <DetailHeader onClose={onClose} /> : null}
        <div className="flex flex-1 items-center justify-center p-s-4 font-sans text-[12px] text-l-ink-dim">
          Select an event to view details
        </div>
      </div>
    );
  }

  const path = `${event.source}/${event.type}`;
  const occurredAtMs = new Date(event.occurredAt).getTime();
  const tint = sourceTintedBackground(sourceColor(event.source), 22);

  const traceList = traceEvents ?? [];
  const hasTrace = traceList.length > 1;
  const traceLabel =
    event.traceLabel ??
    traceList.find((e) => e.traceLabel)?.traceLabel ??
    (event.traceId ? event.traceId.replace(/^trace_/, "Trace ") : null);

  const activeIndex = hasTrace
    ? traceList.findIndex((e) => e.id === event.id)
    : -1;
  const prevEvent =
    hasTrace && activeIndex > 0 ? traceList[activeIndex - 1] : null;
  const nextEvent =
    hasTrace && activeIndex >= 0 && activeIndex < traceList.length - 1
      ? traceList[activeIndex + 1]
      : null;

  const showDatasetCta =
    Boolean(onAddTraceToDataset) && (datasets?.length ?? 0) > 0;
  const datasetCtaCount = Math.max(1, traceList.length);

  return (
    <div
      className={cx("flex flex-col bg-l-surface-bar text-l-ink", className)}
    >
      <DetailHeader
        onClose={onClose}
        title={event.type}
        breadcrumb={
          <>
            <CompanyLogo
              name={event.source}
              size={12}
              radius={2}
              fallbackBackground={tint}
              fallbackColor="var(--c-ink-hi)"
              aria-hidden
            />
            <span className="font-sans text-[11.5px] text-l-ink-lo">
              {event.source}
            </span>
          </>
        }
        position={
          hasTrace ? `${activeIndex + 1} / ${traceList.length}` : null
        }
        prevEvent={prevEvent ?? null}
        nextEvent={nextEvent ?? null}
        onPrev={
          prevEvent ? () => onSelectTraceEvent?.(prevEvent) : undefined
        }
        onNext={
          nextEvent ? () => onSelectTraceEvent?.(nextEvent) : undefined
        }
        copyId={event.id}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {hasTrace ? (
          <TraceStrip
            events={traceList}
            activeId={event.id}
            traceLabel={traceLabel}
            onSelect={onSelectTraceEvent}
          />
        ) : null}

        {traceDatasetMemberships && traceDatasetMemberships.length > 0 ? (
          <DatasetMembershipsSection memberships={traceDatasetMemberships} />
        ) : null}

        <Section eyebrow="Details">
          <DetailRow
            label="Path"
            value={
              <span className="truncate font-mono text-[12px] text-l-ink">
                {path}
              </span>
            }
          />
          <DetailRow
            label="Source"
            icon={
              <CompanyLogo
                name={event.source}
                size={14}
                radius={3}
                fallbackBackground={tint}
                fallbackColor="var(--c-ink-hi)"
                aria-hidden
              />
            }
            value={event.source}
          />
          <DetailRow
            label="Type"
            icon={<Activity size={12} strokeWidth={1.75} aria-hidden />}
            value={event.type}
          />
          <DetailRow
            label="Time"
            icon={<Calendar size={12} strokeWidth={1.75} aria-hidden />}
            value={
              <span className="font-mono text-[12px] tabular-nums">
                {dateTimeFormatter.format(occurredAtMs)}
              </span>
            }
          />
          <DetailRow
            label="Actor"
            icon={<User size={12} strokeWidth={1.75} aria-hidden />}
            value={
              event.actor ?? (
                <span className="text-l-ink-dim">Unassigned</span>
              )
            }
          />
          {event.message ? (
            <DetailRow
              label="Message"
              icon={
                <MessageSquare size={12} strokeWidth={1.75} aria-hidden />
              }
              value={
                <span className="line-clamp-2 text-l-ink-lo">
                  {event.message}
                </span>
              }
            />
          ) : null}
          {traceLabel && !hasTrace ? (
            <DetailRow
              label="Trace"
              icon={
                <GitBranch
                  size={12}
                  strokeWidth={1.75}
                  className="text-event-violet"
                  aria-hidden
                />
              }
              value={
                <span className="text-event-violet">{traceLabel}</span>
              }
            />
          ) : null}
          {event.stream ? (
            <DetailRow
              label="Stream"
              icon={<LayersIcon size={12} strokeWidth={1.75} aria-hidden />}
              value={event.stream}
            />
          ) : null}
          {event.correlationKey ? (
            <DetailRow
              label="Correlation"
              icon={
                <Fingerprint size={12} strokeWidth={1.75} aria-hidden />
              }
              value={
                <span className="font-mono text-[12px]">
                  {event.correlationKey}
                </span>
              }
            />
          ) : null}
          <DetailRow
            label="Event ID"
            icon={<Hash size={12} strokeWidth={1.75} aria-hidden />}
            value={
              <span className="inline-flex min-w-0 flex-1 items-center gap-[6px]">
                <span className="truncate font-mono text-[12px] text-l-ink-lo">
                  {event.id}
                </span>
                <CopyButton text={event.id} />
              </span>
            }
          />
        </Section>

        <Section
          eyebrow="Payload"
          actions={
            <span className="font-sans text-[11px] text-l-ink-dim">
              JSON
            </span>
          }
        >
          <Collapsible defaultOpen={defaultPayloadOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="-mt-[2px] mb-s-1 flex h-[24px] items-center gap-[5px] rounded-l px-[8px] font-sans text-[12px] font-medium text-l-ink-lo transition-colors hover:bg-l-wash-3 hover:text-l-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
              >
                <ChevronRight
                  size={11}
                  strokeWidth={1.75}
                  className="transition-transform data-[state=open]:rotate-90"
                  aria-hidden
                />
                Show payload
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-s-1 max-h-[240px] overflow-auto rounded-l-sm border border-hairline bg-l-surface px-[10px] py-[8px] font-mono text-[11.5px] leading-[1.6] text-l-ink-lo">
                {payloadJson}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        </Section>
      </div>

      {showDatasetCta ? (
        <DatasetFooter
          datasets={datasets!}
          event={event}
          traceEvents={traceList}
          onAddTraceToDataset={onAddTraceToDataset!}
          ctaCount={datasetCtaCount}
          existingMemberships={traceDatasetMemberships ?? []}
        />
      ) : null}
    </div>
  );
}

/* ── Header ───────────────────────────────────────────────── */

interface DetailHeaderProps {
  title?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  position?: string | null;
  prevEvent?: StreamTimelineEvent | null;
  nextEvent?: StreamTimelineEvent | null;
  onPrev?: () => void;
  onNext?: () => void;
  copyId?: string;
  onClose?: () => void;
}

function DetailHeader({
  title,
  breadcrumb,
  position,
  prevEvent,
  nextEvent,
  onPrev,
  onNext,
  copyId,
  onClose,
}: DetailHeaderProps) {
  return (
    <header className="flex shrink-0 flex-col border-b border-hairline px-[16px] py-[10px]">
      <div className="flex items-center gap-[6px]">
        {breadcrumb ? (
          <div className="flex min-w-0 items-center gap-[5px]">
            {breadcrumb}
          </div>
        ) : null}
        {position ? (
          <span className="font-mono text-[10.5px] tabular-nums text-l-ink-dim">
            · {position}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-[2px]">
          {prevEvent !== undefined || nextEvent !== undefined ? (
            <div className="mr-[2px] inline-flex items-center rounded-l border border-hairline bg-l-surface">
              <HeaderIconButton
                icon={
                  <ChevronLeft
                    size={11}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                }
                disabled={!prevEvent}
                onClick={onPrev}
                ariaLabel="Previous event in trace"
              />
              <HeaderIconButton
                icon={
                  <ChevronRight
                    size={11}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                }
                disabled={!nextEvent}
                onClick={onNext}
                ariaLabel="Next event in trace"
              />
            </div>
          ) : null}
          {copyId ? <CopyButton text={copyId} /> : null}
          {onClose ? (
            <HeaderIconButton
              icon={<X size={11} strokeWidth={1.75} aria-hidden />}
              onClick={onClose}
              ariaLabel="Close detail panel"
            />
          ) : null}
        </div>
      </div>
      {title ? (
        <p className="mt-[6px] truncate font-sans text-[14px] font-medium text-l-ink">
          {title}
        </p>
      ) : null}
    </header>
  );
}

function HeaderIconButton({
  icon,
  disabled,
  onClick,
  ariaLabel,
}: {
  icon: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-l-sm text-l-ink-dim transition-colors hover:bg-l-wash-3 hover:text-l-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-l-ink-dim focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
    >
      {icon}
    </button>
  );
}

/* ── Section + DetailRow ──────────────────────────────────── */

function Section({
  eyebrow,
  actions,
  children,
}: {
  eyebrow: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col border-b border-hairline px-[12px] py-[12px] last:border-b-0">
      <div className="mb-[6px] flex items-center px-[4px]">
        <span className="font-sans text-[11.5px] font-medium text-l-ink-dim">
          {eyebrow}
        </span>
        <div className="ml-auto flex items-center gap-[4px]">{actions}</div>
      </div>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

function DetailRow({
  label,
  icon,
  value,
}: {
  label: string;
  icon?: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="group flex min-h-[28px] items-center gap-[8px] rounded-l px-[4px] py-[4px] transition-colors hover:bg-l-wash-3">
      <span className="w-[88px] shrink-0 font-sans text-[12px] font-medium text-l-ink-dim">
        {label}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-[8px] font-sans text-[12px] text-l-ink">
        {icon ? (
          <span className="inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center text-l-ink-dim">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{value}</span>
      </span>
    </div>
  );
}

/* ── Trace strip ──────────────────────────────────────────── */

interface TraceStripProps {
  events: readonly StreamTimelineEvent[];
  activeId: string;
  traceLabel: string | null;
  onSelect?: (event: StreamTimelineEvent) => void;
}

/**
 * Compact, always-visible trace navigator. Shown above the event
 * body whenever the selected event has 2+ siblings. Auto-scrolls
 * the active item into view as the user steps through the trace.
 */
function TraceStrip({
  events,
  activeId,
  traceLabel,
  onSelect,
}: TraceStripProps) {
  const listRef = React.useRef<HTMLOListElement | null>(null);

  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>(
      `[data-trace-event-id="${CSS.escape(activeId)}"]`,
    );
    active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  return (
    <section className="flex flex-col border-b border-hairline px-[12px] py-[12px]">
      <div className="mb-[6px] flex items-center gap-[5px] px-[4px]">
        <GitBranch
          size={11}
          strokeWidth={1.75}
          className="text-event-violet"
          aria-hidden
        />
        <span className="truncate font-sans text-[11.5px] font-medium text-l-ink-dim">
          {traceLabel ?? "Trace"}
        </span>
        <span className="ml-auto font-mono text-[10.5px] tabular-nums text-l-ink-dim">
          {events.length} events
        </span>
      </div>
      <ol
        ref={listRef}
        className="relative ml-[10px] mr-[2px] max-h-[140px] overflow-y-auto border-l border-hairline pb-[2px]"
      >
        {events.map((e, idx) => {
          const isActive = e.id === activeId;
          const occurredAtMs = new Date(e.occurredAt).getTime();
          const tint = sourceTintedBackground(sourceColor(e.source), 22);
          return (
            <li
              key={e.id}
              data-trace-event-id={e.id}
              className="relative -ml-px"
            >
              <span
                aria-hidden
                className={cx(
                  "absolute left-[-3px] top-[10px] inline-block h-[6px] w-[6px] rounded-pill",
                  isActive
                    ? "bg-ember ring-1 ring-ember/30 ring-offset-1 ring-offset-l-surface-bar"
                    : "bg-event-violet/60",
                )}
              />
              <button
                type="button"
                onClick={() => onSelect?.(e)}
                className={cx(
                  "flex w-full items-center gap-[6px] rounded-l-sm py-[3px] pl-[12px] pr-[6px] text-left transition-colors",
                  "hover:bg-l-wash-3 focus-visible:bg-l-wash-3 focus-visible:outline-none",
                  isActive ? "bg-l-wash-3" : undefined,
                )}
              >
                <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-l-ink-dim">
                  {traceItemTimeFormatter.format(occurredAtMs)}
                </span>
                <CompanyLogo
                  name={e.source}
                  size={12}
                  radius={2}
                  fallbackBackground={tint}
                  fallbackColor="var(--c-ink-hi)"
                  className="shrink-0"
                  aria-hidden
                />
                <span
                  className={cx(
                    "min-w-0 truncate font-sans text-[12px]",
                    isActive ? "text-l-ink" : "text-l-ink-lo",
                  )}
                >
                  {e.type}
                </span>
                <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-l-ink-dim">
                  {idx + 1}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ── Footer ───────────────────────────────────────────────── */

function DatasetFooter({
  datasets,
  event,
  traceEvents,
  onAddTraceToDataset,
  ctaCount,
  existingMemberships,
}: {
  datasets: readonly Dataset[];
  event: StreamTimelineEvent;
  traceEvents: readonly StreamTimelineEvent[];
  onAddTraceToDataset: AddTraceToDatasetHandler;
  ctaCount: number;
  existingMemberships: readonly TraceDatasetMembership[];
}) {
  const memberCount = existingMemberships.length;
  const existingIds = React.useMemo(
    () => new Set(existingMemberships.map((m) => m.datasetId)),
    [existingMemberships],
  );
  const ctaLabel =
    memberCount > 0 ? "Add to another" : `Add trace · ${ctaCount}`;
  return (
    <footer className="flex shrink-0 items-center gap-[8px] border-t border-hairline bg-l-surface px-[12px] py-[10px]">
      <span className="inline-flex items-center gap-[5px] font-sans text-[11px] font-medium text-l-ink-dim">
        <Database size={11} strokeWidth={1.75} aria-hidden />
        {memberCount > 0 ? (
          <>
            In{" "}
            <span className="font-medium text-l-ink-lo">{memberCount}</span>{" "}
            {memberCount === 1 ? "dataset" : "datasets"}
          </>
        ) : (
          "Dataset"
        )}
      </span>
      <div className="ml-auto">
        <DatasetPicker
          datasets={datasets}
          event={event}
          traceEvents={traceEvents}
          onAddTraceToDataset={onAddTraceToDataset}
          existingMembershipDatasetIds={existingIds}
          trigger={
            <button
              type="button"
              className="inline-flex h-[26px] items-center gap-[5px] rounded-l border border-transparent bg-ember px-[10px] font-sans text-[12px] font-medium leading-none text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_1px_rgba(0,0,0,0.35)] transition-colors hover:bg-[#e85520] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember focus-visible:ring-offset-1 focus-visible:ring-offset-page"
            >
              <Database size={11} strokeWidth={1.75} aria-hidden />
              {ctaLabel}
            </button>
          }
        />
      </div>
    </footer>
  );
}

/* ── In datasets section ──────────────────────────────────── */

const PURPOSE_DOT: Record<DatasetPurpose, string> = {
  eval: "bg-event-violet",
  training: "bg-event-amber",
  replay: "bg-event-teal",
  review: "bg-l-ink-dim",
};

const PURPOSE_TILE: Record<DatasetPurpose, string> = {
  eval: "bg-event-violet/12 text-event-violet",
  training: "bg-event-amber/12 text-event-amber",
  replay: "bg-event-teal/12 text-event-teal",
  review: "bg-l-wash-3 text-l-ink-lo",
};

const PURPOSE_ICON: Record<DatasetPurpose, typeof Database> = {
  eval: Beaker,
  training: Sparkles,
  replay: Repeat,
  review: LayersIcon,
};

function DatasetMembershipsSection({
  memberships,
}: {
  memberships: readonly TraceDatasetMembership[];
}) {
  return (
    <Section
      eyebrow={
        <span className="inline-flex items-center gap-[5px]">
          <Check size={10} strokeWidth={2} className="text-event-green" aria-hidden />
          In datasets
        </span>
      }
      actions={
        <span className="font-mono text-[10.5px] tabular-nums text-l-ink-dim">
          {memberships.length}
        </span>
      }
    >
      <ul className="flex flex-col gap-[4px]">
        {memberships.map((m) => (
          <DatasetMembershipChip key={`${m.datasetId}-${m.addedAt ?? ""}`} membership={m} />
        ))}
      </ul>
    </Section>
  );
}

function DatasetMembershipChip({
  membership,
}: {
  membership: TraceDatasetMembership;
}) {
  const Icon = membership.purpose
    ? PURPOSE_ICON[membership.purpose]
    : Database;
  const tile = membership.purpose
    ? PURPOSE_TILE[membership.purpose]
    : "bg-l-wash-3 text-l-ink-lo";
  const dot = membership.purpose
    ? PURPOSE_DOT[membership.purpose]
    : "bg-l-ink-dim";
  return (
    <li>
      <div className="group flex items-center gap-[8px] rounded-l px-[4px] py-[4px] transition-colors hover:bg-l-wash-3">
        <span
          className={cx(
            "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-l-sm",
            tile,
          )}
        >
          <Icon size={10} strokeWidth={1.75} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
          <span className="truncate font-sans text-[12px] font-medium text-l-ink">
            {membership.datasetName}
          </span>
          {membership.split || membership.note || membership.addedAt ? (
            <span className="truncate font-sans text-[10.5px] text-l-ink-dim">
              {membership.split ? (
                <span className="font-mono uppercase tracking-tactical">
                  {membership.split}
                </span>
              ) : null}
              {membership.split && membership.note ? (
                <span className="mx-[4px]">·</span>
              ) : null}
              {membership.note ? `“${membership.note}”` : null}
              {(membership.split || membership.note) && membership.addedAt ? (
                <span className="mx-[4px]">·</span>
              ) : null}
              {membership.addedAt
                ? formatRelativeAdded(membership.addedAt)
                : null}
            </span>
          ) : null}
        </div>
        {membership.purpose ? (
          <span className="inline-flex shrink-0 items-center gap-[4px] font-sans text-[10px] uppercase tracking-tactical text-l-ink-dim">
            <span
              aria-hidden
              className={cx("inline-block h-[5px] w-[5px] rounded-pill", dot)}
            />
            {membership.purpose}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function formatRelativeAdded(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
  });
}
