"use client";

import * as React from "react";

import { tv } from "../utils/tv";
import {
  EventRow,
  type EventRowProps,
  type EventLane,
  type EventRowDensity,
} from "./event-row";

export interface EventStreamItem extends Omit<
  EventRowProps,
  "selected" | "lane" | "density"
> {
  id: string;
  lane: EventLane;
}

export interface EventStreamProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onSelect"
> {
  items: EventStreamItem[];
  /** Id of the highlighted row. Only one row highlights at a time. */
  selectedId?: string;
  onSelect?: (id: string) => void;
  /** Optional day separator rendered above the first item. */
  daySeparator?: React.ReactNode;
  /**
   * Density of every child row. Defaults to `"compact"`. The center
   * spine and day-separator alignment shift with the time column
   * width so both densities feel native.
   */
  density?: EventRowDensity;
}

const streamStyles = tv({
  slots: {
    root: "relative flex-1 overflow-auto",
    daySep:
      "relative flex items-center gap-s-3 font-mono text-mono-sm uppercase tracking-eyebrow text-ink-dim " +
      "before:content-[''] after:ml-s-3 after:h-px after:flex-1 after:content-['']",
  },
  variants: {
    density: {
      compact: {
        // Spine sits between the time column (100px) and the dot column (16px).
        root:
          "py-0 " +
          "before:absolute before:left-[127px] before:top-0 before:bottom-0 " +
          "before:w-px before:bg-l-border-faint before:content-['']",
        daySep:
          "px-s-5 pl-[140px] pt-s-3 pb-s-2 text-l-ink-dim after:bg-l-border",
      },
      brand: {
        root:
          "py-s-2 pb-s-5 " +
          "before:absolute before:left-[86px] before:top-0 before:bottom-0 " +
          "before:w-px before:bg-hairline before:content-['']",
        daySep:
          "px-s-6 pl-[110px] pt-s-5 pb-s-2 text-ink-dim after:bg-hairline",
      },
    },
  },
  defaultVariants: { density: "compact" },
});

/**
 * EventStream — the vertical event rail. A single hairline spine runs
 * down the center, each row hosts a colored lane dot. `selectedId`
 * marks the single hot row; nothing else glows.
 *
 * When `onSelect` is provided, each row is wrapped in a native button.
 */
export function EventStream({
  items,
  selectedId,
  onSelect,
  daySeparator,
  density = "compact",
  className,
  ...props
}: EventStreamProps) {
  const slots = streamStyles({ density });
  return (
    <div
      className={`${slots.root()}${className ? ` ${className}` : ""}`}
      {...props}
    >
      {daySeparator ? (
        <div className={slots.daySep()}>{daySeparator}</div>
      ) : null}
      {items.map((it) => {
        const { id, ...rowProps } = it;
        const row = (
          <EventRow
            {...rowProps}
            density={density}
            selected={selectedId === id}
            role={onSelect ? "button" : undefined}
            aria-pressed={onSelect ? selectedId === id : undefined}
            tabIndex={onSelect ? 0 : undefined}
          />
        );
        if (!onSelect) return <React.Fragment key={id}>{row}</React.Fragment>;
        return (
          <button
            key={id}
            type="button"
            className="block w-full text-left"
            onClick={() => onSelect(id)}
          >
            {row}
          </button>
        );
      })}
    </div>
  );
}
