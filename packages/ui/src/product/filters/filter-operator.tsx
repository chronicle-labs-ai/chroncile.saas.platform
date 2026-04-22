"use client";

import * as React from "react";
import { Button as RACButton } from "react-aria-components";

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
      "inline-flex h-full items-center gap-s-1 px-s-2 font-mono text-mono-sm " +
      "text-ink-lo outline-none transition-colors duration-fast ease-out " +
      "data-[hovered=true]:text-ink-hi data-[hovered=true]:bg-surface-03 " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:outline-ember",
    caret: "h-3 w-3 shrink-0 opacity-60",
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
        <RACButton className={slots.trigger()} aria-label="Operator">
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
        </RACButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {available.map((op) => (
          <DropdownMenuItem
            key={op}
            id={op}
            onAction={() => onChange(op)}
          >
            {OPERATORS[op].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
