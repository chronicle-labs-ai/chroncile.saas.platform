"use client";

/*
 * DataTableRowHeightMenu — tablecn-style row-density selector.
 *
 * Exposes four discrete heights (compact / default / comfortable /
 * spacious) so the dataset canvas can mirror tablecn's row-height
 * menu UX. Sized for the toolbar — 26 px chip with a leading icon
 * + a small caret. Drops into the canvas where the legacy 2-step
 * density toggle would have lived.
 *
 * Stays controlled — the canvas is the source of truth for the
 * active value, the menu just dispatches the next pick.
 */

import * as React from "react";
import { Check, Rows3 } from "lucide-react";

import { Button } from "../../primitives/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../primitives/popover";
import { cn } from "../../utils/cn";

export type DatasetTracesRowHeight =
  | "compact"
  | "default"
  | "comfortable"
  | "spacious";

/* Sized for parity with tablecn's reference rows: their default row
 * sits around 40 px, with discrete steps at 32 / 48 / 56 for
 * compact / comfortable / spacious. The compact step keeps the
 * legacy chron Linear-density experience available for power users
 * who want denser scanning. */
export const ROW_HEIGHT_PX: Record<DatasetTracesRowHeight, number> = {
  compact: 32,
  default: 40,
  comfortable: 48,
  spacious: 56,
};

interface DataTableRowHeightMenuProps {
  value: DatasetTracesRowHeight;
  onChange: (next: DatasetTracesRowHeight) => void;
  className?: string;
}

const OPTIONS: Array<{
  value: DatasetTracesRowHeight;
  label: string;
  px: number;
}> = [
  { value: "compact", label: "Compact", px: ROW_HEIGHT_PX.compact },
  { value: "default", label: "Default", px: ROW_HEIGHT_PX.default },
  { value: "comfortable", label: "Comfortable", px: ROW_HEIGHT_PX.comfortable },
  { value: "spacious", label: "Spacious", px: ROW_HEIGHT_PX.spacious },
];

export function DataTableRowHeightMenu({
  value,
  onChange,
  className,
}: DataTableRowHeightMenuProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-[26px] gap-1.5 px-2 text-[12px] text-l-ink-lo",
            className,
          )}
          aria-label="Row height"
          title="Row height"
        >
          <Rows3 className="size-3.5" strokeWidth={1.75} />
          <span className="hidden sm:inline">Height</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-1" align="end">
        <ul role="listbox" aria-label="Row height" className="flex flex-col">
          {OPTIONS.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-[3px] px-2 py-1.5 text-left",
                    "font-sans text-[12px] text-l-ink",
                    "hover:bg-l-surface-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
                    active ? "bg-l-surface-selected" : null,
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="flex h-3 w-4 flex-col items-stretch justify-between"
                    >
                      {/* Visual density hint: more strokes = denser row. */}
                      {Array.from({
                        length:
                          opt.value === "compact"
                            ? 4
                            : opt.value === "default"
                              ? 3
                              : opt.value === "comfortable"
                                ? 2
                                : 2,
                      }).map((_, i) => (
                        <span
                          key={i}
                          className="h-px bg-muted-foreground"
                        />
                      ))}
                    </span>
                    <span>{opt.label}</span>
                  </span>
                  {active ? (
                    <Check className="size-3.5 text-ember" strokeWidth={2} />
                  ) : (
                    <span className="font-mono text-[10px] tabular-nums text-l-ink-dim">
                      {opt.px}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
