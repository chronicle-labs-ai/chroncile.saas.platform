"use client";

import * as React from "react";
import { ChevronLeft, Plus, SlidersHorizontal, X } from "lucide-react";

import { cx } from "../utils/cx";
import { Input } from "../primitives/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../primitives/popover";
import {
  FilterOperatorMenu,
  MultiOptionEditor,
  NumberEditor,
  OPERATORS,
  OptionEditor,
  TextEditor,
  defaultOperatorFor,
  defaultValueFor,
  type ColumnConfig,
  type ColumnType,
  type FilterActions,
  type FilterOperator,
  type FilterState,
} from "../product/filters";
import type { StreamTimelineEvent } from "./types";

export interface StreamTimelineFilterBarProps {
  columns: ColumnConfig<StreamTimelineEvent>[];
  filters: FilterState[];
  actions: FilterActions;
  /** Filtered/total event count for the right-hand readout. */
  shownCount: number;
  totalCount: number;
  /** Optional Display button onClick. */
  onOpenDisplay?: () => void;
  displayChanged?: boolean;
  className?: string;
}

/**
 * StreamTimelineFilterBar — Linear-density filter rail.
 *
 * Visual model lifted from Linear's top-bar filter chrome:
 *
 *   • `+ Filter` trigger uses a *dashed* hairline border so empty state
 *     reads as an affordance, not a button. Once a filter is applied it
 *     stays available alongside the pills.
 *   • Filter pills are 24 px tall single-target buttons with a faint
 *     wash background, hairline-separated `dim | verb | value` sections.
 *     Hover reveals the close X on the right.
 *   • Column picker is a 210 px popover with a search input topped by
 *     an `F` keyboard hint, then a sectioned list of columns each
 *     anchored by a 14 px lucide glyph.
 *   • Right-aligned cluster: optional Display button + filtered/total
 *     count read-out.
 */
export function StreamTimelineFilterBar({
  columns,
  filters,
  actions,
  shownCount,
  totalCount,
  onOpenDisplay,
  displayChanged,
  className,
}: StreamTimelineFilterBarProps) {
  const columnById = React.useMemo(
    () => new Map(columns.map((c) => [c.id, c] as const)),
    [columns],
  );
  const appliedColumnIds = React.useMemo(
    () => new Set(filters.map((f) => f.columnId)),
    [filters],
  );

  return (
    <div
      className={cx(
        "flex h-[40px] shrink-0 items-center gap-[6px] border-b border-hairline bg-l-surface-bar px-[12px]",
        className,
      )}
    >
      {filters.map((filter) => {
        const column = columnById.get(filter.columnId);
        if (!column) return null;
        return (
          <LinearFilterPill
            key={filter.id}
            column={column}
            filter={filter}
            onOperatorChange={(op) => actions.updateOperator(filter.id, op)}
            onValueChange={(v) => actions.updateValue(filter.id, v)}
            onRemove={() => actions.removeFilter(filter.id)}
          />
        );
      })}

      <LinearAddFilterButton
        columns={columns}
        appliedColumnIds={appliedColumnIds}
        onAdd={actions.addConfiguredFilter}
        hasAny={filters.length > 0}
      />

      {filters.length > 0 ? (
        <button
          type="button"
          onClick={() => actions.clearAll()}
          className="inline-flex h-[22px] items-center rounded-xs px-[6px] font-sans text-[11.5px] text-l-ink-dim transition-colors hover:bg-l-wash-3 hover:text-l-ink"
        >
          Clear
        </button>
      ) : null}

      <div className="ml-auto flex items-center gap-[8px]">
        {onOpenDisplay ? (
          <button
            type="button"
            onClick={onOpenDisplay}
            className="relative inline-flex h-[24px] items-center gap-[6px] rounded-md border border-hairline-strong bg-l-surface px-[10px] font-sans text-[12px] font-medium text-l-ink-lo transition-colors hover:border-l-border-strong hover:bg-l-wash-3 hover:text-l-ink"
          >
            <SlidersHorizontal size={11} strokeWidth={1.75} aria-hidden />
            Display
            {displayChanged ? (
              <span
                aria-hidden
                className="absolute right-[3px] top-[3px] h-[5px] w-[5px] rounded-pill bg-ember"
              />
            ) : null}
          </button>
        ) : null}
        <span className="font-mono text-[11px] tabular-nums text-l-ink-lo">
          <span className="font-medium text-l-ink">
            {shownCount.toLocaleString()}
          </span>
          <span className="mx-[6px] text-l-ink-dim">/</span>
          {totalCount.toLocaleString()}
          <span className="ml-[6px] text-l-ink-dim">events</span>
        </span>
      </div>
    </div>
  );
}

/* ── Add filter trigger + column picker ──────────────────── */

interface LinearAddFilterButtonProps {
  columns: ColumnConfig<StreamTimelineEvent>[];
  appliedColumnIds: ReadonlySet<string>;
  onAdd: (filter: Omit<FilterState, "id">) => void;
  /** Whether at least one filter is already applied. Drives the trigger
   *  styling (compact `+` only when filters exist, full pill otherwise). */
  hasAny: boolean;
}

interface Draft {
  column: ColumnConfig<StreamTimelineEvent>;
  operator: FilterOperator;
  value: unknown;
}

function LinearAddFilterButton({
  columns,
  appliedColumnIds,
  onAdd,
  hasAny,
}: LinearAddFilterButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [draft, setDraft] = React.useState<Draft | null>(null);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setDraft(null);
    }
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return columns;
    return columns.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
  }, [columns, query]);

  const commit = (next?: Partial<Draft>) => {
    const merged = next && draft ? { ...draft, ...next } : draft;
    if (!merged) return;
    onAdd({
      columnId: merged.column.id,
      operator: merged.operator,
      value: merged.value,
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Add filter"
          className={cx(
            "inline-flex h-[24px] items-center gap-[6px] rounded-md border px-[8px]",
            "font-sans text-[12px] font-medium leading-none",
            "transition-colors duration-fast",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember focus-visible:ring-offset-1 focus-visible:ring-offset-page",
            hasAny
              ? "border-transparent text-l-ink-dim hover:bg-l-wash-3 hover:text-l-ink"
              : "border-dashed border-hairline-strong text-l-ink-lo hover:border-l-border-strong hover:bg-l-wash-3 hover:text-l-ink",
          )}
        >
          <Plus size={10} strokeWidth={2} aria-hidden />
          {hasAny ? null : "Filter"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-[230px] p-0"
      >
        {draft === null ? (
          <ColumnPicker
            columns={filtered}
            appliedColumnIds={appliedColumnIds}
            query={query}
            onQueryChange={setQuery}
            onPick={(column) => {
              const operator = defaultOperatorFor(column.type);
              setDraft({
                column,
                operator,
                value: defaultValueFor(column.type, operator),
              });
            }}
          />
        ) : (
          <DraftView
            draft={draft}
            onBack={() => setDraft(null)}
            onChangeOperator={(op) =>
              setDraft((d) => (d ? { ...d, operator: op } : d))
            }
            onChangeValue={(v) =>
              setDraft((d) => (d ? { ...d, value: v } : d))
            }
            onCommit={commit}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ── Column picker (Linear list-style) ───────────────────── */

function ColumnPicker({
  columns,
  appliedColumnIds,
  query,
  onQueryChange,
  onPick,
}: {
  columns: readonly ColumnConfig<StreamTimelineEvent>[];
  appliedColumnIds: ReadonlySet<string>;
  query: string;
  onQueryChange: (v: string) => void;
  onPick: (column: ColumnConfig<StreamTimelineEvent>) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="border-b border-hairline px-[8px] py-[8px]">
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Filter…"
            autoFocus
            aria-label="Filter columns"
            className="pr-[28px]"
          />
          <span className="pointer-events-none absolute right-[4px] top-1/2 -translate-y-1/2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-xs border border-hairline-strong bg-l-surface px-[4px] font-sans text-[10px] text-l-ink-dim">
            F
          </span>
        </div>
      </div>
      <ul className="max-h-[320px] overflow-y-auto py-[4px]">
        {columns.length === 0 ? (
          <li className="px-[12px] py-[10px] font-sans text-[12px] text-l-ink-dim">
            No matches.
          </li>
        ) : (
          columns.map((column) => {
            const disabled = appliedColumnIds.has(column.id);
            return (
              <li key={column.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(column)}
                  className={cx(
                    "flex w-full items-center gap-[10px] px-[10px] py-[6px] text-left transition-colors",
                    disabled
                      ? "cursor-not-allowed opacity-40"
                      : "hover:bg-l-wash-3 focus-visible:bg-l-wash-3 focus-visible:outline-none",
                  )}
                >
                  <span className="inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center text-l-ink-dim">
                    {column.icon ?? <ColumnTypeGlyph type={column.type} />}
                  </span>
                  <span className="flex-1 truncate font-sans text-[12.5px] text-l-ink">
                    {column.label}
                  </span>
                  {disabled ? (
                    <span className="font-sans text-[10.5px] uppercase tracking-tactical text-l-ink-dim">
                      Active
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function ColumnTypeGlyph({ type }: { type: ColumnType }) {
  // Minimal mono shapes that read at 14×14, matching Linear's column
  // icons in the Filter dropdown (no decoration for unknown types).
  switch (type) {
    case "option":
      return (
        <svg viewBox="0 0 14 14" fill="none" className="h-3 w-3" aria-hidden>
          <circle cx="7" cy="7" r="3" fill="currentColor" />
        </svg>
      );
    case "multiOption":
      return (
        <svg viewBox="0 0 14 14" fill="none" className="h-3 w-3" aria-hidden>
          <circle cx="5" cy="7" r="2.5" fill="currentColor" />
          <circle
            cx="9.5"
            cy="7"
            r="2.5"
            fill="currentColor"
            opacity="0.6"
          />
        </svg>
      );
    case "text":
      return (
        <span className="font-sans text-[10px] font-medium leading-none">
          Aa
        </span>
      );
    case "number":
      return (
        <span className="font-sans text-[11px] font-medium leading-none">
          #
        </span>
      );
  }
}

/* ── Draft view (column → operator + value) ──────────────── */

function DraftView({
  draft,
  onBack,
  onChangeOperator,
  onChangeValue,
  onCommit,
}: {
  draft: Draft;
  onBack: () => void;
  onChangeOperator: (op: FilterOperator) => void;
  onChangeValue: (v: unknown) => void;
  onCommit: (next?: Partial<Draft>) => void;
}) {
  return (
    <div className="flex w-[230px] flex-col">
      <div className="flex items-center gap-[6px] border-b border-hairline px-[8px] py-[8px]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to columns"
          className="inline-flex h-[20px] w-[20px] items-center justify-center rounded-xs text-l-ink-dim transition-colors hover:bg-l-wash-3 hover:text-l-ink"
        >
          <ChevronLeft size={11} strokeWidth={1.75} aria-hidden />
        </button>
        <span className="font-sans text-[12px] font-medium text-l-ink">
          {draft.column.label}
        </span>
        <span className="ml-auto">
          <FilterOperatorMenu
            type={draft.column.type}
            operator={draft.operator}
            onChange={onChangeOperator}
          />
        </span>
      </div>
      <DraftEditor
        draft={draft}
        onChangeValue={onChangeValue}
        onCommit={onCommit}
      />
    </div>
  );
}

function DraftEditor({
  draft,
  onChangeValue,
  onCommit,
}: {
  draft: Draft;
  onChangeValue: (v: unknown) => void;
  onCommit: (next?: Partial<Draft>) => void;
}) {
  switch (draft.column.type) {
    case "option":
      return (
        <OptionEditor
          options={draft.column.options ?? []}
          value={draft.value as string | undefined}
          onChange={(v) => {
            onChangeValue(v);
            onCommit({ value: v });
          }}
        />
      );
    case "multiOption":
      return (
        <MultiOptionEditor
          options={draft.column.options ?? []}
          value={Array.isArray(draft.value) ? (draft.value as string[]) : []}
          onChange={onChangeValue}
          onSubmit={() => onCommit()}
        />
      );
    case "text":
      return (
        <TextEditor
          value={draft.value as string | undefined}
          onChange={onChangeValue}
          placeholder={draft.column.placeholder}
          onSubmit={(finalValue) => onCommit({ value: finalValue })}
        />
      );
    case "number":
      return (
        <NumberEditor
          operator={draft.operator}
          value={draft.value}
          onChange={onChangeValue}
          onSubmit={() => onCommit()}
        />
      );
    default:
      return null;
  }
}

/* ── Linear-style applied filter pill ────────────────────── */

interface LinearFilterPillProps {
  column: ColumnConfig<StreamTimelineEvent>;
  filter: FilterState;
  onOperatorChange: (next: FilterOperator) => void;
  onValueChange: (next: unknown) => void;
  onRemove: () => void;
}

function LinearFilterPill({
  column,
  filter,
  onOperatorChange,
  onValueChange,
  onRemove,
}: LinearFilterPillProps) {
  const [open, setOpen] = React.useState(false);
  const operatorMeta = OPERATORS[filter.operator];
  const valueDisplay = renderValueDisplay(column, filter);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className="group inline-flex h-[24px] items-stretch overflow-hidden rounded-md border border-hairline-strong bg-l-surface text-l-ink"
        data-filter-id={filter.id}
      >
        <span className="inline-flex items-center gap-[5px] border-r border-hairline-strong bg-l-surface-bar-2 px-[8px] font-sans text-[11.5px] font-medium text-l-ink-lo">
          {column.icon ? (
            <span className="inline-flex h-[12px] w-[12px] shrink-0 items-center justify-center text-l-ink-dim">
              {column.icon}
            </span>
          ) : null}
          {column.label}
        </span>
        <span className="inline-flex items-center border-r border-hairline-strong px-[2px]">
          <FilterOperatorMenu
            type={column.type}
            operator={filter.operator}
            onChange={onOperatorChange}
          />
        </span>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Edit ${column.label} filter — currently ${operatorMeta?.label ?? filter.operator}`}
            className="inline-flex items-center px-[8px] font-sans text-[11.5px] text-l-ink transition-colors hover:bg-l-wash-3"
          >
            {valueDisplay}
          </button>
        </PopoverTrigger>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${column.label} filter`}
          className="inline-flex h-full w-[20px] items-center justify-center border-l border-hairline-strong text-l-ink-dim transition-colors hover:bg-[rgba(239,68,68,0.12)] hover:text-event-red"
        >
          <X size={10} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <PopoverContent side="bottom" align="start" className="w-[230px] p-0">
        <div className="flex items-center gap-[6px] border-b border-hairline px-[8px] py-[8px]">
          <span className="font-sans text-[12px] font-medium text-l-ink">
            {column.label}
          </span>
          <span className="ml-auto font-sans text-[10.5px] text-l-ink-dim">
            {operatorMeta?.label ?? filter.operator}
          </span>
        </div>
        <FilterValueEditor
          column={column}
          filter={filter}
          onValueChange={onValueChange}
          onCommit={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

function FilterValueEditor({
  column,
  filter,
  onValueChange,
  onCommit,
}: {
  column: ColumnConfig<StreamTimelineEvent>;
  filter: FilterState;
  onValueChange: (next: unknown) => void;
  onCommit: () => void;
}) {
  switch (column.type) {
    case "option":
      return (
        <OptionEditor
          options={column.options ?? []}
          value={filter.value as string | undefined}
          onChange={onValueChange}
          onCommit={onCommit}
        />
      );
    case "multiOption":
      return (
        <MultiOptionEditor
          options={column.options ?? []}
          value={Array.isArray(filter.value) ? (filter.value as string[]) : []}
          onChange={onValueChange}
          onSubmit={onCommit}
        />
      );
    case "text":
      return (
        <TextEditor
          value={filter.value as string | undefined}
          onChange={onValueChange}
          placeholder={column.placeholder}
          onSubmit={(finalValue) => {
            if (finalValue !== undefined) onValueChange(finalValue);
            onCommit();
          }}
        />
      );
    case "number":
      return (
        <NumberEditor
          operator={filter.operator}
          value={filter.value}
          onChange={onValueChange}
          onSubmit={onCommit}
        />
      );
    default:
      return null;
  }
}

function renderValueDisplay(
  column: ColumnConfig<StreamTimelineEvent>,
  filter: FilterState,
): React.ReactNode {
  if (column.type === "option") {
    if (filter.value == null || filter.value === "") {
      return <span className="text-l-ink-dim">choose…</span>;
    }
    const opt = column.options?.find((o) => o.value === filter.value);
    return opt?.label ?? String(filter.value);
  }
  if (column.type === "multiOption") {
    const list = Array.isArray(filter.value) ? (filter.value as string[]) : [];
    if (list.length === 0) {
      return <span className="text-l-ink-dim">choose…</span>;
    }
    if (list.length === 1) {
      const opt = column.options?.find((o) => o.value === list[0]);
      return opt?.label ?? list[0];
    }
    return (
      <span className="font-medium text-l-ink">
        {list.length}{" "}
        <span className="font-normal text-l-ink-lo">selected</span>
      </span>
    );
  }
  if (column.type === "text") {
    const v = (filter.value as string | undefined) ?? "";
    if (v.trim() === "") {
      return <span className="text-l-ink-dim">type…</span>;
    }
    return `"${v}"`;
  }
  if (column.type === "number") {
    if (filter.operator === "between") {
      const [lo, hi] = Array.isArray(filter.value)
        ? (filter.value as [unknown, unknown])
        : [undefined, undefined];
      if (lo == null && hi == null) {
        return <span className="text-l-ink-dim">range…</span>;
      }
      return `${lo ?? "…"} – ${hi ?? "…"}`;
    }
    if (filter.value == null || filter.value === "") {
      return <span className="text-l-ink-dim">value…</span>;
    }
    return String(filter.value);
  }
  return null;
}
