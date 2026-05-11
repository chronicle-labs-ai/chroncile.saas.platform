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
      "hover:bg-surface-03 focus-visible:bg-surface-03",
    box:
      "relative flex h-[16px] w-[16px] shrink-0 items-center justify-center " +
      "rounded-xs border border-hairline-strong bg-surface-00 " +
      "group-data-[selected=true]:border-ember group-data-[selected=true]:bg-ember",
    mark:
      "h-[10px] w-[10px] opacity-0 text-white " +
      "group-data-[selected=true]:opacity-100",
    dot: "inline-block h-[8px] w-[8px] shrink-0 rounded-full bg-ink-dim",
    empty: "px-s-3 py-s-4 font-mono text-mono-sm text-ink-dim",
    footer:
      "flex items-center justify-between border-t border-hairline pt-s-2 " +
      "font-mono text-mono-sm text-ink-dim",
    clear:
      "rounded-xs px-s-2 py-[4px] text-ink-lo hover:text-ink-hi hover:bg-surface-03",
  },
});

export interface MultiOptionEditorProps {
  options: ColumnOption[];
  value: string[];
  onChange: (next: string[]) => void;
  /**
   * Accepted for API symmetry with the other editors. Committing is driven
   * by the parent's Apply button rather than a key handler here.
   */
  onSubmit?: () => void;
}

export function MultiOptionEditor({
  options,
  value,
  onChange,
}: MultiOptionEditorProps) {
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
  const selected = new Set(value);

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
        aria-multiselectable
      >
        {filtered.length ? (
          filtered.map((o) => {
            const isSelected = selected.has(o.value);
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-selected={isSelected || undefined}
                className={`${slots.item()} group`}
                onClick={() => {
                  const next = new Set(selected);
                  if (next.has(o.value)) next.delete(o.value);
                  else next.add(o.value);
                  onChange(Array.from(next));
                }}
              >
                <span className={slots.box()}>
                  <svg
                    aria-hidden
                    viewBox="0 0 18 18"
                    fill="none"
                    className={slots.mark()}
                  >
                    <polyline
                      points="1 9 7 14 15 4"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {o.icon ? <span className="shrink-0">{o.icon}</span> : null}
                <span className="flex-1 truncate">{o.label}</span>
              </button>
            );
          })
        ) : (
          <div className={slots.empty()}>No matches</div>
        )}
      </div>
      <div className={slots.footer()}>
        <span>
          {value.length} of {options.length}
        </span>
        {value.length > 0 ? (
          <button
            type="button"
            className={slots.clear()}
            onClick={() => onChange([])}
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
