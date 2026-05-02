"use client";

import * as React from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../primitives/popover";
import { tv } from "../../utils/tv";

import { FilterOperatorMenu } from "./filter-operator";
import type { ColumnConfig, FilterOperator, FilterState } from "./types";
import { MultiOptionEditor } from "./value-editors/multi-option";
import { NumberEditor } from "./value-editors/number";
import { OptionEditor } from "./value-editors/option";
import { TextEditor } from "./value-editors/text";

const styles = tv({
  slots: {
    root:
      "inline-flex h-[28px] items-stretch overflow-hidden rounded-full " +
      "border border-hairline-strong bg-surface-01 " +
      "transition-colors duration-fast ease-out " +
      "hover:border-ink-dim",
    label:
      "flex items-center gap-s-2 pl-s-4 pr-s-3 " +
      "font-mono text-mono-sm uppercase tracking-tactical text-ink-hi",
    divider: "w-px self-stretch bg-hairline",
    operatorSlot: "flex items-center",
    value:
      "flex items-center gap-s-2 px-s-3 font-mono text-mono text-ink-lo " +
      "outline-none transition-colors duration-fast ease-out " +
      "hover:text-ink-hi hover:bg-surface-03 " +
      "focus-visible:outline focus-visible:outline-1 " +
      "focus-visible:outline-ember",
    close:
      "flex items-center pl-s-2 pr-s-3 text-ink-dim outline-none " +
      "transition-colors duration-fast ease-out " +
      "hover:text-ink-hi hover:bg-surface-03 " +
      "focus-visible:outline focus-visible:outline-1 " +
      "focus-visible:outline-ember",
    icon: "shrink-0 text-ink-dim",
    placeholder: "italic text-ink-dim",
  },
});

export interface DataTableFilterPillProps<TRow> {
  column: ColumnConfig<TRow>;
  filter: FilterState;
  onOperatorChange: (next: FilterOperator) => void;
  onValueChange: (next: unknown) => void;
  onRemove: () => void;
}

/**
 * DataTableFilterPill — the brand-density, fully-stateful filter pill
 * used inside the legacy `<FilterBar>` data-table primitive. Carries a
 * column descriptor, a `FilterState`, and edit/operator/remove
 * callbacks; opens a popover with the appropriate value editor.
 *
 * For a presentation-only Linear-style verb pill (`dim | verb | val |
 * ×`), use the `<FilterPill>` primitive in `primitives/`.
 */
export function DataTableFilterPill<TRow>({
  column,
  filter,
  onOperatorChange,
  onValueChange,
  onRemove,
}: DataTableFilterPillProps<TRow>) {
  const [open, setOpen] = React.useState(false);
  const slots = styles({});

  return (
    <div className={slots.root()} data-filter-id={filter.id}>
      <span className={slots.label()}>
        {column.icon ? (
          <span className={slots.icon()}>{column.icon}</span>
        ) : null}
        {column.label}
      </span>
      <span className={slots.divider()} aria-hidden />
      <span className={slots.operatorSlot()}>
        <FilterOperatorMenu
          type={column.type}
          operator={filter.operator}
          onChange={onOperatorChange}
        />
      </span>
      <span className={slots.divider()} aria-hidden />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={slots.value()} aria-label="Edit value">
            {renderValueSummary(column, filter, slots.placeholder())}
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start">
          <ValueEditor
            column={column}
            filter={filter}
            onChange={onValueChange}
            onCommit={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
      <span className={slots.divider()} aria-hidden />
      <button
        type="button"
        className={slots.close()}
        onClick={onRemove}
        aria-label={`Remove ${column.label} filter`}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden>
          <path
            d="M6 6l12 12M18 6l-12 12"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

function ValueEditor<TRow>({
  column,
  filter,
  onChange,
  onCommit,
}: {
  column: ColumnConfig<TRow>;
  filter: FilterState;
  onChange: (next: unknown) => void;
  onCommit: () => void;
}) {
  switch (column.type) {
    case "option":
      return (
        <OptionEditor
          options={column.options ?? []}
          value={filter.value as string | undefined}
          onChange={(v) => onChange(v)}
          onCommit={onCommit}
        />
      );
    case "multiOption":
      return (
        <MultiOptionEditor
          options={column.options ?? []}
          value={Array.isArray(filter.value) ? (filter.value as string[]) : []}
          onChange={(v) => onChange(v)}
        />
      );
    case "text":
      return (
        <TextEditor
          value={filter.value as string | undefined}
          onChange={(v) => onChange(v)}
          placeholder={column.placeholder}
        />
      );
    case "number":
      return (
        <NumberEditor
          operator={filter.operator}
          value={filter.value}
          onChange={(v) => onChange(v)}
        />
      );
    default:
      return null;
  }
}

function renderValueSummary<TRow>(
  column: ColumnConfig<TRow>,
  filter: FilterState,
  placeholderClass: string
): React.ReactNode {
  const placeholder = (text: string) => (
    <span className={placeholderClass}>{text}</span>
  );

  switch (column.type) {
    case "option": {
      const v = filter.value as string | undefined;
      if (v == null || v === "") return placeholder("select\u2026");
      const opt = column.options?.find((o) => o.value === v);
      return opt?.label ?? v;
    }
    case "multiOption": {
      const arr = Array.isArray(filter.value) ? (filter.value as string[]) : [];
      if (!arr.length) return placeholder("select\u2026");
      if (arr.length <= 2) {
        return arr
          .map((v) => column.options?.find((o) => o.value === v)?.label ?? v)
          .join(", ");
      }
      return `${arr.length} selected`;
    }
    case "text": {
      const v = (filter.value as string | undefined) ?? "";
      return v ? `\u201C${v}\u201D` : placeholder("enter text\u2026");
    }
    case "number": {
      if (filter.operator === "between") {
        const [lo, hi] = Array.isArray(filter.value)
          ? (filter.value as [unknown, unknown])
          : [undefined, undefined];
        const loStr = lo == null || lo === "" ? "\u2212\u221E" : String(lo);
        const hiStr = hi == null || hi === "" ? "\u221E" : String(hi);
        if (lo == null && hi == null) return placeholder("set range\u2026");
        return `${loStr} \u2013 ${hiStr}`;
      }
      const v = filter.value;
      return v == null || v === ""
        ? placeholder("enter number\u2026")
        : String(v);
    }
    default:
      return null;
  }
}
