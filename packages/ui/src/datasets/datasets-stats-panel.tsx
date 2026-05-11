"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cx } from "../utils/cx";
import { Avatar, AvatarFallback, deriveInitials } from "../primitives/avatar";
import { formatNumber, formatRelative } from "../connections/time";

import { DATASET_PURPOSE_META } from "./purpose-meta";
import type { Dataset, DatasetPurpose } from "./types";
import { RAIL_HANDLE_CLASSNAME, useRailResize } from "./use-rail-resize";

/*
 * DatasetsStatsPanel — curated breakdown of the dataset library.
 *
 * Toggled from the toolbar's analytics button. The panel is opinionated
 * about *what* to show — there are no Measure/Slice/Segment pivots.
 * Instead it surfaces the questions a dataset librarian actually asks:
 *
 *   - How big is the library? (datasets / traces / events)
 *   - What's the purpose mix? (eval / training / replay / review)
 *   - What's empty or unowned? (coverage gaps)
 *   - What changed recently? (top 3 by updatedAt)
 *   - Who's contributing? (top 3 owners by dataset count)
 *
 * Built around Emil-shaped product UI — dense, no chrome inside the
 * rail, tabular numerics, hover surfaces only on touch-capable
 * pointers, and motion limited to opacity/colors so reduced-motion
 * users get the same content unaffected.
 */

const PURPOSE_ORDER: readonly DatasetPurpose[] = [
  "eval",
  "training",
  "replay",
  "review",
];

const PURPOSE_FILL: Record<DatasetPurpose, string> = {
  eval: "var(--c-event-violet)",
  training: "var(--c-event-teal)",
  replay: "var(--c-event-amber)",
  review: "var(--c-event-pink)",
};

interface PurposeBucket {
  purpose: DatasetPurpose;
  label: string;
  count: number;
  ratio: number;
  fill: string;
}

interface OwnerBucket {
  owner: string;
  count: number;
}

interface CoverageBucket {
  /** Number of active (non-empty) datasets. */
  active: number;
  /** Number of empty (no traces) datasets. */
  empty: number;
  /** Datasets without an owner attribution. */
  missingOwner: number;
  /** Datasets without any tags. */
  missingTags: number;
}

export interface DatasetsStatsPanelProps {
  /** Datasets the panel should describe. Pass the *visible* list so
   *  the panel reflects current filters. */
  datasets: readonly Dataset[];
  /** Fired when the user dismisses the panel. */
  onClose?: () => void;
  /** Optional dataset selection — turns rows in "recently updated"
   *  into navigation triggers. */
  onOpenDataset?: (id: string) => void;
  /** Current width in px. When omitted, defaults to 320 (uncontrolled). */
  width?: number;
  /** Width change request from the resize handle. Omit to disable. */
  onWidthChange?: (next: number) => void;
  /** Lower clamp for the resize handle. */
  minWidth?: number;
  /** Upper clamp for the resize handle. */
  maxWidth?: number;
  className?: string;
}

export function DatasetsStatsPanel({
  datasets,
  onClose,
  onOpenDataset,
  width: widthProp,
  onWidthChange,
  minWidth = 280,
  maxWidth = 560,
  className,
}: DatasetsStatsPanelProps) {
  const [internalWidth, setInternalWidth] = React.useState(360);
  const width = widthProp ?? internalWidth;
  const handleWidthChange = onWidthChange ?? setInternalWidth;
  const { dragging, handleProps } = useRailResize({
    width,
    onWidthChange: handleWidthChange,
    minWidth,
    maxWidth,
  });

  const stats = React.useMemo(() => buildStats(datasets), [datasets]);

  return (
    <aside
      className={cx(
        "relative hidden shrink-0 self-stretch overflow-hidden border-l border-hairline bg-l-surface-bar xl:flex xl:flex-col",
        dragging
          ? null
          : "transition-[width] duration-200 ease-out motion-reduce:transition-none",
        className
      )}
      style={{ width }}
      aria-label="Dataset statistics"
    >
      <div
        {...handleProps}
        aria-label="Resize stats panel"
        className={RAIL_HANDLE_CLASSNAME}
      />

      <PanelHeader
        count={datasets.length}
        onClose={onClose}
      />

      <div className="chron-scrollbar-hidden flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-3 pb-4">
        <KpiRow
          datasets={datasets.length}
          traces={stats.traceCount}
          events={stats.eventCount}
        />

        <PurposeSection buckets={stats.purposeBuckets} />

        <CoverageSection coverage={stats.coverage} total={datasets.length} />

        {stats.recentlyUpdated.length > 0 ? (
          <RecentlyUpdatedSection
            datasets={stats.recentlyUpdated}
            onOpen={onOpenDataset}
          />
        ) : null}

        {stats.topOwners.length > 0 ? (
          <TopOwnersSection owners={stats.topOwners} />
        ) : null}
      </div>
    </aside>
  );
}

/* ── Header ──────────────────────────────────────────────── */

function PanelHeader({
  count,
  onClose,
}: {
  count: number;
  onClose?: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-2 px-3 pb-3 pt-3">
      <div className="flex items-baseline gap-1.5">
        <span className="font-sans text-[20px] font-semibold leading-none tabular-nums text-l-ink">
          {formatNumber(count)}
        </span>
        <span className="font-sans text-[12px] text-l-ink-dim">
          {count === 1 ? "dataset" : "datasets"}
        </span>
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close stats panel"
          className={cx(
            "flex size-6 items-center justify-center rounded-md text-l-ink-dim",
            "transition-colors duration-fast ease-out motion-reduce:transition-none",
            "[@media(hover:hover)]:hover:bg-l-wash-3 [@media(hover:hover)]:hover:text-l-ink",
            "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
          )}
        >
          <X className="size-3.5" strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
    </header>
  );
}

/* ── KPI strip ───────────────────────────────────────────── */

function KpiRow({
  datasets,
  traces,
  events,
}: {
  datasets: number;
  traces: number;
  events: number;
}) {
  return (
    <section className="grid grid-cols-3 gap-1.5">
      <KpiTile label="Datasets" value={datasets} />
      <KpiTile label="Traces" value={traces} />
      <KpiTile label="Events" value={events} />
    </section>
  );
}

function KpiTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-l-border-faint bg-l-wash-1 px-2.5 py-2">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-l-ink-dim">
        {label}
      </span>
      <span className="font-sans text-[15px] font-medium tabular-nums text-l-ink">
        {formatCompact(value)}
      </span>
    </div>
  );
}

/* ── Purpose ─────────────────────────────────────────────── */

function PurposeSection({ buckets }: { buckets: readonly PurposeBucket[] }) {
  const total = buckets.reduce((sum, b) => sum + b.count, 0);

  return (
    <section className="flex flex-col gap-2.5">
      <SectionEyebrow label="Purpose mix" />

      {total === 0 ? (
        <EmptyHint copy="No datasets categorised yet." />
      ) : (
        <>
          <div
            className="flex h-1.5 w-full overflow-hidden rounded-pill bg-l-wash-2"
            role="presentation"
          >
            {buckets.map((bucket) =>
              bucket.count > 0 ? (
                <div
                  key={bucket.purpose}
                  className="h-full"
                  style={{
                    width: `${bucket.ratio * 100}%`,
                    background: bucket.fill,
                  }}
                  title={`${bucket.label}: ${bucket.count}`}
                />
              ) : null
            )}
          </div>

          <ul className="flex flex-col gap-0.5">
            {buckets.map((bucket) => (
              <li key={bucket.purpose}>
                <PurposeRow bucket={bucket} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function PurposeRow({ bucket }: { bucket: PurposeBucket }) {
  return (
    <div className="flex h-7 items-center gap-2 px-1">
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-pill"
        style={{ background: bucket.fill }}
      />
      <span className="min-w-0 flex-1 truncate font-sans text-[12.5px] text-l-ink">
        {bucket.label}
      </span>
      <span className="font-sans text-[11.5px] tabular-nums text-l-ink-dim">
        {Math.round(bucket.ratio * 100)}%
      </span>
      <span className="w-7 text-right font-sans text-[12.5px] font-medium tabular-nums text-l-ink">
        {bucket.count}
      </span>
    </div>
  );
}

/* ── Coverage ────────────────────────────────────────────── */

function CoverageSection({
  coverage,
  total,
}: {
  coverage: CoverageBucket;
  total: number;
}) {
  if (total === 0) return null;
  const activeRatio = total === 0 ? 0 : coverage.active / total;

  return (
    <section className="flex flex-col gap-2.5">
      <SectionEyebrow label="Coverage" />

      <div className="flex flex-col gap-1.5 rounded-md border border-l-border-faint bg-l-wash-1 p-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-sans text-[12px] text-l-ink-lo">Active</span>
          <span className="font-sans text-[11.5px] tabular-nums text-l-ink-dim">
            <span className="font-medium text-l-ink">{coverage.active}</span>{" "}
            <span className="text-l-ink-dim">/ {total}</span>
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-pill bg-l-wash-3">
          <div
            className="h-full"
            style={{
              width: `${activeRatio * 100}%`,
              background: "var(--c-event-green)",
            }}
          />
        </div>
      </div>

      <ul className="flex flex-col">
        <CoverageRow label="Empty datasets" value={coverage.empty} muted />
        <CoverageRow label="Missing owner" value={coverage.missingOwner} muted />
        <CoverageRow label="Missing tags" value={coverage.missingTags} muted />
      </ul>
    </section>
  );
}

function CoverageRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div className="flex h-6 items-center justify-between gap-2 px-1">
      <span className="font-sans text-[12px] text-l-ink-lo">{label}</span>
      <span
        className={cx(
          "font-sans text-[12px] tabular-nums",
          value === 0 || muted
            ? "text-l-ink-dim"
            : "text-l-ink"
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* ── Recently updated ────────────────────────────────────── */

function RecentlyUpdatedSection({
  datasets,
  onOpen,
}: {
  datasets: readonly Dataset[];
  onOpen?: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <SectionEyebrow label="Recently updated" />
      <ul className="flex flex-col">
        {datasets.map((dataset) => (
          <li key={dataset.id}>
            <RecentlyUpdatedRow dataset={dataset} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecentlyUpdatedRow({
  dataset,
  onOpen,
}: {
  dataset: Dataset;
  onOpen?: (id: string) => void;
}) {
  const purpose = dataset.purpose;
  const meta = purpose ? DATASET_PURPOSE_META[purpose] : null;
  const fill = purpose ? PURPOSE_FILL[purpose] : "var(--c-l-ink-dim)";
  const timestamp = dataset.updatedAt
    ? formatRelative(dataset.updatedAt)
    : null;
  const interactive = !!onOpen;

  const inner = (
    <div className="flex h-8 min-w-0 items-center gap-2 px-1">
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-pill"
        style={{ background: fill }}
      />
      <span className="min-w-0 flex-1 truncate font-sans text-[12.5px] text-l-ink">
        {dataset.name}
      </span>
      {meta ? (
        <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.06em] text-l-ink-dim sm:inline">
          {meta.label}
        </span>
      ) : null}
      {timestamp ? (
        <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-l-ink-dim">
          {timestamp}
        </span>
      ) : null}
    </div>
  );

  if (!interactive) return inner;

  return (
    <button
      type="button"
      onClick={() => onOpen?.(dataset.id)}
      className={cx(
        "block w-full rounded-md text-left",
        "transition-colors duration-fast ease-out motion-reduce:transition-none",
        "[@media(hover:hover)]:hover:bg-l-wash-3",
        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
      )}
    >
      {inner}
    </button>
  );
}

/* ── Top owners ──────────────────────────────────────────── */

function TopOwnersSection({ owners }: { owners: readonly OwnerBucket[] }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionEyebrow label="Top contributors" />
      <ul className="flex flex-col gap-0.5">
        {owners.map((entry) => (
          <li key={entry.owner}>
            <OwnerRow owner={entry.owner} count={entry.count} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function OwnerRow({ owner, count }: { owner: string; count: number }) {
  return (
    <div className="flex h-8 items-center gap-2 px-1">
      <Avatar size="xs" tone="violet">
        <AvatarFallback>{deriveInitials(owner)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate font-sans text-[12.5px] text-l-ink">
        {owner}
      </span>
      <span className="font-sans text-[11.5px] tabular-nums text-l-ink-dim">
        {count} {count === 1 ? "dataset" : "datasets"}
      </span>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────── */

function SectionEyebrow({ label }: { label: string }) {
  return (
    <h3 className="font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-l-ink-dim">
      {label}
    </h3>
  );
}

function EmptyHint({ copy }: { copy: string }) {
  return (
    <p className="rounded-md border border-dashed border-l-border-faint px-2.5 py-2 font-sans text-[11.5px] text-l-ink-dim">
      {copy}
    </p>
  );
}

function formatCompact(n: number): string {
  if (n < 1000) return formatNumber(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)}M`;
}

function buildStats(datasets: readonly Dataset[]) {
  let traceCount = 0;
  let eventCount = 0;
  let active = 0;
  let empty = 0;
  let missingOwner = 0;
  let missingTags = 0;
  const purposeCount = new Map<DatasetPurpose, number>(
    PURPOSE_ORDER.map((p) => [p, 0])
  );
  const ownerCount = new Map<string, number>();

  for (const dataset of datasets) {
    traceCount += dataset.traceCount ?? 0;
    eventCount += dataset.eventCount ?? 0;
    if ((dataset.traceCount ?? 0) > 0) {
      active += 1;
    } else {
      empty += 1;
    }
    if (!dataset.createdBy) missingOwner += 1;
    if (!dataset.tags || dataset.tags.length === 0) missingTags += 1;
    if (dataset.purpose) {
      purposeCount.set(
        dataset.purpose,
        (purposeCount.get(dataset.purpose) ?? 0) + 1
      );
    }
    const owner = dataset.createdBy;
    if (owner) {
      ownerCount.set(owner, (ownerCount.get(owner) ?? 0) + 1);
    }
  }

  const totalCategorized = Array.from(purposeCount.values()).reduce(
    (a, b) => a + b,
    0
  );
  const purposeBuckets: PurposeBucket[] = PURPOSE_ORDER.map((purpose) => {
    const count = purposeCount.get(purpose) ?? 0;
    const ratio = totalCategorized === 0 ? 0 : count / totalCategorized;
    return {
      purpose,
      label: DATASET_PURPOSE_META[purpose].label,
      count,
      ratio,
      fill: PURPOSE_FILL[purpose],
    };
  });

  const recentlyUpdated = [...datasets]
    .filter((d) => d.updatedAt)
    .sort((a, b) => {
      const aTime = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const bTime = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      return bTime - aTime;
    })
    .slice(0, 3);

  const topOwners: OwnerBucket[] = Array.from(ownerCount, ([owner, count]) => ({
    owner,
    count,
  }))
    .sort((a, b) => b.count - a.count || a.owner.localeCompare(b.owner))
    .slice(0, 3);

  const coverage: CoverageBucket = {
    active,
    empty,
    missingOwner,
    missingTags,
  };

  return {
    traceCount,
    eventCount,
    purposeBuckets,
    coverage,
    recentlyUpdated,
    topOwners,
  };
}
