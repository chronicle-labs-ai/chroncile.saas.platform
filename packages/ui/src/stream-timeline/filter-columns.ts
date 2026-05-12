/*
 * Stream Timeline — default filter column descriptors.
 *
 * Builds a `ColumnConfig<StreamTimelineEvent>[]` from a snapshot of
 * the event list, with options populated from the actual distinct
 * values present in the data. Apps can override individual entries
 * by passing a custom `filterColumns` array to the viewer; this
 * helper is exposed so they can extend the defaults rather than
 * rebuild them.
 *
 * Default columns:
 *   • `source`    — multiOption, e.g. intercom / stripe / slack
 *   • `type`      — multiOption, e.g. intercom.conversation.created
 *   • `actor`     — text (contains)
 *   • `trace`     — option, e.g. "Sara K. · Password reset" or solo
 *                   when no scripted label is set
 */

import { sourceColor } from "./source-color";
import { resolveTraceId } from "./trace";
import type { TraceKeyFn, StreamTimelineEvent } from "./types";
import type {
  ColumnConfig,
  ColumnOption,
  OptionTone,
} from "../product/filters";

/** Map a known source to a `OptionTone` so the brand multi-option
 *  editor renders matching coloured dots. Falls back to `neutral`. */
const SOURCE_TONE: Record<string, OptionTone> = {
  intercom: "teal",
  stripe: "green",
  slack: "pink",
  hubspot: "orange",
  github: "violet",
  zendesk: "teal",
  hubspotcrm: "orange",
  salesforce: "teal",
  shopify: "amber",
  notion: "neutral",
  linear: "violet",
  segment: "teal",
  postgres: "teal",
  kafka: "neutral",
};

function distinct<T>(arr: readonly T[]): T[] {
  return Array.from(new Set(arr));
}

export interface DefaultStreamTimelineColumnsOptions {
  /** Custom labels for source values. Falls back to capitalize. */
  sourceLabels?: Record<string, string>;
  /** Resolves a trace id when `event.traceId` is missing. Mirrors the viewer's `traceKey`. */
  traceKey?: TraceKeyFn;
}

export function defaultStreamTimelineColumns(
  events: readonly StreamTimelineEvent[],
  options: DefaultStreamTimelineColumnsOptions = {},
): ColumnConfig<StreamTimelineEvent>[] {
  const { sourceLabels = {}, traceKey } = options;

  const sourceOptions: ColumnOption[] = distinct(events.map((e) => e.source))
    .filter(Boolean)
    .sort()
    .map((s) => ({
      value: s,
      label: sourceLabels[s] ?? capitalize(s),
      tone: SOURCE_TONE[s.toLowerCase()] ?? "neutral",
    }));

  const typeOptions: ColumnOption[] = distinct(events.map((e) => e.type))
    .filter(Boolean)
    .sort()
    .map((t) => ({ value: t, label: t }));

  /* Trace options: one entry per resolved trace, labelled by the
     scripted `traceLabel` when present. Solo events (no trace) skip
     this column entirely. */
  const traceMap = new Map<string, { label: string; count: number }>();
  for (const e of events) {
    const traceId = resolveTraceId(e, traceKey);
    if (!traceId) continue;
    const existing = traceMap.get(traceId);
    if (existing) {
      existing.count += 1;
    } else {
      traceMap.set(traceId, {
        label: e.traceLabel ?? traceId.replace(/^trace_/, "Trace "),
        count: 1,
      });
    }
  }
  const traceOptions: ColumnOption[] = Array.from(traceMap.entries())
    .sort((a, b) => a[1].label.localeCompare(b[1].label))
    .map(([traceId, meta]) => ({
      value: traceId,
      label: `${meta.label} · ${meta.count}`,
      tone: "violet",
    }));

  const columns: ColumnConfig<StreamTimelineEvent>[] = [
    {
      id: "source",
      label: "Source",
      type: "multiOption",
      accessor: (row) => row.source,
      options: sourceOptions,
    },
    {
      id: "type",
      label: "Type",
      type: "multiOption",
      accessor: (row) => row.type,
      options: typeOptions,
    },
    {
      id: "actor",
      label: "Actor",
      type: "text",
      accessor: (row) => row.actor ?? "",
      placeholder: "Sara K., support-bot…",
    },
  ];

  if (traceOptions.length > 0) {
    columns.push({
      id: "trace",
      label: "Trace",
      type: "option",
      accessor: (row) => resolveTraceId(row, traceKey) ?? "",
      options: traceOptions,
    });
  }

  return columns;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

/* Keep the unused-import type-checker happy in case the source-color
 * helper becomes useful for tinted icons later. Re-export so callers
 * can colour a custom column glyph from the same palette the rows
 * use without importing the deeper module path. */
export { sourceColor };
