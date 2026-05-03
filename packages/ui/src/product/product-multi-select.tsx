import * as React from "react";

import { Input } from "../primitives/input";
import { cx } from "../utils/cx";

export interface ProductMultiSelectOption {
  id: string;
  label: React.ReactNode;
  textValue?: string;
  description?: React.ReactNode;
  section?: React.ReactNode;
  icon?: React.ReactNode;
}

export interface ProductMultiSelectProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange"
> {
  options: ProductMultiSelectOption[];
  selectedIds?: string[];
  defaultSelectedIds?: string[];
  onChange?: (next: string[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: React.ReactNode;
  clearLabel?: React.ReactNode;
}

function optionText(option: ProductMultiSelectOption) {
  if (option.textValue) return option.textValue;
  if (typeof option.label === "string") return option.label;
  return option.id;
}

export function ProductMultiSelect({
  options,
  selectedIds,
  defaultSelectedIds = [],
  onChange,
  searchable = true,
  searchPlaceholder = "Search...",
  emptyLabel = "No matches",
  clearLabel = "Clear",
  className,
  ...props
}: ProductMultiSelectProps) {
  const isControlled = selectedIds !== undefined;
  const [internalSelected, setInternalSelected] =
    React.useState<string[]>(defaultSelectedIds);
  const [query, setQuery] = React.useState("");
  const selected = selectedIds ?? internalSelected;
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) =>
      optionText(option).toLowerCase().includes(q)
    );
  }, [options, query]);

  const sections = React.useMemo(() => {
    const grouped = new Map<React.ReactNode, ProductMultiSelectOption[]>();
    for (const option of filtered) {
      const key = option.section ?? "";
      grouped.set(key, [...(grouped.get(key) ?? []), option]);
    }
    return Array.from(grouped.entries());
  }, [filtered]);

  const commit = React.useCallback(
    (next: string[]) => {
      if (!isControlled) setInternalSelected(next);
      onChange?.(next);
    },
    [isControlled, onChange]
  );

  return (
    <div
      className={cx(
        "overflow-hidden rounded-md border border-hairline-strong bg-l-surface",
        className
      )}
      {...props}
    >
      {searchable ? (
        <div className="border-b border-hairline-strong px-s-2 py-s-2">
          <Input
            search
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </div>
      ) : null}

      <div className="max-h-[280px] overflow-auto">
        {sections.length === 0 ? (
          <div className="px-s-3 py-s-4 font-mono text-[10px] text-l-ink-dim">
            {emptyLabel}
          </div>
        ) : (
          sections.map(([section, items]) => (
            <div key={String(section || "default")}>
              {section ? (
                <div className="border-t border-hairline-strong px-s-2 py-[6px] first:border-t-0 font-sans text-[11px] font-medium text-l-ink-dim">
                  {section}
                </div>
              ) : null}
              {items.map((option) => {
                const isSelected = selectedSet.has(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={cx(
                      "flex w-full cursor-pointer select-none items-center gap-s-3 px-s-3 py-s-2 text-left transition-colors",
                      isSelected
                        ? "bg-l-surface-selected"
                        : "hover:bg-l-surface-hover"
                    )}
                    onClick={() => {
                      const next = isSelected
                        ? selected.filter((id) => id !== option.id)
                        : [...selected, option.id];
                      commit(next);
                    }}
                  >
                    <span
                      className={cx(
                        "relative flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-xs border",
                        isSelected
                          ? "border-[var(--l-accent)] bg-[var(--l-accent)]"
                          : "border-l-border-strong bg-transparent"
                      )}
                      aria-hidden
                    >
                      {isSelected ? (
                        <svg
                          viewBox="0 0 18 18"
                          fill="none"
                          className="h-[10px] w-[10px] text-white"
                        >
                          <polyline
                            points="1 9 7 14 15 4"
                            stroke="currentColor"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </span>
                    {option.icon ? (
                      <span className="shrink-0 text-l-ink-dim">
                        {option.icon}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span
                        className={cx(
                          "block truncate text-[13px]",
                          isSelected
                            ? "font-medium text-l-ink"
                            : "text-l-ink-lo"
                        )}
                      >
                        {option.label}
                      </span>
                      {option.description ? (
                        <span className="mt-[2px] block truncate text-[10px] text-l-ink-dim">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between border-t border-hairline-strong px-s-3 py-s-2 font-mono text-[10px] text-l-ink-dim">
        <span>
          {selected.length} of {options.length} selected
        </span>
        {selected.length > 0 ? (
          <button
            type="button"
            className="rounded-md px-[6px] py-[3px] text-l-ink-dim hover:bg-l-wash-3 hover:text-l-ink"
            onClick={() => commit([])}
          >
            {clearLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
