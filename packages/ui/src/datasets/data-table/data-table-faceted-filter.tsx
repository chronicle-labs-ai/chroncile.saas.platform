"use client";

/*
 * DataTableFacetedFilter — popover-style faceted filter chip.
 *
 * Modeled after tablecn's `DataTableFacetedFilter` but adapted to
 * Chronicle primitives (chron Button / Popover / Command / Badge /
 * Separator) and the Linear-density chip metric the dataset toolbar
 * already uses.
 *
 * Renders as a single dashed-border button that, on activation, surfaces
 * a popover with a fuzzy-search command-list of the column's option set.
 * Selected values render as inline badges in the trigger (up to two);
 * past two we collapse to "{n} selected".
 *
 * Multi-select is the default (mirrors how DatasetFilterRail used to
 * work); pass `multiple={false}` for a single-value filter that auto-
 * dismisses on pick.
 */

import * as React from "react";
import type { Column } from "@tanstack/react-table";
import { Check, PlusCircle, XCircle } from "lucide-react";

import { Button } from "../../primitives/button";
import { Badge } from "../../primitives/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../../primitives/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../primitives/popover";
import { Separator } from "../../primitives/separator";
import { cn } from "../../utils/cn";

import type { Option } from "./types";

interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title?: string;
  options: readonly Option[];
  /** Multi-select by default; set to false for radio-style filters. */
  multiple?: boolean;
  /** Optional: take counts directly from the table's faceted unique values. */
  showFacetedCounts?: boolean;
  className?: string;
}

export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
  multiple = true,
  showFacetedCounts,
  className,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const [open, setOpen] = React.useState(false);

  const facetedCounts = showFacetedCounts
    ? column?.getFacetedUniqueValues()
    : undefined;

  const columnFilterValue = column?.getFilterValue();
  const selectedValues = React.useMemo(
    () =>
      new Set(
        Array.isArray(columnFilterValue)
          ? (columnFilterValue as string[])
          : [],
      ),
    [columnFilterValue],
  );

  const onItemSelect = React.useCallback(
    (option: Option, isSelected: boolean) => {
      if (!column) return;
      if (multiple) {
        const next = new Set(selectedValues);
        if (isSelected) next.delete(option.value);
        else next.add(option.value);
        const arr = Array.from(next);
        column.setFilterValue(arr.length > 0 ? arr : undefined);
      } else {
        column.setFilterValue(isSelected ? undefined : [option.value]);
        setOpen(false);
      }
    },
    [column, multiple, selectedValues],
  );

  const onReset = React.useCallback(
    (event?: React.MouseEvent) => {
      event?.stopPropagation();
      column?.setFilterValue(undefined);
    },
    [column],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-[26px] gap-1.5 border-dashed px-2 text-[12px] text-l-ink-lo",
            className,
          )}
        >
          {selectedValues.size > 0 ? (
            <button
              type="button"
              aria-label={`Clear ${title ?? "filter"}`}
              onClick={onReset}
              className="rounded-pill text-l-ink-dim hover:text-l-ink"
            >
              <XCircle className="size-3.5" strokeWidth={1.75} />
            </button>
          ) : (
            <PlusCircle className="size-3.5" strokeWidth={1.75} />
          )}
          <span className="font-medium">{title}</span>
          {selectedValues.size > 0 ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-0.5 h-3.5 data-[orientation=vertical]:h-3.5"
              />
              <Badge
                variant="ember"
                className="rounded-sm font-mono text-[10px] lg:hidden"
              >
                {selectedValues.size}
              </Badge>
              <div className="hidden items-center gap-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge
                    variant="ember"
                    className="rounded-sm font-mono text-[10px]"
                  >
                    {selectedValues.size} selected
                  </Badge>
                ) : (
                  options
                    .filter((o) => selectedValues.has(o.value))
                    .map((o) => (
                      <Badge
                        key={o.value}
                        variant="ember"
                        className="rounded-sm font-mono text-[10px]"
                      >
                        {o.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value);
                const Icon = option.icon;
                const facetedCount = facetedCounts?.get(option.value);
                const count = option.count ?? facetedCount;
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => onItemSelect(option, isSelected)}
                  >
                    <span
                      className={cn(
                        "mr-2 inline-flex size-3.5 shrink-0 items-center justify-center rounded-xs border",
                        isSelected
                          ? "bg-ember border-ember text-white"
                          : "border-l-border-strong opacity-60",
                      )}
                      aria-hidden
                    >
                      {isSelected ? (
                        <Check className="size-3" strokeWidth={3} />
                      ) : null}
                    </span>
                    {Icon ? (
                      <Icon className="mr-1.5 size-3.5 text-l-ink-dim" />
                    ) : null}
                    <span className="flex-1 truncate">{option.label}</span>
                    {count !== undefined ? (
                      <span className="ml-auto font-mono text-[10px] tabular-nums text-l-ink-dim">
                        {count}
                      </span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.size > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onReset()}
                    className="justify-center text-center text-l-ink-lo"
                  >
                    Clear filter
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
