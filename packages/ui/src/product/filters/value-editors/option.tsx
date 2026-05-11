"use client";

import * as React from "react";

import { Input } from "../../../primitives/input";
import { tv } from "../../../utils/tv";
import { useIsCoarsePointer } from "../../../utils/use-is-coarse-pointer";
import type { ColumnOption } from "../types";

const styles = tv({
  slots: {
    root: "flex w-full flex-col gap-s-2 p-s-2",
    list: "max-h-[280px] overflow-auto outline-none",
    item:
      "flex cursor-pointer select-none items-center gap-s-3 rounded-xs px-s-2 py-s-2 " +
      "font-mono text-mono text-ink outline-none " +
      "hover:bg-surface-03 focus-visible:bg-surface-03 " +
      "data-[selected=true]:bg-surface-03 data-[selected=true]:text-ink-hi",
    check:
      "h-[14px] w-[14px] shrink-0 text-ember opacity-0 " +
      "group-data-[selected=true]:opacity-100",
    dot: "inline-block h-[8px] w-[8px] shrink-0 rounded-full bg-ink-dim",
    empty: "px-s-3 py-s-4 font-mono text-mono-sm text-ink-dim",
  },
});

export interface OptionEditorProps {
  options: ColumnOption[];
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  onCommit?: () => void;
}

export function OptionEditor({
  options,
  value,
  onChange,
  onCommit,
}: OptionEditorProps) {
  const [query, setQuery] = React.useState("");
  const coarsePointer = useIsCoarsePointer();
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [query, options]);

  const slots = styles({});

  return (
    <div className={slots.root()}>
      <Input
        search
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search\u2026"
        autoFocus={!coarsePointer}
        aria-label="Search options"
      />
      <div role="status" aria-live="polite" className="sr-only">
        {filtered.length} {filtered.length === 1 ? "option" : "options"}
      </div>
      <div
        className={slots.list()}
        role="listbox"
        aria-label="Options"
      >
        {filtered.length ? (
          filtered.map((o) => {
            const selected = value === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                data-selected={selected || undefined}
                className={`${slots.item()} group`}
                onClick={() => {
                  onChange(o.value);
                  onCommit?.();
                }}
              >
                {o.icon ?? <span className={slots.dot()} aria-hidden />}
                <span className="flex-1 truncate">{o.label}</span>
                <svg
                  aria-hidden
                  viewBox="0 0 18 18"
                  fill="none"
                  className={slots.check()}
                >
                  <polyline
                    points="1 9 7 14 15 4"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
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
