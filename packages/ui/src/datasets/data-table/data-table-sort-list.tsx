"use client";

/*
 * DataTableSortList — multi-column sort UI.
 *
 * Modeled after tablecn's DataTableSortList but ported to chron
 * primitives (Popover / Command / Select / Button / Badge) and
 * stripped of the @dnd-kit drag-reorder dependency. Priority
 * ordering is exposed via small ↑/↓ buttons on each row instead;
 * we can wire drag-reorder in later if it earns its keep.
 *
 * The component reflects directly into TanStack's `SortingState`
 * via `table.setSorting`. Mounting it inside the canvas's
 * DisplayPopover (in place of the legacy single-axis Ordering
 * dropdown) is the primary call site.
 */

import * as React from "react";
import type { ColumnSort, Table } from "@tanstack/react-table";
import {
  ArrowDownUp,
  ChevronsUpDown,
  ArrowDown,
  ArrowUp,
  Trash2,
} from "lucide-react";

import { Button } from "../../primitives/button";
import { Badge } from "../../primitives/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../primitives/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../primitives/popover";
import { Select, SelectItem } from "../../primitives/select";
import { cn } from "../../utils/cn";

interface DataTableSortListProps<TData> {
  table: Table<TData>;
  disabled?: boolean;
  className?: string;
  /** Icon-only square pill trigger, with a small dot when sort is active. */
  compact?: boolean;
}

export function DataTableSortList<TData>({
  table,
  disabled,
  className,
  compact,
}: DataTableSortListProps<TData>) {
  const sorting = table.getState().sorting;

  const { columnLabels, availableColumns } = React.useMemo(() => {
    const labels = new Map<string, string>();
    const sortingIds = new Set(sorting.map((s) => s.id));
    const available: { id: string; label: string }[] = [];
    for (const column of table.getAllColumns()) {
      if (!column.getCanSort()) continue;
      const label = column.columnDef.meta?.label ?? column.id;
      labels.set(column.id, label);
      if (!sortingIds.has(column.id)) {
        available.push({ id: column.id, label });
      }
    }
    return { columnLabels: labels, availableColumns: available };
  }, [sorting, table]);

  const onSortAdd = React.useCallback(
    (columnId: string) => {
      table.setSorting((prev) => [...prev, { id: columnId, desc: false }]);
    },
    [table],
  );

  const onSortUpdate = React.useCallback(
    (sortId: string, updates: Partial<ColumnSort>) => {
      table.setSorting((prev) =>
        prev.map((s) => (s.id === sortId ? { ...s, ...updates } : s)),
      );
    },
    [table],
  );

  const onSortRemove = React.useCallback(
    (sortId: string) => {
      table.setSorting((prev) => prev.filter((s) => s.id !== sortId));
    },
    [table],
  );

  const onSortMove = React.useCallback(
    (index: number, direction: -1 | 1) => {
      table.setSorting((prev) => {
        const target = index + direction;
        if (target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        const [item] = next.splice(index, 1);
        if (item) next.splice(target, 0, item);
        return next;
      });
    },
    [table],
  );

  const onSortingReset = React.useCallback(() => {
    table.setSorting(table.initialState.sorting);
  }, [table]);

  const isActive = sorting.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        {compact ? (
          <button
            type="button"
            disabled={disabled}
            aria-label={
              isActive ? `Sort (${sorting.length} active)` : "Sort"
            }
            title="Sort"
            className={cn(
              "relative inline-flex size-8 shrink-0 items-center justify-center rounded-[10px]",
              "border border-l-border-faint bg-l-wash-1 text-l-ink-lo",
              "transition-colors duration-fast ease-out motion-reduce:transition-none",
              "hover:bg-l-wash-3 hover:text-l-ink",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
              "disabled:cursor-not-allowed disabled:opacity-40",
              isActive ? "text-l-ink" : null,
              className,
            )}
          >
            <ArrowDownUp className="size-4" strokeWidth={1.75} aria-hidden />
            {isActive ? (
              <span
                aria-hidden
                className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-ember"
              />
            ) : null}
          </button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn(
              "h-[26px] gap-1.5 px-2 text-[12px] text-l-ink-lo",
              className,
            )}
          >
            <ArrowDownUp className="size-3.5" strokeWidth={1.75} />
            Sort
            {sorting.length > 0 ? (
              <Badge
                variant="ember"
                className="rounded-sm font-mono text-[10px]"
              >
                {sorting.length}
              </Badge>
            ) : null}
          </Button>
        )}
      </PopoverTrigger>

      <PopoverContent
        className="w-[320px] p-0"
        align="end"
      >
        <div className="flex flex-col gap-1.5 px-3 py-2">
          <span className="font-sans text-[11px] font-medium text-l-ink">
            {sorting.length > 0 ? "Sort by" : "No sorting applied"}
          </span>
          <span className="font-sans text-[11px] text-l-ink-dim">
            {sorting.length > 0
              ? "Drag priority handles to reorder. Top → bottom is highest → lowest priority."
              : "Add a column to start sorting rows."}
          </span>
        </div>

        {sorting.length > 0 ? (
          <div className="flex flex-col border-t border-hairline">
            {sorting.map((sort, idx) => (
              <DataTableSortItem
                key={sort.id}
                index={idx}
                sort={sort}
                isFirst={idx === 0}
                isLast={idx === sorting.length - 1}
                columnLabels={columnLabels}
                onSortUpdate={onSortUpdate}
                onSortRemove={onSortRemove}
                onSortMove={onSortMove}
              />
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-1 border-t border-hairline p-2">
          <AddSortButton
            columns={availableColumns}
            onAdd={onSortAdd}
            disabled={availableColumns.length === 0}
          />
          {sorting.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[12px] text-l-ink-lo"
              onClick={onSortingReset}
            >
              Reset
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface AddSortButtonProps {
  columns: { id: string; label: string }[];
  onAdd: (columnId: string) => void;
  disabled?: boolean;
}

function AddSortButton({ columns, onAdd, disabled }: AddSortButtonProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[12px] text-l-ink-lo"
          disabled={disabled}
        >
          <ChevronsUpDown className="size-3.5" strokeWidth={1.75} />
          Add sort
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search columns…" />
          <CommandList>
            <CommandEmpty>No columns left.</CommandEmpty>
            <CommandGroup>
              {columns.map((c) => (
                <CommandItem
                  key={c.id}
                  onSelect={() => {
                    onAdd(c.id);
                    setOpen(false);
                  }}
                >
                  {c.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface DataTableSortItemProps {
  index: number;
  sort: ColumnSort;
  isFirst: boolean;
  isLast: boolean;
  columnLabels: Map<string, string>;
  onSortUpdate: (sortId: string, updates: Partial<ColumnSort>) => void;
  onSortRemove: (sortId: string) => void;
  onSortMove: (index: number, direction: -1 | 1) => void;
}

function DataTableSortItem({
  index,
  sort,
  isFirst,
  isLast,
  columnLabels,
  onSortUpdate,
  onSortRemove,
  onSortMove,
}: DataTableSortItemProps) {
  const label = columnLabels.get(sort.id) ?? sort.id;
  return (
    <div className="flex items-center gap-1 px-2 py-1.5">
      <div className="flex flex-col">
        <button
          type="button"
          aria-label="Move up in priority"
          onClick={() => onSortMove(index, -1)}
          disabled={isFirst}
          className={cn(
            "flex size-3 items-center justify-center text-l-ink-dim",
            isFirst
              ? "opacity-30"
              : "hover:text-l-ink",
          )}
        >
          <ArrowUp className="size-3" strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label="Move down in priority"
          onClick={() => onSortMove(index, 1)}
          disabled={isLast}
          className={cn(
            "flex size-3 items-center justify-center text-l-ink-dim",
            isLast
              ? "opacity-30"
              : "hover:text-l-ink",
          )}
        >
          <ArrowDown className="size-3" strokeWidth={2} />
        </button>
      </div>

      <span className="flex-1 truncate font-sans text-[12px] text-l-ink">
        {label}
      </span>

      <div className="w-[88px] shrink-0">
        <Select
          value={sort.desc ? "desc" : "asc"}
          onValueChange={(value) =>
            onSortUpdate(sort.id, { desc: value === "desc" })
          }
        >
          <SelectItem value="asc">Asc</SelectItem>
          <SelectItem value="desc">Desc</SelectItem>
        </Select>
      </div>

      <button
        type="button"
        aria-label={`Remove ${label} from sort`}
        onClick={() => onSortRemove(sort.id)}
        className="flex size-6 shrink-0 items-center justify-center text-l-ink-dim hover:text-l-ink"
      >
        <Trash2 className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
