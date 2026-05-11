"use client";

/*
 * DataTableColumnHeader — tablecn-style sortable column header.
 *
 * Modeled after tablecn's DataTableColumnHeader. Click the label →
 * dropdown menu with `Asc` / `Desc` / `Hide`. Shift-click on Asc /
 * Desc adds the column to a multi-column sort instead of replacing
 * the current primary sort.
 *
 * Renders as a plain label when the column is neither sortable nor
 * hideable (so the always-on `select` / `chevron` slots don't get
 * an empty caret affordance).
 */

import * as React from "react";
import type { Column } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  EyeOff,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../primitives/dropdown-menu";
import { cn } from "../../utils/cn";

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  label: React.ReactNode;
  /** Sort priority index when this column participates in a
   *  multi-column sort (0-based; rendered as a small `1`/`2`/`3`
   *  chip beside the arrow). When omitted no chip is rendered. */
  sortIndex?: number;
  /** Total active sort columns. The priority chip only shows when
   *  `> 1` — a single-column sort doesn't need a priority hint. */
  sortCount?: number;
  align?: "left" | "right";
  className?: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  label,
  sortIndex,
  sortCount,
  align = "left",
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort() && !column.getCanHide()) {
    return (
      <span
        className={cn(
          "inline-flex items-center text-l-ink-dim",
          align === "right" ? "justify-end" : "justify-start",
          className,
        )}
      >
        {label}
      </span>
    );
  }

  const sorted = column.getIsSorted();
  const showPriority =
    typeof sortIndex === "number" &&
    typeof sortCount === "number" &&
    sortCount > 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button
          type="button"
          className={cn(
            "group/headercell inline-flex h-6 items-center gap-1 rounded-[2px] px-1",
            "outline-none transition-colors hover:bg-l-surface-hover hover:text-l-ink",
            "focus-visible:ring-1 focus-visible:ring-ember/40",
            "data-[state=open]:bg-l-surface-hover data-[state=open]:text-l-ink",
            align === "right" ? "ml-auto" : null,
            className,
          )}
        >
          <span className="truncate">{label}</span>
          {column.getCanSort() ? (
            sorted === "desc" ? (
              <ArrowDown className="size-2.5 shrink-0" strokeWidth={2.25} />
            ) : sorted === "asc" ? (
              <ArrowUp className="size-2.5 shrink-0" strokeWidth={2.25} />
            ) : (
              <ChevronsUpDown
                className="size-2.5 shrink-0 opacity-0 group-hover/headercell:opacity-60 transition-opacity"
                strokeWidth={2.25}
              />
            )
          ) : null}
          {showPriority ? (
            <span className="ml-0.5 font-mono text-[8px] text-l-ink-dim">
              {(sortIndex as number) + 1}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align === "right" ? "end" : "start"}>
        {column.getCanSort() ? (
          <>
            <DropdownMenuItem
              onSelect={(event) => {
                /* Radix passes a custom Event without modifier flags.
                   We rely on `event.shiftKey` from the underlying
                   pointer event when present (Radix forwards it on
                   keyboard activation; for click-to-select we use the
                   event's defaultPrevented flag). */
                const additive = isShiftHeldOnSelect(event);
                column.toggleSorting(false, additive);
              }}
            >
              <ArrowUp className="size-3.5 text-l-ink-dim" strokeWidth={2} />
              <span>Asc</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(event) => {
                const additive = isShiftHeldOnSelect(event);
                column.toggleSorting(true, additive);
              }}
            >
              <ArrowDown className="size-3.5 text-l-ink-dim" strokeWidth={2} />
              <span>Desc</span>
            </DropdownMenuItem>
            {sorted ? (
              <DropdownMenuItem onSelect={() => column.clearSorting()}>
                <ChevronsUpDown
                  className="size-3.5 text-l-ink-dim"
                  strokeWidth={2}
                />
                <span>Reset</span>
              </DropdownMenuItem>
            ) : null}
          </>
        ) : null}
        {column.getCanSort() && column.getCanHide() ? (
          <DropdownMenuSeparator />
        ) : null}
        {column.getCanHide() ? (
          <DropdownMenuItem onSelect={() => column.toggleVisibility(false)}>
            <EyeOff className="size-3.5 text-l-ink-dim" strokeWidth={2} />
            <span>Hide</span>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Resolve the shift modifier on a Radix `Item` selection event.
 *  Radix synthesizes a `CustomEvent` whose `detail` carries the
 *  original `MouseEvent` for pointer-driven selects; for keyboard
 *  Enter we fall back to the active `KeyboardEvent` on the document.
 *  Defensive lookups keep us safe across Radix versions. */
function isShiftHeldOnSelect(event: Event): boolean {
  if (event && "shiftKey" in event) {
    return Boolean((event as KeyboardEvent | MouseEvent).shiftKey);
  }
  const detail = (event as { detail?: { originalEvent?: { shiftKey?: boolean } } })
    .detail;
  if (detail?.originalEvent?.shiftKey) return true;
  return false;
}
