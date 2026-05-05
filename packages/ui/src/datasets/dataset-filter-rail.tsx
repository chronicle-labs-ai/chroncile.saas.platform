"use client";

import * as React from "react";
import { Check, ListFilter, Plus, PlusCircle, X } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { Badge } from "../primitives/badge";
import { Input } from "../primitives/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../primitives/command";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";
import { Separator } from "../primitives/separator";
import {
  coerceValueForOperator,
  defaultOperatorFor,
  defaultValueFor,
  OPERATORS,
  OPERATORS_BY_TYPE,
} from "../product/filters";
import type {
  ColumnConfig,
  ColumnOption,
  FilterActions,
  FilterOperator,
  FilterState,
} from "../product/filters";

import type { TraceSummary } from "./types";

/*
 * DatasetFilterRail — Linear-density filter rail for the dataset
 * canvas. Designed to live alongside the new Display popover so
 * pills and triggers share the same visual language: 24 px chips
 * with `bg-l-surface-input` surfaces, hairline-divided popover
 * sections, sans-12 text, no mono-uppercase verbosity.
 *
 * The rail is presentational over the existing
 * `useDataTableFilters` actions surface — same column configs,
 * same operator lifecycle, same predicate evaluation. Only the
 * chrome differs.
 *
 * Relationship to the tablecn-flavored `DataTableFacetedFilter` in
 * `./data-table/`:
 *
 *   - `DataTableFacetedFilter` is TanStack-coupled (consumes a
 *     `Column<TData>` from `useReactTable` and uses
 *     `column.setFilterValue`). It's the right tool when a future
 *     surface wants its filter state to live in TanStack's
 *     `ColumnFiltersState` directly.
 *   - This rail is `useDataTableFilters`-coupled. It powers the
 *     dataset detail page today AND every other Chronicle surface
 *     that already speaks the `FilterState[]` API (Connections,
 *     Agents, Stream timeline). Migrating those en masse is out of
 *     scope; instead we mirror tablecn's faceted UX on top of the
 *     existing actions surface so the dataset rail visually +
 *     behaviorally matches what `DataTableFacetedFilter` ships.
 *
 * The multi-option editor uses chron's `Command` primitive (which
 * wraps `cmdk` — the same primitive `DataTableFacetedFilter` uses)
 * so fuzzy search behaves identically across the two flavors.
 *
 * For the brand-density data-table look (mono uppercase, large
 * 28 px pills with dividers), keep using
 * `<DataTableFilterBar>` + `<DataTableFilterPill>` from
 * `product/filters`.
 */

export interface DatasetFilterRailProps {
  columns: ColumnConfig<TraceSummary>[];
  filters: readonly FilterState[];
  actions: FilterActions;
  /** Hide the "Clear" affordance. Defaults to shown when ≥1 chip. */
  showClear?: boolean;
  className?: string;
  /** Render the "+ Filter" trigger as an icon-only square pill, matching
   *  the dataset toolbar's icon-button row (and showing a dot when any
   *  filter is active). The trigger is also rendered unconditionally in
   *  this mode so it stays anchored even when no addable columns remain. */
  compact?: boolean;
  /**
   * Which parts of the rail to render.
   *
   *   - `"all"` *(default)* — chips + add-filter trigger + clear.
   *   - `"chips"` — only the active filter chips and the clear button.
   *     Pair with a separately-mounted `slot="trigger"` if you want
   *     to host the chips and the trigger in different parts of the
   *     layout (e.g. Linear-style chip bar below a toolbar).
   *   - `"trigger"` — only the add-filter trigger. Implies `compact`.
   */
  slot?: "all" | "chips" | "trigger";
}

export function DatasetFilterRail({
  columns,
  filters,
  actions,
  showClear = true,
  className,
  compact,
  slot = "all",
}: DatasetFilterRailProps) {
  const columnById = React.useMemo(
    () => new Map(columns.map((c) => [c.id, c] as const)),
    [columns]
  );

  const activeMultiOptionIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const filter of filters) {
      const column = columnById.get(filter.columnId);
      if (column?.type === "multiOption") ids.add(column.id);
    }
    return ids;
  }, [columnById, filters]);

  const addableColumns = React.useMemo(
    () =>
      columns.filter(
        (column) =>
          column.type === "multiOption" && !activeMultiOptionIds.has(column.id)
      ),
    [activeMultiOptionIds, columns]
  );

  const showChips = slot !== "trigger";
  const showTrigger = slot !== "chips";

  return (
    <div
      role="toolbar"
      aria-label="Filters"
      className={cx("flex flex-wrap items-center gap-1.5", className)}
    >
      {showChips
        ? filters.map((f) => {
            const col = columnById.get(f.columnId);
            if (!col) return null;
            if (col.type === "multiOption") {
              return (
                <DatasetFacetedFilterChip
                  key={f.id}
                  column={col}
                  filter={f}
                  onAdd={(value) =>
                    actions.addConfiguredFilter({
                      columnId: col.id,
                      operator: "isAnyOf",
                      value,
                    })
                  }
                  onUpdateValue={(value) => actions.updateValue(f.id, value)}
                  onRemove={() => actions.removeFilter(f.id)}
                />
              );
            }
            return (
              <DatasetFilterPill
                key={f.id}
                column={col}
                filter={f}
                onValueChange={(v) => actions.updateValue(f.id, v)}
                onOperatorChange={(op) => actions.updateOperator(f.id, op)}
                onRemove={() => actions.removeFilter(f.id)}
              />
            );
          })
        : null}

      {showTrigger && (compact || addableColumns.length > 0) ? (
        <DatasetFilterAdd
          columns={addableColumns}
          onAdd={(payload) => actions.addConfiguredFilter(payload)}
          compact={compact || slot === "trigger"}
          isActive={filters.length > 0}
        />
      ) : null}

      {showChips && showClear && filters.length > 0 ? (
        <button
          type="button"
          onClick={() => actions.clearAll()}
          className={cx(
            "inline-flex h-6 items-center gap-1 px-2 rounded-[3px]",
            "font-sans text-[11.5px] text-l-ink-dim",
            "transition-colors duration-fast ease-out motion-reduce:transition-none",
            "hover:bg-l-surface-hover hover:text-l-ink",
            "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
          )}
        >
          Clear Filters
          <X className="size-3" strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  );
}

/* ── Faceted filter chip (tablecn-style, useDataTableFilters API) ─ */

interface DatasetFacetedFilterChipProps {
  column: ColumnConfig<TraceSummary>;
  /** Current FilterState for this column, or null when no filter is
   *  active (the chip then renders as a dashed-border "add" trigger). */
  filter: FilterState | null;
  /** Called when the user picks the first value(s) — the rail then
   *  asks `useDataTableFilters` to add a new FilterState. */
  onAdd: (value: string[]) => void;
  /** Called when the user toggles a value while the filter already
   *  exists. */
  onUpdateValue: (value: string[]) => void;
  /** Called when the user clicks the inline reset glyph. */
  onRemove: () => void;
}

function DatasetFacetedFilterChip({
  column,
  filter,
  onAdd,
  onUpdateValue,
  onRemove,
}: DatasetFacetedFilterChipProps) {
  const options = React.useMemo(() => column.options ?? [], [column.options]);
  const selected = React.useMemo(() => {
    if (!filter) return new Set<string>();
    return new Set(
      Array.isArray(filter.value) ? (filter.value as string[]) : []
    );
  }, [filter]);

  const onItemSelect = React.useCallback(
    (value: string) => {
      const next = new Set(selected);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      const arr = options.map((o) => o.value).filter((v) => next.has(v));
      if (filter) {
        if (arr.length === 0) {
          onRemove();
        } else {
          onUpdateValue(arr);
        }
      } else if (arr.length > 0) {
        onAdd(arr);
      }
    },
    [filter, onAdd, onUpdateValue, onRemove, options, selected]
  );

  const onReset = React.useCallback(
    (event?: React.MouseEvent) => {
      event?.stopPropagation();
      if (filter) onRemove();
    },
    [filter, onRemove]
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cx(
            "h-[26px] gap-1.5 px-2 text-[12px] text-l-ink-lo",
            selected.size === 0 ? "border-dashed" : null
          )}
        >
          {selected.size > 0 ? (
            <Check
              className="size-3.5 shrink-0 text-ember"
              strokeWidth={1.75}
              aria-hidden
            />
          ) : (
            <PlusCircle className="size-3.5" strokeWidth={1.75} />
          )}
          <span className="font-medium">{column.label}</span>
          {selected.size > 0 ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-0.5 h-3.5 data-[orientation=vertical]:h-3.5"
              />
              <Badge
                variant="ember"
                className="rounded-sm font-mono text-[10px] lg:hidden"
              >
                {selected.size}
              </Badge>
              <div className="hidden items-center gap-1 lg:flex">
                {selected.size > 2 ? (
                  <Badge
                    variant="ember"
                    className="rounded-sm font-mono text-[10px]"
                  >
                    {selected.size} selected
                  </Badge>
                ) : (
                  options
                    .filter((o) => selected.has(o.value))
                    .map((o) => (
                      <Badge
                        key={o.value}
                        variant="ember"
                        className="rounded-sm font-mono text-[10px]"
                      >
                        {o.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={column.label} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => onItemSelect(option.value)}
                  >
                    <span
                      aria-hidden
                      className={cx(
                        "mr-2 inline-flex size-3.5 shrink-0 items-center justify-center rounded-xs border",
                        isSelected
                          ? "bg-ember border-ember text-white"
                          : "border-l-border-strong opacity-60"
                      )}
                    >
                      {isSelected ? (
                        <Check className="size-3" strokeWidth={3} />
                      ) : null}
                    </span>
                    <span className="flex-1 truncate">{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.size > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onReset()}
                    className="justify-center text-center text-l-ink-lo"
                  >
                    Clear filter
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ── Single pill ─────────────────────────────────────────── */

interface DatasetFilterPillProps {
  column: ColumnConfig<TraceSummary>;
  filter: FilterState;
  onValueChange: (next: unknown) => void;
  onOperatorChange: (next: FilterOperator) => void;
  onRemove: () => void;
}

function DatasetFilterPill({
  column,
  filter,
  onValueChange,
  onOperatorChange,
  onRemove,
}: DatasetFilterPillProps) {
  const [editorOpen, setEditorOpen] = React.useState(false);

  return (
    <div
      data-filter-id={filter.id}
      className={cx(
        "inline-flex h-6 items-stretch overflow-hidden rounded-[3px]",
        "[@media(pointer:coarse)]:h-9",
        "border border-l-border-faint bg-l-surface-input",
        "font-sans text-[11.5px] text-l-ink",
        "transition-colors duration-fast ease-out motion-reduce:transition-none",
        "hover:border-hairline-strong"
      )}
    >
      <span className="inline-flex items-center gap-1 pl-2 pr-1.5 text-l-ink-lo">
        {column.icon ? <span className="shrink-0">{column.icon}</span> : null}
        <span className="truncate">{column.label}</span>
      </span>

      <span aria-hidden className="w-px self-stretch bg-hairline" />

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cx(
              "inline-flex items-center px-1.5",
              "font-sans text-[10.5px] text-l-ink-dim",
              "hover:bg-l-surface-hover hover:text-l-ink",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
              "transition-colors duration-fast ease-out motion-reduce:transition-none"
            )}
            aria-label={`${column.label} operator`}
          >
            {operatorLabel(filter.operator)}
          </button>
        </PopoverTrigger>
        <PopoverContent placement="bottom start" className="w-[200px] p-1">
          <ul role="listbox" className="flex flex-col">
            {OPERATORS_BY_TYPE[column.type].map((opKey) => {
              const meta = OPERATORS[opKey];
              const active = opKey === filter.operator;
              return (
                <li key={opKey}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => onOperatorChange(opKey)}
                    className={cx(
                      "flex w-full items-center justify-between rounded-[3px] px-2 py-1.5 text-left",
                      "font-sans text-[12px] text-l-ink",
                      "hover:bg-l-surface-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
                      active ? "bg-l-surface-selected" : null
                    )}
                  >
                    <span>{meta.label}</span>
                    {active ? (
                      <Check
                        className="ml-2 size-3.5 text-ember"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>

      <span aria-hidden className="w-px self-stretch bg-hairline" />

      <Popover open={editorOpen} onOpenChange={setEditorOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cx(
              "inline-flex items-center px-2 font-medium text-l-ink",
              "transition-colors duration-fast ease-out motion-reduce:transition-none",
              "hover:bg-l-surface-hover",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
            )}
            aria-label={`${column.label} value`}
          >
            <ValueSummary column={column} filter={filter} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          placement="bottom start"
          className="w-[260px] overflow-hidden p-0"
        >
          <FilterValueEditor
            column={column}
            filter={filter}
            onChange={onValueChange}
            onCommit={() => setEditorOpen(false)}
          />
        </PopoverContent>
      </Popover>

      <span aria-hidden className="w-px self-stretch bg-hairline" />

      <button
        type="button"
        aria-label={`Remove ${column.label} filter`}
        onClick={onRemove}
        className={cx(
          "inline-flex items-center px-1.5 text-l-ink-dim touch-manipulation",
          "[@media(pointer:coarse)]:px-3",
          "transition-colors duration-fast ease-out motion-reduce:transition-none",
          "hover:bg-l-p-urgent/10 hover:text-l-p-urgent",
          "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
        )}
      >
        <X className="size-3" strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

/* ── Add-filter trigger ──────────────────────────────────── */

interface DatasetFilterAddProps {
  columns: ColumnConfig<TraceSummary>[];
  onAdd: (filter: Omit<FilterState, "id">) => void;
  /** Render the trigger as an icon-only square pill (with a dot when
   *  any filter is currently active). */
  compact?: boolean;
  /** Drives the dot indicator in compact mode. */
  isActive?: boolean;
}

function DatasetFilterAdd({
  columns,
  onAdd,
  compact,
  isActive,
}: DatasetFilterAddProps) {
  const [open, setOpen] = React.useState(false);
  const [draftColumn, setDraftColumn] =
    React.useState<ColumnConfig<TraceSummary> | null>(null);
  const [draftOperator, setDraftOperator] =
    React.useState<FilterOperator>("isAnyOf");
  const [draftValue, setDraftValue] = React.useState<unknown>(undefined);

  const reset = () => {
    setDraftColumn(null);
    setDraftOperator("isAnyOf");
    setDraftValue(undefined);
  };

  const handleClose = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  };

  const startDraftFor = (col: ColumnConfig<TraceSummary>) => {
    const op = defaultOperatorFor(col.type);
    setDraftColumn(col);
    setDraftOperator(op);
    setDraftValue(defaultValueFor(col.type, op));
  };

  const commit = (overrideValue?: unknown) => {
    if (!draftColumn) return;
    const value = overrideValue !== undefined ? overrideValue : draftValue;
    onAdd({
      columnId: draftColumn.id,
      operator: draftOperator,
      value,
    });
    handleClose(false);
  };

  return (
    <Popover open={open} onOpenChange={handleClose}>
      <PopoverTrigger asChild>
        {compact ? (
          <button
            type="button"
            aria-label="Filter"
            title="Filter"
            className={cx(
              "relative inline-flex size-8 shrink-0 items-center justify-center rounded-[10px]",
              "border border-l-border-faint bg-l-wash-1 text-l-ink-lo",
              "transition-colors duration-fast ease-out motion-reduce:transition-none",
              "hover:bg-l-wash-3 hover:text-l-ink",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
              isActive ? "text-l-ink" : null
            )}
          >
            <ListFilter className="size-4" strokeWidth={1.75} aria-hidden />
            {isActive ? (
              <span
                aria-hidden
                className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-ember"
              />
            ) : null}
          </button>
        ) : (
          <button
            type="button"
            className={cx(
              "inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2.5",
              "[@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:px-3",
              "border border-l-border-faint bg-l-wash-1",
              "font-sans text-[12px] font-medium text-l-ink-lo",
              "transition-[background-color,border-color,color] duration-fast ease-out motion-reduce:transition-none",
              "hover:border-l-border-hover hover:bg-l-wash-3 hover:text-l-ink",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
            )}
            aria-label="Filter"
          >
            <Plus className="size-3.5" strokeWidth={1.75} aria-hidden />
            <span>Filter</span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        placement="bottom start"
        className="w-[280px] overflow-hidden rounded-[10px] border-hairline-strong bg-l-surface-raised p-0 shadow-[0_18px_48px_-24px_rgba(0,0,0,0.65)]"
      >
        {draftColumn === null ? (
          <ColumnPicker columns={columns} onPick={startDraftFor} />
        ) : (
          <DraftEditor
            column={draftColumn}
            operator={draftOperator}
            value={draftValue}
            onBack={reset}
            onChangeOperator={(op) => {
              setDraftOperator(op);
              setDraftValue((prev: unknown) =>
                coerceValueForOperator(
                  draftColumn.type,
                  draftOperator,
                  op,
                  prev
                )
              );
            }}
            onChangeValue={setDraftValue}
            onCommit={commit}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ── Column picker (shared by Add) ───────────────────────── */

function ColumnPicker({
  columns,
  onPick,
}: {
  columns: ColumnConfig<TraceSummary>[];
  onPick: (col: ColumnConfig<TraceSummary>) => void;
}) {
  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return columns;
    return columns.filter(
      (c) => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    );
  }, [query, columns]);

  return (
    <div className="flex flex-col">
      <div className="border-b border-hairline px-2 py-1.5">
        <Input
          search
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder="Add Filter…"
          aria-label="Search filter columns"
        />
      </div>
      <ul
        role="listbox"
        aria-label="Filter columns"
        className="max-h-[280px] overflow-auto p-1"
      >
        {filtered.length === 0 ? (
          <li className="px-2 py-3 font-mono text-[10.5px] text-l-ink-dim">
            No matching columns.
          </li>
        ) : (
          filtered.map((col) => (
            <li key={col.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => onPick(col)}
                className={cx(
                  "flex w-full items-center justify-between gap-2 rounded-[3px] px-2 py-1.5 text-left",
                  "font-sans text-[12px] text-l-ink",
                  "hover:bg-l-surface-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {col.icon ? (
                    <span className="shrink-0 text-l-ink-dim">{col.icon}</span>
                  ) : null}
                  <span className="truncate">{col.label}</span>
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-l-ink-dim">
                  {typeShortLabel(col.type)}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/* ── Draft editor (column already picked, configuring value) ─ */

function DraftEditor({
  column,
  operator,
  value,
  onBack,
  onChangeOperator,
  onChangeValue,
  onCommit,
}: {
  column: ColumnConfig<TraceSummary>;
  operator: FilterOperator;
  value: unknown;
  onBack: () => void;
  onChangeOperator: (op: FilterOperator) => void;
  onChangeValue: (v: unknown) => void;
  onCommit: (override?: unknown) => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Section 1 — column + operator */}
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          className={cx(
            "inline-flex h-6 items-center gap-1 rounded-[3px] px-1.5 text-l-ink-dim",
            "font-sans text-[11.5px]",
            "hover:bg-l-surface-hover hover:text-l-ink",
            "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
          )}
          aria-label="Back to columns"
        >
          ‹ <span>{column.label}</span>
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cx(
                "inline-flex h-6 items-center gap-1 rounded-[3px] px-2",
                "bg-l-surface-input font-sans text-[11.5px] text-l-ink",
                "hover:bg-l-surface-hover",
                "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember"
              )}
            >
              <span>{operatorLabel(operator)}</span>
              <span aria-hidden className="text-l-ink-dim">
                ⌄
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent placement="bottom end" className="w-[200px] p-1">
            <ul role="listbox" className="flex flex-col">
              {OPERATORS_BY_TYPE[column.type].map((opKey) => {
                const meta = OPERATORS[opKey];
                const active = opKey === operator;
                return (
                  <li key={opKey}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => onChangeOperator(opKey)}
                      className={cx(
                        "flex w-full items-center justify-between rounded-[3px] px-2 py-1.5 text-left",
                        "font-sans text-[12px] text-l-ink",
                        "hover:bg-l-surface-hover",
                        active ? "bg-l-surface-selected" : null
                      )}
                    >
                      <span>{meta.label}</span>
                      {active ? (
                        <Check
                          className="ml-2 size-3.5 text-ember"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </PopoverContent>
        </Popover>
      </div>

      {/* Section 2 — editor */}
      <div className="border-b border-hairline">
        <FilterValueEditor
          column={column}
          filter={
            {
              id: "__draft__",
              columnId: column.id,
              operator,
              value,
            } as FilterState
          }
          onChange={onChangeValue}
          onCommit={() => onCommit()}
          autoFocus
        />
      </div>

      {column.type !== "option" ? (
        <div className="flex items-center justify-end gap-2 px-3 py-2">
          <Button variant="ghost" size="sm" onPress={onBack}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!hasValue(column.type, value, operator)}
            onPress={() => onCommit()}
          >
            Apply
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ── Value editor (shared by pill + draft) ───────────────── */

function FilterValueEditor({
  column,
  filter,
  onChange,
  onCommit,
  autoFocus,
}: {
  column: ColumnConfig<TraceSummary>;
  filter: FilterState;
  onChange: (next: unknown) => void;
  onCommit: () => void;
  autoFocus?: boolean;
}) {
  switch (column.type) {
    case "option":
      return (
        <OptionList
          options={column.options ?? []}
          value={filter.value as string | undefined}
          onChange={(v) => {
            onChange(v);
            onCommit();
          }}
          autoFocus={autoFocus}
        />
      );
    case "multiOption":
      return (
        <MultiOptionList
          options={column.options ?? []}
          value={Array.isArray(filter.value) ? (filter.value as string[]) : []}
          onChange={(v) => onChange(v)}
          autoFocus={autoFocus}
        />
      );
    case "text":
      return (
        <div className="px-3 py-2">
          <Input
            autoFocus={autoFocus}
            value={(filter.value as string | undefined) ?? ""}
            onChange={(e) => onChange(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onCommit();
              }
            }}
            placeholder={column.placeholder ?? "Type a value…"}
          />
        </div>
      );
    case "number":
      if (filter.operator === "between") {
        const [lo, hi] = Array.isArray(filter.value)
          ? (filter.value as [unknown, unknown])
          : [undefined, undefined];
        return (
          <div className="flex flex-col gap-2 px-3 py-2">
            <Input
              autoFocus={autoFocus}
              type="number"
              value={lo == null ? "" : String(lo)}
              onChange={(e) =>
                onChange([numberOrNull(e.currentTarget.value), hi ?? null])
              }
              placeholder="Min"
            />
            <Input
              type="number"
              value={hi == null ? "" : String(hi)}
              onChange={(e) =>
                onChange([lo ?? null, numberOrNull(e.currentTarget.value)])
              }
              placeholder="Max"
            />
          </div>
        );
      }
      return (
        <div className="px-3 py-2">
          <Input
            autoFocus={autoFocus}
            type="number"
            value={filter.value == null ? "" : String(filter.value)}
            onChange={(e) => onChange(numberOrNull(e.currentTarget.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onCommit();
              }
            }}
            placeholder={column.placeholder ?? "Enter a number"}
          />
        </div>
      );
    default:
      return null;
  }
}

/* ── Inline option / multi-option lists ──────────────────── */

function OptionList({
  options,
  value,
  onChange,
  autoFocus,
}: {
  options: readonly ColumnOption[];
  value: string | undefined;
  onChange: (next: string) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(
    () => filterOptions(options, query),
    [options, query]
  );
  return (
    <div className="flex flex-col">
      <div className="border-b border-hairline px-2 py-1.5">
        <Input
          search
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search…"
          aria-label="Search options"
        />
      </div>
      <ul role="listbox" className="max-h-[260px] overflow-auto p-1">
        {filtered.length === 0 ? (
          <li className="px-2 py-3 font-mono text-[10.5px] text-l-ink-dim">
            No matches.
          </li>
        ) : (
          filtered.map((opt) => {
            const selected = value === opt.value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onChange(opt.value)}
                  className={cx(
                    "flex w-full items-center justify-between gap-2 rounded-[3px] px-2 py-1.5 text-left",
                    "font-sans text-[12px] text-l-ink",
                    "hover:bg-l-surface-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
                    selected ? "bg-l-surface-selected" : null
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {selected ? (
                    <Check
                      className="size-3.5 text-ember"
                      strokeWidth={1.75}
                      aria-hidden
                    />
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

function MultiOptionList({
  options,
  value,
  onChange,
}: {
  options: readonly ColumnOption[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  autoFocus?: boolean;
}) {
  const selected = React.useMemo(() => new Set(value), [value]);

  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    /* Preserve the option order so chips/groups don't reorder
       when toggling. */
    onChange(options.map((o) => o.value).filter((id) => next.has(id)));
  };

  return (
    <Command>
      <CommandInput placeholder="Search…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup>
          {options.map((opt) => {
            const isSelected = selected.has(opt.value);
            return (
              <CommandItem
                key={opt.value}
                value={`${opt.label} ${opt.value}`}
                onSelect={() => toggle(opt.value)}
                aria-selected={isSelected}
              >
                <span
                  aria-hidden
                  className={cx(
                    "mr-2 flex size-3.5 shrink-0 items-center justify-center rounded-[2px] border",
                    isSelected
                      ? "border-ember bg-ember"
                      : "border-l-border-faint bg-l-surface-input"
                  )}
                >
                  {isSelected ? (
                    <Check
                      className="size-2.5 text-white"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                  ) : null}
                </span>
                <span className="flex-1 truncate">{opt.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        {value.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={() => onChange([])}
                className="justify-center text-center text-l-ink-lo"
              >
                Clear ({value.length} of {options.length})
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </Command>
  );
}

/* ── Helpers ─────────────────────────────────────────────── */

/** Pill-form operator label — uses the short glyph for compare ops
 *  ("=", ">", "≤", …) so the chip stays short, falls back to the
 *  long form for verbal ops ("is", "is any of", …). */
function operatorLabel(op: FilterOperator): string {
  return OPERATORS[op].pillLabel;
}

function typeShortLabel(type: ColumnConfig<TraceSummary>["type"]): string {
  switch (type) {
    case "option":
      return "Option";
    case "multiOption":
      return "Multi";
    case "text":
      return "Text";
    case "number":
      return "Number";
  }
}

function ValueSummary({
  column,
  filter,
}: {
  column: ColumnConfig<TraceSummary>;
  filter: FilterState;
}) {
  switch (column.type) {
    case "option": {
      const v = filter.value as string | undefined;
      if (!v) return <Placeholder>select…</Placeholder>;
      const opt = column.options?.find((o) => o.value === v);
      return <span className="truncate">{opt?.label ?? v}</span>;
    }
    case "multiOption": {
      const arr = Array.isArray(filter.value) ? (filter.value as string[]) : [];
      if (arr.length === 0) return <Placeholder>select…</Placeholder>;
      if (arr.length <= 2) {
        return (
          <span className="truncate">
            {arr
              .map(
                (v) => column.options?.find((o) => o.value === v)?.label ?? v
              )
              .join(", ")}
          </span>
        );
      }
      return <span className="truncate">{arr.length} selected</span>;
    }
    case "text": {
      const v = (filter.value as string | undefined) ?? "";
      return v ? (
        <span className="truncate">“{v}”</span>
      ) : (
        <Placeholder>type a value…</Placeholder>
      );
    }
    case "number": {
      if (filter.operator === "between") {
        const [lo, hi] = Array.isArray(filter.value)
          ? (filter.value as [unknown, unknown])
          : [undefined, undefined];
        if (lo == null && hi == null)
          return <Placeholder>set range…</Placeholder>;
        const loStr = lo == null || lo === "" ? "−∞" : String(lo);
        const hiStr = hi == null || hi === "" ? "∞" : String(hi);
        return (
          <span className="truncate font-mono tabular-nums">
            {loStr} – {hiStr}
          </span>
        );
      }
      const v = filter.value;
      return v == null || v === "" ? (
        <Placeholder>enter number…</Placeholder>
      ) : (
        <span className="truncate font-mono tabular-nums">{String(v)}</span>
      );
    }
  }
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <span className="italic text-l-ink-dim">{children}</span>;
}

function filterOptions(
  options: readonly ColumnOption[],
  query: string
): ColumnOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...options];
  return options.filter(
    (o) =>
      o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
  );
}

function numberOrNull(input: string): number | null {
  if (input.trim() === "") return null;
  const n = Number(input);
  return Number.isFinite(n) ? n : null;
}

function hasValue(
  type: ColumnConfig<TraceSummary>["type"],
  value: unknown,
  operator: FilterOperator
): boolean {
  switch (type) {
    case "option":
      return value != null && value !== "";
    case "multiOption":
      return Array.isArray(value) && value.length > 0;
    case "text":
      return typeof value === "string" && value.trim() !== "";
    case "number": {
      if (operator === "between") {
        const [lo, hi] = Array.isArray(value)
          ? (value as [unknown, unknown])
          : [undefined, undefined];
        return lo != null || hi != null;
      }
      return typeof value === "number" && Number.isFinite(value);
    }
  }
}
