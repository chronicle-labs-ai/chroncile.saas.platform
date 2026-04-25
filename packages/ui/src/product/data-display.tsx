"use client";

import * as React from "react";
import type { Key } from "react";

import { tv, type VariantProps } from "../utils/tv";
import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { ProgressBar } from "../primitives/progress-bar";

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type SpanProps = React.HTMLAttributes<HTMLSpanElement>;
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

const statusTone = {
  success: "text-event-green",
  warning: "text-event-amber",
  danger: "text-event-red",
  neutral: "text-l-ink-dim",
} as const;

export type DataDisplayStatus = keyof typeof statusTone;

function clampPercent(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function Chevron({ direction = "right" }: { direction?: "left" | "right" }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" className="h-4 w-4">
      <path
        d={
          direction === "left"
            ? "M10 3.5 5.5 8l4.5 4.5"
            : "M6 3.5 10.5 8 6 12.5"
        }
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const actionBarStyles = tv({
  slots: {
    root:
      "fixed inset-x-0 bottom-s-6 z-50 flex justify-center px-s-4 pointer-events-none " +
      "transition-[opacity,transform] duration-fast ease-out",
    wrapper:
      "pointer-events-auto inline-flex items-center gap-s-2 rounded-pill border border-l-border-strong " +
      "bg-l-surface-raised px-s-2 py-[6px] text-l-ink shadow-l-pop",
    section: "flex items-center gap-s-2",
    label: "max-sm:sr-only",
  },
  variants: {
    isOpen: {
      true: "translate-y-0 opacity-100",
      false: "translate-y-3 opacity-0",
    },
    isAttached: {
      true: "",
      false:
        "[&>div]:border-transparent [&>div]:bg-transparent [&>div]:shadow-none",
    },
    orientation: {
      horizontal: "",
      vertical: "[&>div]:flex-col [&>div]:rounded-md",
    },
  },
  defaultVariants: {
    isOpen: false,
    isAttached: true,
    orientation: "horizontal",
  },
});

export interface ActionBarProps
  extends Omit<DivProps, "className">, VariantProps<typeof actionBarStyles> {
  isOpen: boolean;
  isAttached?: boolean;
  orientation?: "horizontal" | "vertical";
  className?: string;
  wrapperClassName?: string;
  "aria-label"?: string;
}

function ActionBarRoot({
  isOpen,
  isAttached = true,
  orientation = "horizontal",
  className,
  wrapperClassName,
  children,
  "aria-label": ariaLabel = "Actions",
  ...props
}: ActionBarProps) {
  const slots = actionBarStyles({ isOpen, isAttached, orientation });
  return (
    <div {...props} className={slots.root({ className })}>
      <div
        role="toolbar"
        aria-label={ariaLabel}
        aria-hidden={!isOpen}
        className={slots.wrapper({ className: wrapperClassName })}
      >
        {children}
      </div>
    </div>
  );
}

function ActionBarSection({ className, ...props }: DivProps) {
  const slots = actionBarStyles({});
  return <div {...props} className={slots.section({ className })} />;
}

export const ActionBar = Object.assign(ActionBarRoot, {
  Prefix: ActionBarSection,
  Content: ActionBarSection,
  Suffix: ActionBarSection,
  Label: ({ className, ...props }: SpanProps) => {
    const slots = actionBarStyles({});
    return <span {...props} className={slots.label({ className })} />;
  },
});

const carouselStyles = tv({
  slots: {
    root: "carousel w-full [--carousel-gap:var(--s-4)]",
    viewportWrapper: "relative",
    viewport: "overflow-hidden rounded-md",
    content:
      "flex touch-pan-y snap-x snap-mandatory gap-[var(--carousel-gap)] overflow-x-auto scroll-smooth " +
      "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
    item: "min-w-0 shrink-0 basis-full snap-start",
    nav:
      "absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-pill " +
      "border border-l-border bg-l-surface-raised text-l-ink-lo shadow-l-pop transition " +
      "hover:text-l-ink disabled:pointer-events-none disabled:opacity-35",
    previous: "left-s-2",
    next: "right-s-2",
    dots: "mt-s-3 flex justify-center gap-s-2",
    dot: "h-2 w-2 rounded-pill bg-l-border transition-[width,background-color] data-[selected=true]:w-5 data-[selected=true]:bg-ember",
    thumbnails: "mt-s-3 flex items-center justify-center gap-s-2",
    thumbnail:
      "h-14 w-14 overflow-hidden rounded-md border border-l-border bg-l-surface-raised opacity-75 transition " +
      "hover:opacity-100 data-[selected=true]:border-ember data-[selected=true]:opacity-100 data-[selected=true]:shadow-[0_0_0_2px_rgba(216,67,10,0.22)]",
  },
  variants: {
    type: {
      "in-place": "",
      modal: "",
      miniatures: "",
    },
  },
});

interface CarouselContextValue {
  selectedIndex: number;
  scrollSnapCount: number;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  scrollPrev: () => void;
  scrollNext: () => void;
  scrollTo: (index: number) => void;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  registerItem: (node: HTMLDivElement | null) => void;
}

const CarouselContext = React.createContext<CarouselContextValue | null>(null);

export function useCarousel() {
  const context = React.useContext(CarouselContext);
  if (!context) throw new Error("useCarousel must be used within Carousel");
  return context;
}

export interface CarouselProps extends DivProps {
  type?: "in-place" | "modal" | "miniatures";
  defaultIndex?: number;
  selectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;
  setApi?: (
    api: Pick<CarouselContextValue, "scrollPrev" | "scrollNext" | "scrollTo">
  ) => void;
}

function CarouselRoot({
  type = "in-place",
  defaultIndex = 0,
  selectedIndex,
  onSelectedIndexChange,
  setApi,
  className,
  children,
  ...props
}: CarouselProps) {
  const slots = carouselStyles({ type });
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const itemRefs = React.useRef<HTMLDivElement[]>([]);
  const [internalIndex, setInternalIndex] = React.useState(defaultIndex);
  const [count, setCount] = React.useState(0);
  const activeIndex = selectedIndex ?? internalIndex;

  const updateIndex = React.useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(index, Math.max(0, count - 1)));
      setInternalIndex(next);
      onSelectedIndexChange?.(next);
      itemRefs.current[next]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "start",
      });
    },
    [count, onSelectedIndexChange]
  );

  const registerItem = React.useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    itemRefs.current = [
      ...itemRefs.current.filter((item) => item !== node),
      node,
    ];
    setCount(itemRefs.current.length);
  }, []);

  const context = React.useMemo<CarouselContextValue>(
    () => ({
      selectedIndex: activeIndex,
      scrollSnapCount: count,
      canScrollPrev: activeIndex > 0,
      canScrollNext: activeIndex < count - 1,
      scrollPrev: () => updateIndex(activeIndex - 1),
      scrollNext: () => updateIndex(activeIndex + 1),
      scrollTo: updateIndex,
      viewportRef,
      registerItem,
    }),
    [activeIndex, count, registerItem, updateIndex]
  );

  React.useEffect(() => {
    setApi?.({
      scrollPrev: context.scrollPrev,
      scrollNext: context.scrollNext,
      scrollTo: context.scrollTo,
    });
  }, [context, setApi]);

  return (
    <CarouselContext.Provider value={context}>
      <div {...props} data-type={type} className={slots.root({ className })}>
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

function CarouselContent({ className, children, ...props }: DivProps) {
  const slots = carouselStyles({});
  const { viewportRef } = useCarousel();
  return (
    <div className={slots.viewportWrapper()}>
      <div ref={viewportRef} className={slots.viewport()}>
        <div {...props} className={slots.content({ className })}>
          {children}
        </div>
      </div>
    </div>
  );
}

function CarouselItem({ className, ...props }: DivProps) {
  const slots = carouselStyles({});
  const { registerItem } = useCarousel();
  return (
    <div {...props} ref={registerItem} className={slots.item({ className })} />
  );
}

function CarouselPrevious({ className, children, ...props }: ButtonProps) {
  const slots = carouselStyles({});
  const { canScrollPrev, scrollPrev } = useCarousel();
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      disabled={!canScrollPrev || props.disabled}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) scrollPrev();
      }}
      className={cx(slots.nav(), slots.previous(), className)}
    >
      {children ?? <Chevron direction="left" />}
    </button>
  );
}

function CarouselNext({ className, children, ...props }: ButtonProps) {
  const slots = carouselStyles({});
  const { canScrollNext, scrollNext } = useCarousel();
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      disabled={!canScrollNext || props.disabled}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) scrollNext();
      }}
      className={cx(slots.nav(), slots.next(), className)}
    >
      {children ?? <Chevron />}
    </button>
  );
}

function CarouselDots({ className, ...props }: DivProps) {
  const slots = carouselStyles({});
  const { selectedIndex, scrollSnapCount, scrollTo } = useCarousel();
  if (scrollSnapCount <= 1) return null;
  return (
    <div {...props} className={slots.dots({ className })}>
      {Array.from({ length: scrollSnapCount }, (_, index) => (
        <button
          key={index}
          type="button"
          aria-label={`Go to slide ${index + 1}`}
          data-selected={selectedIndex === index}
          className={slots.dot()}
          onClick={() => scrollTo(index)}
        />
      ))}
    </div>
  );
}

function CarouselThumbnails({ className, ...props }: DivProps) {
  const slots = carouselStyles({});
  return (
    <div
      {...props}
      role="tablist"
      className={slots.thumbnails({ className })}
    />
  );
}

export interface CarouselThumbnailProps extends ButtonProps {
  index: number;
  src?: string;
  alt?: string;
}

function CarouselThumbnail({
  index,
  src,
  alt = "",
  className,
  children,
  ...props
}: CarouselThumbnailProps) {
  const slots = carouselStyles({});
  const { selectedIndex, scrollTo } = useCarousel();
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      role="tab"
      aria-selected={selectedIndex === index}
      data-selected={selectedIndex === index}
      className={slots.thumbnail({ className })}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) scrollTo(index);
      }}
    >
      {children ??
        (src ? (
          <span
            role="img"
            aria-label={alt || undefined}
            className="block h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${src})` }}
          />
        ) : null)}
    </button>
  );
}

export const Carousel = Object.assign(CarouselRoot, {
  Content: CarouselContent,
  Item: CarouselItem,
  Previous: CarouselPrevious,
  Next: CarouselNext,
  Dots: CarouselDots,
  Thumbnails: CarouselThumbnails,
  Thumbnail: CarouselThumbnail,
});

export type DataGridSortDirection = "ascending" | "descending";
export interface DataGridSortDescriptor {
  column: Key;
  direction: DataGridSortDirection;
}

export interface DataGridColumn<T> {
  id: Key;
  header:
    | React.ReactNode
    | ((props: { sortDirection?: DataGridSortDirection }) => React.ReactNode);
  accessorKey?: keyof T;
  cell?: (item: T, column: DataGridColumn<T>) => React.ReactNode;
  align?: "start" | "center" | "end";
  isRowHeader?: boolean;
  allowsSorting?: boolean;
  sortFn?: (a: T, b: T) => number;
  width?: number | string;
  minWidth?: number;
  pinned?: "start" | "end";
}

export interface DataGridProps<T> extends Omit<
  DivProps,
  "children" | "onChange"
> {
  "aria-label": string;
  data: T[];
  columns: DataGridColumn<T>[];
  getRowId: (item: T) => Key;
  selectionMode?: "none" | "single" | "multiple";
  selectedKeys?: Set<Key>;
  defaultSelectedKeys?: Iterable<Key>;
  onSelectionChange?: (keys: Set<Key>) => void;
  showSelectionCheckboxes?: boolean;
  sortDescriptor?: DataGridSortDescriptor;
  defaultSortDescriptor?: DataGridSortDescriptor;
  onSortChange?: (descriptor: DataGridSortDescriptor) => void;
  renderEmptyState?: () => React.ReactNode;
}

const dataGridStyles = tv({
  slots: {
    root: "w-full overflow-hidden rounded-md border border-l-border bg-l-surface",
    scroller: "w-full overflow-auto",
    table: "w-full min-w-full border-separate border-spacing-0 text-left",
    headerCell:
      "sticky top-0 z-10 border-b border-l-border bg-l-surface-bar px-[12px] py-[9px] " +
      "font-sans text-[12px] font-medium text-l-ink-dim",
    headerButton:
      "inline-flex items-center gap-[6px] text-left outline-none hover:text-l-ink",
    cell: "border-b border-l-border-faint px-[12px] py-[10px] font-sans text-[13px] text-l-ink",
    row: "transition-colors hover:bg-l-surface-hover data-[selected=true]:bg-l-surface-selected",
    empty: "px-s-4 py-s-10 text-center text-sm text-l-ink-dim",
  },
});

export function DataGrid<T>({
  data,
  columns,
  getRowId,
  selectionMode = "none",
  selectedKeys,
  defaultSelectedKeys,
  onSelectionChange,
  showSelectionCheckboxes = selectionMode !== "none",
  sortDescriptor,
  defaultSortDescriptor,
  onSortChange,
  renderEmptyState,
  className,
  "aria-label": ariaLabel,
  ...props
}: DataGridProps<T>) {
  const slots = dataGridStyles({});
  const [internalSelected, setInternalSelected] = React.useState<Set<Key>>(
    () => new Set(defaultSelectedKeys)
  );
  const [internalSort, setInternalSort] = React.useState<
    DataGridSortDescriptor | undefined
  >(defaultSortDescriptor);
  const selected = selectedKeys ?? internalSelected;
  const sort = sortDescriptor ?? internalSort;

  const sortedData = React.useMemo(() => {
    if (!sort) return data;
    const column = columns.find((item) => item.id === sort.column);
    if (!column) return data;
    const direction = sort.direction === "ascending" ? 1 : -1;
    return [...data].sort((a, b) => {
      if (column.sortFn) return column.sortFn(a, b) * direction;
      const aValue = column.accessorKey ? a[column.accessorKey] : "";
      const bValue = column.accessorKey ? b[column.accessorKey] : "";
      return (
        String(aValue ?? "").localeCompare(String(bValue ?? ""), undefined, {
          numeric: true,
          sensitivity: "base",
        }) * direction
      );
    });
  }, [columns, data, sort]);

  const setSelected = React.useCallback(
    (keys: Set<Key>) => {
      if (!selectedKeys) setInternalSelected(keys);
      onSelectionChange?.(keys);
    },
    [onSelectionChange, selectedKeys]
  );

  const toggleRow = (key: Key) => {
    if (selectionMode === "none") return;
    if (selectionMode === "single") {
      setSelected(selected.has(key) ? new Set() : new Set([key]));
      return;
    }
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const setSort = (column: DataGridColumn<T>) => {
    if (!column.allowsSorting) return;
    const next: DataGridSortDescriptor = {
      column: column.id,
      direction:
        sort?.column === column.id && sort.direction === "ascending"
          ? "descending"
          : "ascending",
    };
    if (!sortDescriptor) setInternalSort(next);
    onSortChange?.(next);
  };

  return (
    <div {...props} className={slots.root({ className })}>
      <div className={slots.scroller()}>
        <table aria-label={ariaLabel} className={slots.table()}>
          <thead>
            <tr>
              {showSelectionCheckboxes ? (
                <th className={slots.headerCell()} style={{ width: 36 }}>
                  <span className="sr-only">Selection</span>
                </th>
              ) : null}
              {columns.map((column) => {
                const sortDirection =
                  sort?.column === column.id ? sort.direction : undefined;
                const header =
                  typeof column.header === "function"
                    ? column.header({ sortDirection })
                    : column.header;
                return (
                  <th
                    key={String(column.id)}
                    className={slots.headerCell()}
                    style={{ width: column.width, minWidth: column.minWidth }}
                    aria-sort={
                      sortDirection === "ascending"
                        ? "ascending"
                        : sortDirection === "descending"
                          ? "descending"
                          : undefined
                    }
                  >
                    <button
                      type="button"
                      disabled={!column.allowsSorting}
                      className={slots.headerButton()}
                      onClick={() => setSort(column)}
                    >
                      {header}
                      {column.allowsSorting ? (
                        <span aria-hidden>
                          {sortDirection === "descending" ? "↓" : "↑"}
                        </span>
                      ) : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (showSelectionCheckboxes ? 1 : 0)}
                  className={slots.empty()}
                >
                  {renderEmptyState?.() ?? "No rows to display."}
                </td>
              </tr>
            ) : (
              sortedData.map((item) => {
                const key = getRowId(item);
                const isSelected = selected.has(key);
                return (
                  <tr
                    key={String(key)}
                    data-selected={isSelected}
                    className={slots.row()}
                  >
                    {showSelectionCheckboxes ? (
                      <td className={slots.cell()}>
                        <input
                          type={
                            selectionMode === "single" ? "radio" : "checkbox"
                          }
                          checked={isSelected}
                          onChange={() => toggleRow(key)}
                          aria-label={`Select row ${String(key)}`}
                          className="accent-ember"
                        />
                      </td>
                    ) : null}
                    {columns.map((column) => {
                      const value = column.cell
                        ? column.cell(item, column)
                        : column.accessorKey
                          ? String(item[column.accessorKey] ?? "")
                          : null;
                      return (
                        <td
                          key={String(column.id)}
                          className={cx(
                            slots.cell(),
                            column.align === "end" && "text-right",
                            column.align === "center" && "text-center"
                          )}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export interface FileTreeNode {
  id: Key;
  title: React.ReactNode;
  icon?: React.ReactNode;
  children?: FileTreeNode[];
}

export interface FileTreeProps extends Omit<DivProps, "children"> {
  items: FileTreeNode[];
  size?: "sm" | "md" | "lg";
  defaultExpandedKeys?: Iterable<Key>;
  showGuideLines?: boolean | "hover";
  renderItem?: (
    item: FileTreeNode,
    props: { level: number; isExpanded: boolean }
  ) => React.ReactNode;
}

const fileTreeStyles = tv({
  slots: {
    root: "file-tree flex flex-col gap-[2px] rounded-md border border-l-border bg-l-surface p-[6px] outline-none",
    item:
      "group flex w-full items-center gap-[6px] rounded-l px-[8px] py-[6px] text-left font-sans text-l-ink outline-none " +
      "transition-colors hover:bg-l-surface-hover focus-visible:ring-1 focus-visible:ring-ember",
    chevron:
      "flex h-4 w-4 items-center justify-center text-l-ink-dim transition-transform",
    icon: "flex h-4 w-4 items-center justify-center text-l-ink-dim",
    label: "min-w-0 flex-1 truncate",
    children: "relative ml-s-4 border-l border-l-border-faint pl-s-2",
  },
  variants: {
    size: {
      sm: { item: "text-[12px]", root: "[--file-tree-indent:12px]" },
      md: { item: "text-[13px]", root: "[--file-tree-indent:16px]" },
      lg: { item: "text-[14px] py-[8px]", root: "[--file-tree-indent:20px]" },
    },
  },
  defaultVariants: { size: "md" },
});

export function useFileTree<T extends { id: Key; children?: T[] }>({
  items,
  isLeaf = (node) => !node.children || node.children.length === 0,
}: {
  items: T[];
  isLeaf?: (node: T) => boolean;
}) {
  const walk = React.useCallback((nodes: T[], visit: (node: T) => void) => {
    for (const node of nodes) {
      visit(node);
      if (node.children) walk(node.children, visit);
    }
  }, []);

  const expandableKeys = React.useMemo(() => {
    const keys: Key[] = [];
    walk(items, (node) => {
      if (!isLeaf(node)) keys.push(node.id);
    });
    return keys;
  }, [isLeaf, items, walk]);

  const leaves = React.useMemo(() => {
    const result: T[] = [];
    walk(items, (node) => {
      if (isLeaf(node)) result.push(node);
    });
    return result;
  }, [isLeaf, items, walk]);

  const filterTree = React.useCallback(
    (predicate: (node: T) => boolean): T[] => {
      const filterNodes = (nodes: T[]): T[] =>
        nodes
          .map((node) => {
            const children = node.children ? filterNodes(node.children) : [];
            if (predicate(node) || children.length > 0) {
              return { ...node, children } as T;
            }
            return null;
          })
          .filter(Boolean) as T[];
      return filterNodes(items);
    },
    [items]
  );

  return { expandableKeys, filterTree, leaves };
}

export function FileTree({
  items,
  size = "md",
  defaultExpandedKeys,
  showGuideLines = true,
  renderItem,
  className,
  ...props
}: FileTreeProps) {
  const slots = fileTreeStyles({ size });
  const [expanded, setExpanded] = React.useState<Set<Key>>(
    () => new Set(defaultExpandedKeys)
  );

  const renderNode = (item: FileTreeNode, level: number) => {
    const hasChildren = Boolean(item.children?.length);
    const isExpanded = expanded.has(item.id);
    return (
      <div key={String(item.id)}>
        <button
          type="button"
          aria-expanded={hasChildren ? isExpanded : undefined}
          className={slots.item()}
          style={{
            paddingLeft: `calc(8px + ${level} * var(--file-tree-indent))`,
          }}
          onClick={() => {
            if (!hasChildren) return;
            setExpanded((current) => {
              const next = new Set(current);
              if (next.has(item.id)) next.delete(item.id);
              else next.add(item.id);
              return next;
            });
          }}
        >
          <span
            aria-hidden
            className={slots.chevron({
              className: hasChildren && isExpanded ? "rotate-90" : "",
            })}
          >
            {hasChildren ? <Chevron /> : null}
          </span>
          {item.icon ? <span className={slots.icon()}>{item.icon}</span> : null}
          <span className={slots.label()}>
            {renderItem?.(item, { level, isExpanded }) ?? item.title}
          </span>
        </button>
        {hasChildren && isExpanded ? (
          <div
            className={cx(
              showGuideLines ? slots.children() : "ml-s-4 pl-s-2",
              showGuideLines === "hover" &&
                "border-transparent group-hover:border-l-border-faint"
            )}
          >
            {item.children?.map((child) => renderNode(child, level + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div {...props} role="tree" className={slots.root({ className })}>
      {items.length ? (
        items.map((item) => renderNode(item, 0))
      ) : (
        <div className="px-s-3 py-s-6 text-center text-sm italic text-l-ink-dim">
          No files.
        </div>
      )}
    </div>
  );
}

export interface FloatingTocItem {
  id: string;
  label: React.ReactNode;
  level?: number;
}

export interface FloatingTocProps extends DivProps {
  items: FloatingTocItem[];
  activeId?: string;
  placement?: "left" | "right";
  triggerMode?: "hover" | "press";
  onItemPress?: (item: FloatingTocItem) => void;
}

const floatingTocStyles = tv({
  slots: {
    root: "relative inline-flex",
    trigger:
      "floating-toc__trigger flex flex-col gap-[8px] rounded-md p-s-2 outline-none focus-visible:ring-1 focus-visible:ring-ember",
    bar: "h-[2px] rounded-pill bg-l-border transition-[width,background-color] data-[active=true]:bg-ember",
    content:
      "absolute top-0 z-20 min-w-[220px] rounded-md border border-l-border bg-l-surface-raised p-s-2 shadow-l-pop",
    item:
      "block w-full rounded-l px-s-2 py-[6px] text-left font-sans text-[13px] text-l-ink-lo hover:bg-l-surface-hover " +
      "data-[active=true]:text-l-ink data-[active=true]:font-medium",
  },
});

export function FloatingToc({
  items,
  activeId,
  placement = "right",
  triggerMode = "hover",
  onItemPress,
  className,
  ...props
}: FloatingTocProps) {
  const slots = floatingTocStyles({});
  const [open, setOpen] = React.useState(false);
  const openHandlers =
    triggerMode === "hover"
      ? {
          onMouseEnter: () => setOpen(true),
          onMouseLeave: () => setOpen(false),
          onFocus: () => setOpen(true),
          onBlur: () => setOpen(false),
        }
      : {};
  return (
    <div {...props} {...openHandlers} className={slots.root({ className })}>
      <button
        type="button"
        className={slots.trigger()}
        data-placement={placement}
        onClick={() => triggerMode === "press" && setOpen((value) => !value)}
        aria-expanded={open}
      >
        {items.map((item) => {
          const level = item.level ?? 1;
          return (
            <span
              key={item.id}
              data-active={activeId === item.id}
              className={slots.bar()}
              style={{
                width: activeId === item.id ? 24 : Math.max(8, 18 - level * 3),
              }}
            />
          );
        })}
      </button>
      {open ? (
        <div
          className={slots.content({
            className:
              placement === "right" ? "left-full ml-s-2" : "right-full mr-s-2",
          })}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              data-active={activeId === item.id}
              className={slots.item()}
              style={{ paddingLeft: `${(item.level ?? 1) * 0.75}rem` }}
              onClick={() => onItemPress?.(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export interface HoverCardProps extends DivProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  openDelay?: number;
  closeDelay?: number;
}

interface HoverCardContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLSpanElement | null>;
  openDelay: number;
  closeDelay: number;
}

const HoverCardContext = React.createContext<HoverCardContextValue | null>(
  null
);

const hoverCardStyles = tv({
  slots: {
    trigger: "inline-flex",
    content:
      "absolute z-30 min-w-[240px] rounded-md border border-l-border bg-l-surface-raised p-s-3 text-l-ink shadow-l-pop",
    arrow:
      "absolute h-3 w-3 rotate-45 border-l border-t border-l-border bg-l-surface-raised",
  },
});

function useHoverCardContext() {
  const context = React.useContext(HoverCardContext);
  if (!context)
    throw new Error("HoverCard components must be used within HoverCard");
  return context;
}

function HoverCardRoot({
  open,
  defaultOpen = false,
  onOpenChange,
  openDelay = 700,
  closeDelay = 300,
  children,
  ...props
}: HoverCardProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const triggerRef = React.useRef<HTMLSpanElement | null>(null);
  const isOpen = open ?? internalOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (open === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange, open]
  );
  return (
    <HoverCardContext.Provider
      value={{ open: isOpen, setOpen, triggerRef, openDelay, closeDelay }}
    >
      <span {...props} className={cx("relative inline-flex", props.className)}>
        {children}
      </span>
    </HoverCardContext.Provider>
  );
}

function HoverCardTrigger({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  const slots = hoverCardStyles({});
  const { setOpen, triggerRef, openDelay, closeDelay } = useHoverCardContext();
  const timerRef = React.useRef<number | undefined>(undefined);
  const schedule = (next: boolean, delay: number) => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setOpen(next), delay);
  };
  return (
    <span
      {...props}
      ref={triggerRef}
      className={slots.trigger({ className })}
      onMouseEnter={(event) => {
        props.onMouseEnter?.(event);
        schedule(true, openDelay);
      }}
      onMouseLeave={(event) => {
        props.onMouseLeave?.(event);
        schedule(false, closeDelay);
      }}
      onFocus={(event) => {
        props.onFocus?.(event);
        schedule(true, 0);
      }}
      onBlur={(event) => {
        props.onBlur?.(event);
        schedule(false, closeDelay);
      }}
    />
  );
}

export interface HoverCardContentProps extends DivProps {
  placement?: "top" | "bottom" | "left" | "right";
  offset?: number;
}

function HoverCardContent({
  placement = "top",
  offset = 8,
  className,
  ...props
}: HoverCardContentProps) {
  const slots = hoverCardStyles({});
  const { open } = useHoverCardContext();
  if (!open) return null;
  const placementClass =
    placement === "bottom"
      ? "left-1/2 top-full -translate-x-1/2"
      : placement === "left"
        ? "right-full top-1/2 -translate-y-1/2"
        : placement === "right"
          ? "left-full top-1/2 -translate-y-1/2"
          : "bottom-full left-1/2 -translate-x-1/2";
  return (
    <div
      {...props}
      data-placement={placement}
      className={cx(slots.content(), placementClass, className)}
      style={{ ...props.style, margin: offset }}
    />
  );
}

function HoverCardArrow({ className, ...props }: DivProps) {
  const slots = hoverCardStyles({});
  return <div {...props} aria-hidden className={slots.arrow({ className })} />;
}

export const HoverCard = Object.assign(HoverCardRoot, {
  Trigger: HoverCardTrigger,
  Content: HoverCardContent,
  Arrow: HoverCardArrow,
});

const itemCardStyles = tv({
  slots: {
    root: "item-card flex items-center gap-s-3 rounded-md px-s-3 py-s-3 text-l-ink transition-colors",
    icon: "item-card__icon flex h-9 w-9 shrink-0 items-center justify-center rounded-l bg-l-wash-3 text-l-ink-lo",
    content: "item-card__content min-w-0 flex-1",
    title:
      "item-card__title block truncate font-sans text-[13px] font-medium text-l-ink",
    description:
      "item-card__description mt-[2px] block truncate font-sans text-[12px] text-l-ink-dim",
    action: "item-card__action ml-auto shrink-0",
  },
  variants: {
    variant: {
      default: {
        root: "bg-l-surface-raised shadow-[inset_0_0_0_1px_var(--l-border)]",
      },
      secondary: { root: "bg-l-wash-2" },
      tertiary: { root: "bg-l-wash-1" },
      outline: { root: "border border-l-border bg-transparent" },
      transparent: { root: "bg-transparent" },
    },
    pressable: {
      true: {
        root: "cursor-pointer hover:bg-l-surface-hover focus-visible:ring-1 focus-visible:ring-ember",
      },
    },
  },
  defaultVariants: { variant: "default" },
});

export interface ItemCardProps
  extends DivProps, VariantProps<typeof itemCardStyles> {
  variant?: "default" | "secondary" | "tertiary" | "outline" | "transparent";
  pressable?: boolean;
}

function ItemCardRoot({
  variant = "default",
  pressable,
  className,
  ...props
}: ItemCardProps) {
  const slots = itemCardStyles({ variant, pressable });
  return <div {...props} className={slots.root({ className })} />;
}

export const ItemCard = Object.assign(ItemCardRoot, {
  Icon: ({ className, ...props }: DivProps) => {
    const slots = itemCardStyles({});
    return <div {...props} className={slots.icon({ className })} />;
  },
  Content: ({ className, ...props }: DivProps) => {
    const slots = itemCardStyles({});
    return <div {...props} className={slots.content({ className })} />;
  },
  Title: ({ className, ...props }: SpanProps) => {
    const slots = itemCardStyles({});
    return <span {...props} className={slots.title({ className })} />;
  },
  Description: ({ className, ...props }: SpanProps) => {
    const slots = itemCardStyles({});
    return <span {...props} className={slots.description({ className })} />;
  },
  Action: ({ className, ...props }: DivProps) => {
    const slots = itemCardStyles({});
    return <div {...props} className={slots.action({ className })} />;
  },
});

const itemCardGroupStyles = tv({
  slots: {
    root: "item-card-group rounded-md",
    header: "item-card-group__header mb-s-3",
    title: "item-card-group__title font-sans text-sm font-semibold text-l-ink",
    description:
      "item-card-group__description mt-1 font-sans text-[12px] text-l-ink-dim",
  },
  variants: {
    variant: {
      default: {
        root: "bg-l-surface-raised p-s-2 shadow-[inset_0_0_0_1px_var(--l-border)]",
      },
      secondary: { root: "bg-l-wash-2 p-s-2" },
      tertiary: { root: "bg-l-wash-1 p-s-2" },
      outline: { root: "border border-l-border bg-transparent p-s-2" },
      transparent: { root: "bg-transparent" },
    },
    layout: {
      list: { root: "flex flex-col gap-[1px]" },
      grid: { root: "grid gap-s-3" },
    },
  },
  defaultVariants: { layout: "list", variant: "default" },
});

export interface ItemCardGroupProps
  extends DivProps, VariantProps<typeof itemCardGroupStyles> {
  layout?: "list" | "grid";
  variant?: ItemCardProps["variant"];
  columns?: 2 | 3;
}

function ItemCardGroupRoot({
  layout = "list",
  variant = "default",
  columns = 2,
  className,
  style,
  ...props
}: ItemCardGroupProps) {
  const slots = itemCardGroupStyles({ layout, variant });
  return (
    <div
      {...props}
      className={slots.root({ className })}
      style={{
        ...style,
        gridTemplateColumns:
          layout === "grid" ? `repeat(${columns}, minmax(0, 1fr))` : undefined,
      }}
    />
  );
}

export const ItemCardGroup = Object.assign(ItemCardGroupRoot, {
  Header: ({ className, ...props }: DivProps) => {
    const slots = itemCardGroupStyles({});
    return <div {...props} className={slots.header({ className })} />;
  },
  Title: ({
    className,
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const slots = itemCardGroupStyles({});
    return <h3 {...props} className={slots.title({ className })} />;
  },
  Description: ({
    className,
    ...props
  }: React.HTMLAttributes<HTMLParagraphElement>) => {
    const slots = itemCardGroupStyles({});
    return <p {...props} className={slots.description({ className })} />;
  },
});

const kpiStyles = tv({
  slots: {
    root: "kpi relative flex min-w-0 flex-col gap-s-3 rounded-md border border-l-border bg-l-surface-raised p-s-4",
    header: "kpi__header flex items-start gap-s-3",
    content: "kpi__content grid grid-cols-[1fr_auto] items-end gap-s-3",
    icon: "kpi__icon flex h-9 w-9 items-center justify-center rounded-l bg-l-wash-3",
    actions: "kpi__actions absolute right-s-3 top-s-3",
    title: "kpi__title font-sans text-[12px] font-medium text-l-ink-dim",
    value:
      "kpi__value font-sans text-[28px] font-semibold tracking-tight text-l-ink",
    trend:
      "kpi__trend inline-flex items-center rounded-pill bg-l-wash-3 px-[8px] py-[3px] font-sans text-[12px] font-medium",
    progress: "kpi__progress col-span-full",
    chart: "kpi__chart col-span-full h-16 overflow-hidden text-ember",
    separator: "kpi__separator -mx-s-4 h-px bg-l-border",
    footer: "kpi__footer font-sans text-[12px] text-l-ink-dim",
  },
});

export type KPIProps = React.HTMLAttributes<HTMLDListElement>;

function KPIRoot({ className, ...props }: KPIProps) {
  const slots = kpiStyles({});
  return <dl {...props} className={slots.root({ className })} />;
}

function formatNumber(value: number, format?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(undefined, format).format(value);
}

export interface KPIValueProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  "children"
> {
  value: number;
  format?: Intl.NumberFormatOptions;
  children?: (formatted: string) => React.ReactNode;
}

export interface KPITrendProps extends SpanProps {
  status?: DataDisplayStatus;
}

export interface KPIProgressProps extends DivProps {
  value: number;
  status?: Exclude<DataDisplayStatus, "neutral">;
}

export interface KPIChartProps extends DivProps {
  data: Record<string, number>[];
  dataKey?: string;
  color?: string;
  height?: number;
}

function KPIChart({
  data,
  dataKey = "value",
  color = "currentColor",
  height = 64,
  className,
  ...props
}: KPIChartProps) {
  const slots = kpiStyles({});
  const values = data.map((item) => item[dataKey] ?? 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const width = Math.max((values.length - 1) * 24, 120);
  const points = values
    .map((value, index) => {
      const x =
        values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <div {...props} className={slots.chart({ className })}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        preserveAspectRatio="none"
      >
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
      </svg>
    </div>
  );
}

export const KPI = Object.assign(KPIRoot, {
  Header: ({ className, ...props }: DivProps) => {
    const slots = kpiStyles({});
    return <div {...props} className={slots.header({ className })} />;
  },
  Content: ({ className, ...props }: DivProps) => {
    const slots = kpiStyles({});
    return <div {...props} className={slots.content({ className })} />;
  },
  Icon: ({
    status = "neutral",
    className,
    ...props
  }: DivProps & { status?: DataDisplayStatus }) => {
    const slots = kpiStyles({});
    return (
      <div
        {...props}
        data-status={status}
        className={slots.icon({ className: cx(statusTone[status], className) })}
      />
    );
  },
  Title: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => {
    const slots = kpiStyles({});
    return <dt {...props} className={slots.title({ className })} />;
  },
  Value: ({ value, format, children, className, ...props }: KPIValueProps) => {
    const slots = kpiStyles({});
    const formatted = formatNumber(value, format);
    return (
      <dd {...props} className={slots.value({ className })}>
        {children?.(formatted) ?? formatted}
      </dd>
    );
  },
  Trend: ({ status = "neutral", className, ...props }: KPITrendProps) => {
    const slots = kpiStyles({});
    return (
      <span
        {...props}
        className={slots.trend({
          className: cx(statusTone[status], className),
        })}
      />
    );
  },
  Progress: ({
    value,
    status = "success",
    className,
    ...props
  }: KPIProgressProps) => {
    const slots = kpiStyles({});
    return (
      <div {...props} className={slots.progress({ className })}>
        <ProgressBar
          value={clampPercent(value)}
          aria-label="KPI progress"
          className={statusTone[status]}
        />
      </div>
    );
  },
  Actions: ({ className, children, ...props }: DivProps) => {
    const slots = kpiStyles({});
    return (
      <div {...props} className={slots.actions({ className })}>
        {children ?? (
          <Button variant="ghost" size="sm">
            •••
          </Button>
        )}
      </div>
    );
  },
  Chart: KPIChart,
  Separator: ({ className, ...props }: SpanProps) => {
    const slots = kpiStyles({});
    return <span {...props} className={slots.separator({ className })} />;
  },
  Footer: ({ className, ...props }: DivProps) => {
    const slots = kpiStyles({});
    return <div {...props} className={slots.footer({ className })} />;
  },
});

const kpiGroupStyles = tv({
  slots: {
    root: "kpi-group rounded-md border border-l-border bg-l-surface p-s-2",
    separator: "kpi-group__separator bg-l-border",
  },
  variants: {
    orientation: {
      horizontal: {
        root: "grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))]",
        separator: "mx-s-2 w-px self-stretch",
      },
      vertical: { root: "flex flex-col", separator: "my-s-2 h-px w-full" },
    },
  },
  defaultVariants: { orientation: "horizontal" },
});

export interface KPIGroupProps extends DivProps {
  orientation?: "horizontal" | "vertical";
}

function KPIGroupRoot({
  orientation = "horizontal",
  className,
  ...props
}: KPIGroupProps) {
  const slots = kpiGroupStyles({ orientation });
  return (
    <div
      {...props}
      data-orientation={orientation}
      className={slots.root({ className })}
    />
  );
}

export const KPIGroup = Object.assign(KPIGroupRoot, {
  Separator: ({ className, ...props }: SpanProps) => {
    const slots = kpiGroupStyles({});
    return <span {...props} className={slots.separator({ className })} />;
  },
});

export interface ListViewProps<T> extends Omit<
  DataGridProps<T>,
  "columns" | "getRowId" | "data"
> {
  items?: Iterable<T>;
  children?: React.ReactNode | ((item: T) => React.ReactNode);
  getItemId?: (item: T) => Key;
  variant?: "primary" | "secondary";
}

const listViewStyles = tv({
  slots: {
    root: "list-view w-full rounded-md outline-none",
    item:
      "list-view__item flex items-center gap-s-3 rounded-l px-s-3 py-s-3 text-l-ink outline-none transition-colors " +
      "hover:bg-l-surface-hover data-[selected=true]:bg-l-surface-selected",
    content: "list-view__item-content min-w-0 flex flex-1 items-center gap-s-3",
    title:
      "list-view__title block truncate font-sans text-[13px] font-medium text-l-ink",
    description:
      "list-view__description block truncate font-sans text-[12px] text-l-ink-dim",
    action: "list-view__item-action ml-auto shrink-0",
  },
  variants: {
    variant: {
      primary: { root: "bg-l-wash-2 p-s-2" },
      secondary: { root: "divide-y divide-l-border bg-transparent" },
    },
  },
  defaultVariants: { variant: "primary" },
});

function ListViewRoot<T>({
  items,
  children,
  getItemId = (item: T) => (item as { id: Key }).id,
  selectionMode = "none",
  selectedKeys,
  defaultSelectedKeys,
  onSelectionChange,
  renderEmptyState,
  variant = "primary",
  className,
  "aria-label": ariaLabel,
  ...props
}: ListViewProps<T>) {
  const slots = listViewStyles({ variant });
  const data = Array.from(items ?? []);
  const [internalSelected, setInternalSelected] = React.useState<Set<Key>>(
    () => new Set(defaultSelectedKeys)
  );
  const selected = selectedKeys ?? internalSelected;
  const setSelected = (keys: Set<Key>) => {
    if (!selectedKeys) setInternalSelected(keys);
    onSelectionChange?.(keys);
  };
  const toggle = (key: Key) => {
    if (selectionMode === "none") return;
    if (selectionMode === "single") {
      setSelected(selected.has(key) ? new Set() : new Set([key]));
      return;
    }
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };
  return (
    <div
      {...props}
      role="listbox"
      aria-label={ariaLabel}
      className={slots.root({ className })}
    >
      {data.length === 0
        ? (renderEmptyState?.() ?? (
            <div className="p-s-6 text-center text-sm text-l-ink-dim">
              No items.
            </div>
          ))
        : data.map((item) => {
            const key = getItemId(item);
            return (
              <div
                key={String(key)}
                data-selected={selected.has(key)}
                className={slots.item()}
              >
                {selectionMode !== "none" ? (
                  <input
                    type={selectionMode === "single" ? "radio" : "checkbox"}
                    checked={selected.has(key)}
                    onChange={() => toggle(key)}
                    className="accent-ember"
                    aria-label={`Select ${String(key)}`}
                  />
                ) : null}
                {typeof children === "function" ? children(item) : children}
              </div>
            );
          })}
    </div>
  );
}

export const ListView = Object.assign(ListViewRoot, {
  Item: ({ className, ...props }: DivProps) => {
    const slots = listViewStyles({});
    return <div {...props} className={slots.item({ className })} />;
  },
  ItemContent: ({ className, ...props }: DivProps) => {
    const slots = listViewStyles({});
    return <div {...props} className={slots.content({ className })} />;
  },
  Title: ({ className, ...props }: SpanProps) => {
    const slots = listViewStyles({});
    return <span {...props} className={slots.title({ className })} />;
  },
  Description: ({ className, ...props }: SpanProps) => {
    const slots = listViewStyles({});
    return <span {...props} className={slots.description({ className })} />;
  },
  ItemAction: ({ className, ...props }: DivProps) => {
    const slots = listViewStyles({});
    return <div {...props} className={slots.action({ className })} />;
  },
});

const kanbanStyles = tv({
  slots: {
    root: "kanban grid auto-cols-[var(--kanban-column-min-width)] grid-flow-col gap-[var(--kanban-column-gap)] overflow-x-auto pb-s-2 [--kanban-column-gap:16px] [--kanban-column-min-width:280px]",
    column: "kanban__column flex min-h-[320px] flex-col gap-s-2",
    body: "kanban__column-body flex flex-1 flex-col gap-s-2 rounded-md bg-l-wash-2 p-s-2",
    header: "kanban__column-header flex items-center gap-s-2 px-s-1",
    actions:
      "kanban__column-actions ml-auto opacity-0 transition-opacity group-hover:opacity-100",
    indicator: "kanban__column-indicator h-2 w-2 rounded-pill bg-ember",
    title: "kanban__column-title font-sans text-sm font-semibold text-l-ink",
    count:
      "kanban__column-count rounded-pill bg-l-wash-3 px-[6px] py-[2px] text-[11px] text-l-ink-dim",
    cardList: "kanban__card-list flex flex-col gap-s-2",
    card: "kanban__card rounded-md bg-l-surface-raised p-s-3 text-sm text-l-ink shadow-[inset_0_0_0_1px_var(--l-border)] hover:bg-l-surface-hover",
    empty:
      "kanban__empty rounded-md border border-dashed border-l-border p-s-4 text-center text-sm text-l-ink-dim",
  },
  variants: {
    size: {
      sm: {
        root: "[--kanban-column-gap:12px] [--kanban-column-min-width:240px]",
        card: "p-s-2 text-xs",
      },
      md: {},
      lg: {
        root: "[--kanban-column-gap:20px] [--kanban-column-min-width:320px]",
        card: "p-s-4 text-base",
      },
    },
  },
  defaultVariants: { size: "md" },
});

export interface KanbanProps extends DivProps {
  size?: "sm" | "md" | "lg";
}

function KanbanRoot({ size = "md", className, ...props }: KanbanProps) {
  const slots = kanbanStyles({ size });
  return <div {...props} className={slots.root({ className })} />;
}

export const Kanban = Object.assign(KanbanRoot, {
  Column: ({ className, ...props }: DivProps) => {
    const slots = kanbanStyles({});
    return <section {...props} className={slots.column({ className })} />;
  },
  ColumnBody: ({ className, ...props }: DivProps) => {
    const slots = kanbanStyles({});
    return <div {...props} className={slots.body({ className })} />;
  },
  ColumnHeader: ({ className, ...props }: DivProps) => {
    const slots = kanbanStyles({});
    return (
      <div
        {...props}
        className={slots.header({ className: cx("group", className) })}
      />
    );
  },
  ColumnActions: ({ className, ...props }: DivProps) => {
    const slots = kanbanStyles({});
    return <div {...props} className={slots.actions({ className })} />;
  },
  ColumnIndicator: ({ className, ...props }: SpanProps) => {
    const slots = kanbanStyles({});
    return <span {...props} className={slots.indicator({ className })} />;
  },
  ColumnTitle: ({
    className,
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const slots = kanbanStyles({});
    return <h3 {...props} className={slots.title({ className })} />;
  },
  ColumnCount: ({ className, ...props }: SpanProps) => {
    const slots = kanbanStyles({});
    return <span {...props} className={slots.count({ className })} />;
  },
  CardList: ({
    className,
    children,
    ...props
  }: DivProps & { renderEmptyState?: () => React.ReactNode }) => {
    const slots = kanbanStyles({});
    return (
      <div {...props} className={slots.cardList({ className })}>
        {children ?? props.renderEmptyState?.()}
      </div>
    );
  },
  Card: ({ className, ...props }: DivProps) => {
    const slots = kanbanStyles({});
    return <article {...props} className={slots.card({ className })} />;
  },
  Empty: ({ className, ...props }: DivProps) => {
    const slots = kanbanStyles({});
    return <div {...props} className={slots.empty({ className })} />;
  },
});

const widgetStyles = tv({
  slots: {
    root: "widget rounded-lg border border-l-border bg-l-wash-2 p-s-3",
    header: "widget__header mb-s-3 flex items-start justify-between gap-s-3",
    title: "widget__title font-sans text-sm font-semibold text-l-ink",
    description:
      "widget__description mt-1 font-sans text-[12px] text-l-ink-dim",
    content:
      "widget__content rounded-md border border-l-border bg-l-surface-raised p-s-4 shadow-sm",
    footer: "widget__footer mt-s-3 font-sans text-[12px] text-l-ink-dim",
    legend: "widget__legend flex flex-wrap items-center gap-s-3",
    legendItem:
      "widget__legend-item inline-flex items-center gap-[6px] text-[12px] text-l-ink-dim",
    legendDot: "widget__legend-item-dot h-2 w-2 rounded-pill",
  },
});

export type WidgetProps = DivProps;

function WidgetRoot({ className, ...props }: WidgetProps) {
  const slots = widgetStyles({});
  return <div {...props} className={slots.root({ className })} />;
}

export const Widget = Object.assign(WidgetRoot, {
  Header: ({ className, ...props }: DivProps) => {
    const slots = widgetStyles({});
    return <div {...props} className={slots.header({ className })} />;
  },
  Title: ({
    className,
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const slots = widgetStyles({});
    return <h3 {...props} className={slots.title({ className })} />;
  },
  Description: ({
    className,
    ...props
  }: React.HTMLAttributes<HTMLParagraphElement>) => {
    const slots = widgetStyles({});
    return <p {...props} className={slots.description({ className })} />;
  },
  Content: ({ className, ...props }: DivProps) => {
    const slots = widgetStyles({});
    return <div {...props} className={slots.content({ className })} />;
  },
  Footer: ({ className, ...props }: DivProps) => {
    const slots = widgetStyles({});
    return <div {...props} className={slots.footer({ className })} />;
  },
  Legend: ({ className, ...props }: DivProps) => {
    const slots = widgetStyles({});
    return <div {...props} className={slots.legend({ className })} />;
  },
  LegendItem: ({
    color,
    className,
    children,
    ...props
  }: DivProps & { color: string }) => {
    const slots = widgetStyles({});
    return (
      <div {...props} className={slots.legendItem({ className })}>
        <span
          className={slots.legendDot()}
          style={{ backgroundColor: color }}
        />
        {children}
      </div>
    );
  },
});
