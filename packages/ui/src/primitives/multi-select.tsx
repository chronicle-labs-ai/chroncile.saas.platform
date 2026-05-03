"use client";

import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "../utils/cn";

export const multiSelectRootVariants = cva("flex flex-col gap-s-1");

export const multiSelectTriggerVariants = cva(
  "relative flex w-full cursor-pointer items-center border shadow-[0_1px_0.5px_rgba(0,0,0,0.15)] outline-none transition-[background-color,border-color,color,box-shadow] duration-fast ease-out disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember h-[32px] rounded-md border-hairline-strong bg-l-surface-input px-[10px] font-sans text-[13px] text-l-ink hover:border-l-border-strong hover:bg-l-surface-hover",
  {
    variants: {
      invalid: {
        true: "border-event-red focus-visible:outline-event-red",
      },
    },
  }
);

export const multiSelectTriggerContentVariants = cva(
  "flex min-w-0 flex-1 items-center truncate text-left"
);

export const multiSelectValueVariants = cva("min-w-0 truncate", {
  variants: {
    state: {
      placeholder: "text-l-ink-dim",
      selected: "font-medium text-l-ink",
    },
  },
  defaultVariants: {
    state: "placeholder",
  },
});

export const multiSelectSupportingTextVariants = cva(
  "ml-[6px] truncate text-l-ink-dim"
);

export const multiSelectChevronVariants = cva(
  "ml-auto size-4 shrink-0 text-l-ink-dim transition-transform duration-fast",
  {
    variants: {
      open: {
        true: "rotate-180",
        false: "",
      },
    },
    defaultVariants: {
      open: false,
    },
  }
);

export const multiSelectPopoverVariants = cva(
  "absolute left-0 top-full z-50 mt-[4px] w-full overflow-hidden rounded-md border border-[var(--l-pop-border)] bg-[var(--l-pop-bg)] shadow-l-pop outline-none"
);

export const multiSelectSearchWrapVariants = cva(
  "border-b border-l-border-faint px-s-2 py-s-2"
);

export const multiSelectSearchRootVariants = cva(
  "flex h-[28px] items-center gap-[8px] rounded-md border border-hairline-strong bg-l-surface-input px-[10px] text-l-ink transition-colors duration-fast focus-within:border-[rgba(216,67,10,0.5)] focus-within:shadow-[0_0_0_3px_rgba(216,67,10,0.12)]"
);

export const multiSelectSearchInputVariants = cva(
  "min-w-0 flex-1 bg-transparent font-sans text-[13px] text-l-ink outline-none placeholder:text-l-ink-dim"
);

export const multiSelectListVariants = cva(
  "max-h-[304px] overflow-y-auto py-[4px] outline-none"
);

export const multiSelectSectionHeaderVariants = cva(
  "border-t border-l-border-faint px-s-2 py-[6px] first:border-t-0 font-sans text-[11px] font-medium text-l-ink-dim"
);

export const multiSelectItemVariants = cva(
  "flex w-full cursor-pointer select-none items-center gap-s-3 px-s-3 py-s-2 text-left outline-none transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-50 data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 data-[focus-visible=true]:outline-ember",
  {
    variants: {
      selected: {
        true: "bg-l-surface-selected",
        false: "hover:bg-l-surface-hover",
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
);

export const multiSelectCheckboxVariants = cva(
  "flex size-[14px] shrink-0 items-center justify-center rounded-xs border text-white",
  {
    variants: {
      selected: {
        true: "border-[var(--l-accent)] bg-[var(--l-accent)]",
        false: "border-l-border-strong bg-transparent",
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
);

export const multiSelectItemIconVariants = cva("shrink-0 text-l-ink-dim");

export const multiSelectItemContentVariants = cva("min-w-0 flex-1");

export const multiSelectItemLabelVariants = cva(
  "block truncate text-[13px]",
  {
    variants: {
      selected: {
        true: "font-medium text-l-ink",
        false: "text-l-ink-lo",
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
);

export const multiSelectItemDescriptionVariants = cva(
  "mt-[2px] block truncate text-[10px] text-l-ink-dim"
);

export const multiSelectFooterVariants = cva(
  "flex items-center justify-between border-t border-hairline-strong px-s-3 py-s-2"
);

export const multiSelectFooterButtonVariants = cva(
  "rounded-md px-[8px] py-[4px] font-sans text-[12px] font-medium text-l-ink-dim transition-colors duration-fast hover:bg-l-wash-3 hover:text-l-ink"
);

export const multiSelectEmptyVariants = cva(
  "flex flex-col items-center gap-s-2 px-s-4 py-s-5 text-center"
);

export const multiSelectEmptyIconVariants = cva(
  "flex size-7 items-center justify-center rounded-pill bg-l-wash-5 text-l-ink-dim"
);

export const multiSelectEmptyTitleVariants = cva(
  "font-sans text-[13px] font-medium text-l-ink"
);

export const multiSelectEmptyDescriptionVariants = cva(
  "font-sans text-[12px] text-l-ink-dim"
);

export const multiSelectHintVariants = cva("font-sans text-[12px]", {
  variants: {
    invalid: {
      true: "text-event-red",
      false: "text-l-ink-dim",
    },
  },
  defaultVariants: {
    invalid: false,
  },
});

export type MultiSelectSelection = Set<string> | "all";

export interface MultiSelectItemType {
  id: string;
  label: React.ReactNode;
  textValue?: string;
  description?: React.ReactNode;
  section?: React.ReactNode;
  icon?: React.ReactNode;
  isDisabled?: boolean;
}

export interface MultiSelectRenderState {
  item: MultiSelectItemType;
  isSelected: boolean;
}

export interface MultiSelectProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "onChange"> {
  items: MultiSelectItemType[];
  children?:
    | React.ReactNode
    | ((state: MultiSelectRenderState) => React.ReactNode);
  selectedKeys?: MultiSelectSelection;
  defaultSelectedKeys?: Iterable<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  isDisabled?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  placeholder?: React.ReactNode;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  hideRequiredIndicator?: boolean;
  popoverClassName?: string;
  onReset?: () => void;
  onSelectAll?: () => void;
  showFooter?: boolean;
  showSearch?: boolean;
  emptyStateTitle?: React.ReactNode;
  emptyStateDescription?: React.ReactNode;
  selectedCountFormatter?: (count: number) => React.ReactNode;
  supportingText?: React.ReactNode;
  searchPlaceholder?: string;
}

function itemText(item: MultiSelectItemType) {
  if (item.textValue) return item.textValue;
  if (typeof item.label === "string") return item.label;
  return item.id;
}

function toSet(
  selection: MultiSelectSelection | Iterable<string> | undefined,
  items: MultiSelectItemType[]
) {
  if (selection === "all") return new Set(items.map((item) => item.id));
  return new Set(selection ?? []);
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      className="h-[10px] w-[10px]"
      aria-hidden
    >
      <polyline
        points="1 9 7 14 15 4"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={multiSelectChevronVariants({ open })}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m19.5 8.25-7.5 7.5-7.5-7.5"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-4 shrink-0 text-l-ink-dim"
      aria-hidden
    >
      <path
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MultiSelect({
  items,
  children,
  selectedKeys,
  defaultSelectedKeys = [],
  onSelectionChange,
  isDisabled = false,
  isRequired = false,
  isInvalid = false,
  placeholder = "Select",
  label,
  hint,
  hideRequiredIndicator = false,
  popoverClassName,
  className,
  onReset,
  onSelectAll,
  showFooter = true,
  showSearch = true,
  emptyStateTitle = "No results found",
  emptyStateDescription = "Please try a different search term.",
  selectedCountFormatter,
  supportingText,
  searchPlaceholder = "Search",
  ...props
}: MultiSelectProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const isControlled = selectedKeys !== undefined;
  const [internalSelected, setInternalSelected] = React.useState<Set<string>>(
    () => toSet(defaultSelectedKeys, items)
  );
  const selected = React.useMemo(
    () => toSet(selectedKeys ?? internalSelected, items),
    [internalSelected, items, selectedKeys]
  );
  const selectedCount = selected.size;
  const hasSelection = selectedCount > 0;

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current || rootRef.current.contains(event.target as Node))
        return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const filteredItems = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      itemText(item).toLowerCase().includes(needle)
    );
  }, [items, query]);

  const sections = React.useMemo(() => {
    const groups = new Map<React.ReactNode, MultiSelectItemType[]>();
    for (const item of filteredItems) {
      const section = item.section ?? "";
      groups.set(section, [...(groups.get(section) ?? []), item]);
    }
    return Array.from(groups.entries());
  }, [filteredItems]);

  const commit = React.useCallback(
    (next: Set<string>) => {
      if (!isControlled) setInternalSelected(new Set(next));
      onSelectionChange?.(new Set(next));
    },
    [isControlled, onSelectionChange]
  );

  const toggleItem = (item: MultiSelectItemType) => {
    if (item.isDisabled) return;
    const next = new Set(selected);
    if (next.has(item.id)) next.delete(item.id);
    else next.add(item.id);
    commit(next);
  };

  const reset = () => {
    commit(new Set());
    onReset?.();
  };

  const selectAll = () => {
    commit(
      new Set(items.filter((item) => !item.isDisabled).map((item) => item.id))
    );
    onSelectAll?.();
  };

  const selectedLabel = selectedCountFormatter
    ? selectedCountFormatter(selectedCount)
    : `${selectedCount} selected`;

  return (
    <div
      ref={rootRef}
      className={cn(multiSelectRootVariants(), className)}
      {...props}
    >
      {label ? (
        <div className="font-sans text-[12px] font-medium text-l-ink-lo">
          {label}
          {isRequired && !hideRequiredIndicator ? (
            <span className="ml-[4px] text-event-red">*</span>
          ) : null}
        </div>
      ) : null}

      <div className="relative">
        <button
          type="button"
          disabled={isDisabled}
          aria-expanded={open}
          aria-invalid={isInvalid || undefined}
          className={multiSelectTriggerVariants({ invalid: isInvalid })}
          onClick={() => setOpen((next) => !next)}
        >
          <span className={multiSelectTriggerContentVariants()}>
            {hasSelection ? (
              <>
                <span className={multiSelectValueVariants({ state: "selected" })}>
                  {selectedLabel}
                </span>
                {supportingText ? (
                  <span className={multiSelectSupportingTextVariants()}>
                    {supportingText}
                  </span>
                ) : null}
              </>
            ) : (
              <span
                className={multiSelectValueVariants({ state: "placeholder" })}
              >
                {placeholder}
              </span>
            )}
          </span>
          <ChevronIcon open={open} />
        </button>

        {open ? (
          <div className={cn(multiSelectPopoverVariants(), popoverClassName)}>
            {showSearch ? (
              <div className={multiSelectSearchWrapVariants()}>
                <label className={multiSelectSearchRootVariants()}>
                  <SearchIcon />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.currentTarget.value)}
                    placeholder={searchPlaceholder}
                    className={multiSelectSearchInputVariants()}
                    autoFocus
                  />
                </label>
              </div>
            ) : null}

            <div
              className={multiSelectListVariants()}
              role="listbox"
              aria-multiselectable
            >
              {sections.length === 0 ? (
                <div className={multiSelectEmptyVariants()}>
                  <span className={multiSelectEmptyIconVariants()}>
                    <SearchIcon />
                  </span>
                  <div>
                    <p className={multiSelectEmptyTitleVariants()}>
                      {emptyStateTitle}
                    </p>
                    <p className={multiSelectEmptyDescriptionVariants()}>
                      {emptyStateDescription}
                    </p>
                  </div>
                  {query ? (
                    <button
                      type="button"
                      className={multiSelectFooterButtonVariants()}
                      onClick={() => setQuery("")}
                    >
                      Clear search
                    </button>
                  ) : null}
                </div>
              ) : (
                sections.map(([section, sectionItems]) => (
                  <div key={String(section || "default")}>
                    {section ? (
                      <div className={multiSelectSectionHeaderVariants()}>
                        {section}
                      </div>
                    ) : null}
                    {sectionItems.map((item) => {
                      const isSelected = selected.has(item.id);
                      const rendered =
                        typeof children === "function"
                          ? children({ item, isSelected })
                          : children;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          disabled={item.isDisabled}
                          className={multiSelectItemVariants({
                            selected: isSelected,
                          })}
                          onClick={() => toggleItem(item)}
                        >
                          <span
                            className={multiSelectCheckboxVariants({
                              selected: isSelected,
                            })}
                          >
                            {isSelected ? <CheckIcon /> : null}
                          </span>
                          {item.icon ? (
                            <span className={multiSelectItemIconVariants()}>
                              {item.icon}
                            </span>
                          ) : null}
                          {rendered ?? (
                            <span className={multiSelectItemContentVariants()}>
                              <span
                                className={multiSelectItemLabelVariants({
                                  selected: isSelected,
                                })}
                              >
                                {item.label}
                              </span>
                              {item.description ? (
                                <span
                                  className={multiSelectItemDescriptionVariants()}
                                >
                                  {item.description}
                                </span>
                              ) : null}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {showFooter ? (
              <div className={multiSelectFooterVariants()}>
                <button
                  type="button"
                  className={multiSelectFooterButtonVariants()}
                  onClick={reset}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className={multiSelectFooterButtonVariants()}
                  onClick={selectAll}
                >
                  Select all
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {hint ? (
        <div className={multiSelectHintVariants({ invalid: isInvalid })}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}
