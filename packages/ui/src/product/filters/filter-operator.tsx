"use client";

import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../primitives/dropdown-menu";
import { tv } from "../../utils/tv";

import { OPERATORS, OPERATORS_BY_TYPE } from "./operators";
import type { ColumnType, FilterOperator } from "./types";

const styles = tv({
  slots: {
    trigger:
      "group inline-flex h-full items-center gap-s-1 px-s-2 font-mono text-mono-sm " +
      "text-ink-lo outline-none transition-colors duration-fast ease-out " +
      "hover:text-ink-hi hover:bg-surface-03 " +
      "focus-visible:outline focus-visible:outline-1 " +
      "focus-visible:outline-ember",
    caret:
      "h-3 w-3 shrink-0 opacity-60 transition-transform duration-fast ease-out " +
      "group-data-[state=open]:rotate-180",
  },
});

export interface FilterOperatorMenuProps {
  type: ColumnType;
  operator: FilterOperator;
  onChange: (next: FilterOperator) => void;
}

export function FilterOperatorMenu({
  type,
  operator,
  onChange,
}: FilterOperatorMenuProps) {
  const available = OPERATORS_BY_TYPE[type];
  const slots = styles({});

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button type="button" className={slots.trigger()} aria-label="Operator">
          <span>{OPERATORS[operator].pillLabel}</span>
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            className={slots.caret()}
          >
            <path
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {available.map((op) => (
          <DropdownMenuItem key={op} onSelect={() => onChange(op)}>
            {OPERATORS[op].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
