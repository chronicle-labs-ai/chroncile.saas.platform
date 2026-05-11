"use client";

import * as React from "react";
import { cva } from "class-variance-authority";

export const tagListButtonVariants = cva(
  "inline-flex items-center border transition-[background-color,border-color,color] duration-fast ease-out outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember h-[26px] gap-[4px] rounded-md border-hairline-strong bg-l-wash-5 px-[8px] py-[4.5px] font-sans text-[12px] text-l-ink shadow-[0_1px_0.5px_rgba(0,0,0,0.15)] hover:border-l-border-strong hover:bg-l-surface-hover"
);

export const tagListDotStackVariants = cva("relative inline-block shrink-0", {
  variants: {
    count: {
      0: "hidden",
      1: "h-[9px] w-[9px]",
      2: "h-[9px] w-[13px]",
      3: "h-[9px] w-[17px]",
    },
  },
  defaultVariants: {
    count: 1,
  },
});

export const tagListDotVariants = cva(
  "absolute left-0 top-0 size-[9px] rounded-pill border border-[var(--l-dot-edge)]"
);

export const tagListDropdownVariants = cva(
  "flex flex-col items-center rounded-[8px] border border-[var(--l-pop-border)] bg-[var(--l-pop-bg)] shadow-l-pop w-[204px]"
);

export const tagListDropdownSearchVariants = cva(
  "flex h-[36px] w-full items-center border-b border-l-border-faint pr-[12px]"
);

export const tagListDropdownSearchLabelVariants = cva(
  "flex h-full min-w-0 flex-1 items-start px-[14px] py-[10px] font-sans text-[12px] text-l-ink-dim"
);

export const tagListShortcutVariants = cva(
  "flex w-[16px] shrink-0 items-center justify-center rounded-[3px] bg-l-wash-5 p-[2px] font-sans text-[11px] leading-[1.1] text-l-ink-lo"
);

export const tagListOptionsVariants = cva(
  "flex w-full flex-col items-start p-[4px]"
);

export const tagListOptionVariants = cva(
  "flex h-[32px] w-full items-center gap-[4px] rounded-[4px] px-[8px] py-[4.5px] text-left shadow-[0_1px_0.5px_rgba(0,0,0,0.15)] outline-none transition-colors duration-fast focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
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

export const tagListCheckboxVariants = cva(
  "flex size-[16px] shrink-0 items-center justify-center rounded-[4px] border border-l-border-strong text-[var(--l-accent)]",
  {
    variants: {
      selected: {
        true: "border-[var(--l-accent)] bg-[var(--l-accent-muted)]",
        false: "",
      },
      pending: {
        true: "cursor-wait opacity-80",
        false: "",
      },
    },
    defaultVariants: {
      pending: false,
      selected: false,
    },
  }
);

export const tagListPendingIndicatorVariants = cva(
  "size-[10px] animate-spin rounded-full border-2 border-current border-t-transparent"
);

export const tagListOptionContentVariants = cva(
  "flex shrink-0 items-center gap-[12px]"
);

export const tagListOptionDotWrapVariants = cva(
  "relative h-[9px] w-[16px] shrink-0"
);

export const tagListOptionLabelVariants = cva(
  "font-sans text-[12px] text-l-ink"
);

export type TagListColor =
  | "bug"
  | "feature"
  | "improvement"
  | "neutral"
  | "teal"
  | "amber"
  | "green"
  | "orange"
  | "pink"
  | "violet"
  | "ember"
  | "red";

export interface TagListItem {
  id: string;
  label: React.ReactNode;
  color?: TagListColor;
}

export type TagListSelectionResult = Iterable<string> | void;
export type TagListSelectionChange = (
  ids: Set<string>,
  meta: {
    item: TagListItem;
    selected: boolean;
    previousIds: Set<string>;
    requestId: number;
  }
) => TagListSelectionResult | Promise<TagListSelectionResult>;

export interface TagListSummaryRenderState {
  selectedItems: TagListItem[];
  selectedIds: Set<string>;
  totalItems: number;
  defaultLabel: React.ReactNode;
  emptyLabel: React.ReactNode;
  pendingIds: Set<string>;
}

const colorClass: Record<TagListColor, string> = {
  bug: "bg-[#eb5757]",
  feature: "bg-[#bb87fc]",
  improvement: "bg-[#4ea7fc]",
  neutral: "bg-l-ink-dim",
  teal: "bg-event-teal",
  amber: "bg-event-amber",
  green: "bg-event-green",
  orange: "bg-event-orange",
  pink: "bg-event-pink",
  violet: "bg-event-violet",
  ember: "bg-ember",
  red: "bg-event-red",
};

function getColor(item: TagListItem): TagListColor {
  return item.color ?? "neutral";
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" aria-hidden>
      <path
        d="M3.5 8.25 6.5 11 12.5 4.75"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function toSelectionSet(value: Iterable<string> | undefined): Set<string> {
  return new Set(value ?? []);
}

export interface TagListProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  items: TagListItem[];
  maxDots?: 1 | 2 | 3;
  emptyLabel?: React.ReactNode;
  label?: React.ReactNode;
  renderLabel?: (state: TagListSummaryRenderState) => React.ReactNode;
  dropdown?: boolean;
  selectedIds?: Iterable<string>;
  defaultSelectedIds?: Iterable<string>;
  onSelectionChange?: TagListSelectionChange;
  /**
   * `sync` updates immediately, then calls `onSelectionChange`.
   * `async` waits for a returned promise before committing local state.
   */
  selectionMode?: "sync" | "async";
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placeholder?: React.ReactNode;
  shortcut?: React.ReactNode;
  dropdownClassName?: string;
  ref?: React.Ref<HTMLButtonElement>;
}

export function TagList({
  items,
  maxDots = 3,
  emptyLabel = "No labels",
  label,
  renderLabel,
  dropdown = false,
  selectedIds,
  defaultSelectedIds,
  onSelectionChange,
  selectionMode = "sync",
  open,
  defaultOpen = false,
  onOpenChange,
  placeholder = "Change labels...",
  shortcut = "L",
  dropdownClassName,
  className,
  onClick,
  ref,
  type,
  ...props
}: TagListProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const [internalSelected, setInternalSelected] = React.useState<Set<string>>(
    () =>
      new Set(defaultSelectedIds ?? selectedIds ?? items.map((item) => item.id))
  );
  const baseSelected = React.useMemo(
    () => toSelectionSet(selectedIds ?? internalSelected),
    [internalSelected, selectedIds]
  );
  const [optimisticSelected, setOptimisticSelected] = React.useState<
    Set<string>
  >(() => new Set(baseSelected));
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(
    () => new Set()
  );
  const selectedRef = React.useRef(new Set(baseSelected));
  const pendingIdsRef = React.useRef(new Set<string>());
  const latestRequestRef = React.useRef(0);
  const isOpen = open ?? internalOpen;
  const selected =
    selectionMode === "async" ? optimisticSelected : baseSelected;
  selectedRef.current = selected;
  pendingIdsRef.current = pendingIds;

  React.useEffect(() => {
    if (
      selectionMode !== "async" ||
      pendingIdsRef.current.size > 0 ||
      latestRequestRef.current > 0
    ) {
      return;
    }
    setOptimisticSelected(new Set(baseSelected));
  }, [baseSelected, selectionMode]);

  const selectedItems = items.filter((item) => selected.has(item.id));
  const visibleDots = selectedItems.slice(0, maxDots);
  const count = Math.min(visibleDots.length, 3) as 0 | 1 | 2 | 3;
  const defaultLabel =
    selectedItems.length > 0 ? `${selectedItems.length} labels` : emptyLabel;
  const resolvedLabel =
    renderLabel?.({
      selectedItems,
      selectedIds: selected,
      totalItems: items.length,
      defaultLabel,
      emptyLabel,
      pendingIds,
    }) ??
    label ??
    defaultLabel;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (open === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange, open]
  );

  React.useEffect(() => {
    if (!dropdown || !isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || root.contains(event.target as Node)) return;
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdown, isOpen, setOpen]);

  const toggle = React.useCallback(
    async (item: TagListItem) => {
      const id = item.id;
      if (pendingIdsRef.current.has(id)) return;

      const previousIds = new Set(selectedRef.current);
      const next = new Set(previousIds);
      const nextSelected = !next.has(id);
      if (nextSelected) next.add(id);
      else next.delete(id);
      const requestId = latestRequestRef.current + 1;
      latestRequestRef.current = requestId;

      if (selectionMode === "sync") {
        if (selectedIds === undefined) setInternalSelected(next);
        await onSelectionChange?.(next, {
          item,
          selected: nextSelected,
          previousIds,
          requestId,
        });
        return;
      }

      selectedRef.current = next;
      setOptimisticSelected(next);
      setPendingIds((current) => new Set(current).add(id));
      try {
        const result = await onSelectionChange?.(next, {
          item,
          selected: nextSelected,
          previousIds,
          requestId,
        });
        if (requestId === latestRequestRef.current) {
          const committed = result ? toSelectionSet(result) : next;
          selectedRef.current = committed;
          setOptimisticSelected(committed);
          if (selectedIds === undefined) setInternalSelected(committed);
        }
      } catch (error) {
        if (requestId === latestRequestRef.current) {
          selectedRef.current = previousIds;
          setOptimisticSelected(previousIds);
        }
        void error;
      } finally {
        setPendingIds((current) => {
          const updated = new Set(current);
          updated.delete(id);
          return updated;
        });
      }
    },
    [onSelectionChange, selectedIds, selectionMode]
  );

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        {...props}
        ref={ref}
        type={type ?? "button"}
        className={tagListButtonVariants({ className })}
        aria-expanded={dropdown ? isOpen : undefined}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented && dropdown) setOpen(!isOpen);
        }}
      >
        <span
          className={tagListDotStackVariants({ count })}
          aria-hidden
        >
          {visibleDots.map((item, index) => (
            <span
              key={item.id}
              className={tagListDotVariants({
                className: colorClass[getColor(item)],
              })}
              style={{ left: index * 4 }}
            />
          ))}
        </span>
        <span>{resolvedLabel}</span>
      </button>

      {dropdown && isOpen ? (
        <div
          className={tagListDropdownVariants({
            className: `absolute left-0 top-full z-50 mt-[6px] ${dropdownClassName ?? ""}`,
          })}
        >
          <div className={tagListDropdownSearchVariants()}>
            <div className={tagListDropdownSearchLabelVariants()}>
              <span>{placeholder}</span>
            </div>
            {shortcut ? (
              <span className={tagListShortcutVariants()}>{shortcut}</span>
            ) : null}
          </div>
          <div
            className={tagListOptionsVariants()}
            role="listbox"
            aria-multiselectable
          >
            {items.map((item) => {
              const isSelected = selected.has(item.id);
              const isPending = pendingIds.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  className={tagListOptionVariants({ selected: isSelected })}
                  aria-selected={isSelected}
                  disabled={isPending}
                  onClick={() => void toggle(item)}
                >
                  <span
                    className={tagListCheckboxVariants({
                      selected: isSelected,
                      pending: isPending,
                    })}
                  >
                    {isPending ? (
                      <span className={tagListPendingIndicatorVariants()} />
                    ) : isSelected ? (
                      <CheckIcon />
                    ) : null}
                  </span>
                  <span className={tagListOptionContentVariants()}>
                    <span className={tagListOptionDotWrapVariants()}>
                      <span
                        aria-hidden
                        className={tagListDotVariants({
                          className: colorClass[getColor(item)],
                        })}
                      />
                    </span>
                    <span className={tagListOptionLabelVariants()}>
                      {item.label}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
