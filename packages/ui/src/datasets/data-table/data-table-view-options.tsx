"use client";

/*
 * DataTableViewOptions — column visibility menu.
 *
 * Modeled after tablecn but rendered with chron's Popover + Command.
 * Lists every column whose `getCanHide()` is true; each row toggles
 * the column's visibility on click. Mirrors the shape of the
 * existing "Display properties" chip wrap inside the canvas's
 * DisplayPopover so consumers can drop this in alongside, or swap
 * the chip wrap for it entirely.
 */

import * as React from "react";
import type { Table } from "@tanstack/react-table";
import { Check, Settings2 } from "lucide-react";

import { Button } from "../../primitives/button";
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
import { cn } from "../../utils/cn";

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
  /** Optional label for the trigger; defaults to "View". */
  label?: string;
  /** Hide the trigger's leading icon (when embedded inside another menu). */
  hideIcon?: boolean;
  className?: string;
}

export function DataTableViewOptions<TData>({
  table,
  label = "View",
  hideIcon,
  className,
}: DataTableViewOptionsProps<TData>) {
  const columns = React.useMemo(
    () =>
      table
        .getAllColumns()
        .filter(
          (column) =>
            typeof column.accessorFn !== "undefined" && column.getCanHide(),
        ),
    [table],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-[26px] gap-1.5 px-2 text-[12px] text-l-ink-lo",
            className,
          )}
        >
          {hideIcon ? null : (
            <Settings2 className="size-3.5" strokeWidth={1.75} />
          )}
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search columns…" />
          <CommandList>
            <CommandEmpty>No columns found.</CommandEmpty>
            <CommandGroup>
              {columns.map((column) => {
                const visible = column.getIsVisible();
                const meta = column.columnDef.meta;
                const colLabel = meta?.label ?? column.id;
                return (
                  <CommandItem
                    key={column.id}
                    onSelect={() => column.toggleVisibility(!visible)}
                  >
                    <span className="flex-1 truncate">{colLabel}</span>
                    <Check
                      className={cn(
                        "size-3.5 shrink-0",
                        visible ? "opacity-100 text-ember" : "opacity-0",
                      )}
                      strokeWidth={2.25}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
