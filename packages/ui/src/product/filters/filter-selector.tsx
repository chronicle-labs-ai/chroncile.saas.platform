"use client";

import * as React from "react";

import { Button } from "../../primitives/button";
import { Input } from "../../primitives/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../primitives/popover";
import { tv } from "../../utils/tv";

import { FilterOperatorMenu } from "./filter-operator";
import { coerceValueForOperator } from "./use-data-table-filters";
import { defaultOperatorFor, defaultValueFor } from "./operators";
import type {
  ColumnConfig,
  ColumnType,
  FilterOperator,
  FilterState,
} from "./types";
import { MultiOptionEditor } from "./value-editors/multi-option";
import { NumberEditor } from "./value-editors/number";
import { OptionEditor } from "./value-editors/option";
import { TextEditor } from "./value-editors/text";

const styles = tv({
  slots: {
    root: "flex w-[280px] flex-col gap-s-2 p-s-2",
    list: "max-h-[320px] overflow-auto outline-none",
    item:
      "flex cursor-pointer select-none items-center gap-s-3 rounded-xs px-s-2 py-s-2 " +
      "font-mono text-mono text-ink outline-none " +
      "hover:bg-surface-03 focus-visible:bg-surface-03 " +
      "data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
    icon:
      "inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center " +
      "rounded-xs border border-hairline bg-surface-00 text-ink-dim",
    label: "flex-1 truncate",
    type: "shrink-0 font-mono text-mono-sm uppercase tracking-tactical text-ink-dim",
    empty: "px-s-3 py-s-4 font-mono text-mono-sm text-ink-dim",
  },
});

const draftStyles = tv({
  slots: {
    root: "flex flex-col min-w-[260px]",
    header: "flex items-center gap-s-2 border-b border-hairline px-s-2 py-s-2",
    back:
      "inline-flex h-[24px] w-[24px] items-center justify-center rounded-xs " +
      "text-ink-dim outline-none transition-colors duration-fast ease-out " +
      "hover:bg-surface-03 hover:text-ink-hi " +
      "focus-visible:outline focus-visible:outline-1 " +
      "focus-visible:outline-ember",
    columnLabel:
      "font-mono text-mono-sm uppercase tracking-tactical text-ink-hi",
    operator: "ml-auto",
    footer:
      "flex items-center justify-end gap-s-2 border-t border-hairline px-s-2 py-s-2",
  },
});

const TYPE_LABEL: Record<ColumnType, string> = {
  option: "OPTION",
  multiOption: "MULTI",
  text: "TEXT",
  number: "NUMBER",
};

interface Draft<TRow> {
  column: ColumnConfig<TRow>;
  operator: FilterOperator;
  value: unknown;
}

export interface FilterSelectorProps<TRow> {
  columns: ColumnConfig<TRow>[];
  /** Called once the user has fully configured a new filter. */
  onAdd: (filter: Omit<FilterState, "id">) => void;
  /** Column ids already applied (shown disabled in the picker). */
  disabledIds?: string[];
  label?: React.ReactNode;
}

export function FilterSelector<TRow>({
  columns,
  onAdd,
  disabledIds,
  label = "Filter",
}: FilterSelectorProps<TRow>) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft<TRow> | null>(null);

  const reset = React.useCallback(() => {
    setDraft(null);
  }, []);

  const commit = React.useCallback(
    (override?: Partial<Draft<TRow>>) => {
      const merged = draft && override ? { ...draft, ...override } : draft;
      if (!merged) return;
      onAdd({
        columnId: merged.column.id,
        operator: merged.operator,
        value: merged.value,
      });
      setOpen(false);
      reset();
    },
    [draft, onAdd, reset]
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<PlusIcon />}
          aria-label="Add filter"
        >
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start">
        {draft === null ? (
          <ColumnPicker
            columns={columns}
            disabledIds={disabledIds}
            onPick={(col) => {
              const operator = defaultOperatorFor(col.type);
              const nextDraft: Draft<TRow> = {
                column: col,
                operator,
                value: defaultValueFor(col.type, operator),
              };
              if (col.type === "option") {
                // Options commit on single click inside the draft view.
                setDraft(nextDraft);
              } else {
                setDraft(nextDraft);
              }
            }}
          />
        ) : (
          <DraftView
            draft={draft}
            onBack={reset}
            onChangeOperator={(op) =>
              setDraft((d) =>
                d
                  ? {
                      ...d,
                      operator: op,
                      value: coerceValueForOperator(
                        d.column.type,
                        d.operator,
                        op,
                        d.value
                      ),
                    }
                  : d
              )
            }
            onChangeValue={(v) => setDraft((d) => (d ? { ...d, value: v } : d))}
            onCommit={(overrideValue) =>
              commit(
                overrideValue !== undefined
                  ? { value: overrideValue }
                  : undefined
              )
            }
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function ColumnPicker<TRow>({
  columns,
  disabledIds,
  onPick,
}: {
  columns: ColumnConfig<TRow>[];
  disabledIds?: string[];
  onPick: (column: ColumnConfig<TRow>) => void;
}) {
  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return columns;
    return columns.filter(
      (c) => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    );
  }, [query, columns]);

  const slots = styles({});

  return (
    <div className={slots.root()}>
      <Input
        search
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search columns\u2026"
        autoFocus
        aria-label="Search columns"
      />
      <div
        className={slots.list()}
        role="listbox"
        aria-label="Columns"
      >
        {filtered.length ? (
          filtered.map((c) => {
            const disabled = disabledIds?.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                disabled={disabled}
                data-disabled={disabled || undefined}
                className={slots.item()}
                onClick={() => {
                  if (!disabled) onPick(c);
                }}
              >
                <span className={slots.icon()}>
                  {c.icon ?? <ColumnGlyph type={c.type} />}
                </span>
                <span className={slots.label()}>{c.label}</span>
                <span className={slots.type()}>{TYPE_LABEL[c.type]}</span>
              </button>
            );
          })
        ) : (
          <div className={slots.empty()}>No matches</div>
        )}
      </div>
    </div>
  );
}

function DraftView<TRow>({
  draft,
  onBack,
  onChangeOperator,
  onChangeValue,
  onCommit,
}: {
  draft: Draft<TRow>;
  onBack: () => void;
  onChangeOperator: (op: FilterOperator) => void;
  onChangeValue: (v: unknown) => void;
  /** Optionally pass an override value (for option editors). */
  onCommit: (overrideValue?: unknown) => void;
}) {
  const slots = draftStyles({});
  const canApply = hasApplicableValue(draft);

  return (
    <div className={slots.root()}>
      <div className={slots.header()}>
        <button
          type="button"
          className={slots.back()}
          onClick={onBack}
          aria-label="Back to columns"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span className={slots.columnLabel()}>{draft.column.label}</span>
        <span className={slots.operator()}>
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

      {draft.column.type !== "option" ? (
        <div className={slots.footer()}>
          <Button variant="ghost" size="sm" onClick={onBack}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!canApply}
            onClick={() => onCommit()}
          >
            Apply
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function DraftEditor<TRow>({
  draft,
  onChangeValue,
  onCommit,
}: {
  draft: Draft<TRow>;
  onChangeValue: (v: unknown) => void;
  onCommit: (overrideValue?: unknown) => void;
}) {
  switch (draft.column.type) {
    case "option":
      return (
        <OptionEditor
          options={draft.column.options ?? []}
          value={draft.value as string | undefined}
          onChange={(v) => {
            onChangeValue(v);
            onCommit(v);
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
          onSubmit={(finalValue) => onCommit(finalValue)}
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

function hasApplicableValue<TRow>(draft: Draft<TRow>): boolean {
  switch (draft.column.type) {
    case "option":
      return draft.value != null && draft.value !== "";
    case "multiOption":
      return Array.isArray(draft.value) && draft.value.length > 0;
    case "text":
      return typeof draft.value === "string" && draft.value.trim() !== "";
    case "number":
      if (draft.operator === "between") {
        const [lo, hi] = Array.isArray(draft.value)
          ? (draft.value as [unknown, unknown])
          : [undefined, undefined];
        return lo != null || hi != null;
      }
      return typeof draft.value === "number" && Number.isFinite(draft.value);
    default:
      return false;
  }
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ColumnGlyph({ type }: { type: ColumnType }) {
  switch (type) {
    case "option":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden>
          <circle cx="12" cy="12" r="4" fill="currentColor" />
        </svg>
      );
    case "multiOption":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden>
          <circle cx="8" cy="12" r="3" fill="currentColor" />
          <circle cx="16" cy="12" r="3" fill="currentColor" opacity="0.6" />
        </svg>
      );
    case "text":
      return <span className="font-mono text-mono-sm leading-none">Aa</span>;
    case "number":
      return <span className="font-mono text-mono-sm leading-none">#</span>;
  }
}
