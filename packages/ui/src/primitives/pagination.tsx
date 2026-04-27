"use client";

/*
 * Pagination — a numeric page selector with prev/next affordances.
 * Uncontrolled by default (internal state from `defaultPage`); become
 * controlled by passing `page` + `onPageChange`.
 *
 * No RAC primitive exists for paginated lists, so we hand-roll over RAC
 * Buttons to keep keyboard/hover/focus states consistent with the rest.
 */

import * as React from "react";
import {
  Button as RACButton,
  type ButtonProps as RACButtonProps,
} from "react-aria-components";

import { tv } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

const paginationStyles = tv({
  slots: {
    root: "inline-flex items-center",
    button:
      "inline-flex items-center justify-center border outline-none " +
      "transition-colors duration-fast ease-out " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:outline-ember " +
      "data-[disabled=true]:opacity-40 data-[disabled=true]:cursor-not-allowed",
    current:
      "border-ember bg-[rgba(216,67,10,0.08)] text-ember " +
      "data-[hovered=true]:bg-[rgba(216,67,10,0.12)]",
    ellipsis: "",
  },
  variants: {
    density: {
      brand: {
        root: "gap-s-1",
        button:
          "h-[32px] min-w-[32px] rounded-xs border-hairline-strong bg-surface-01 px-s-2 " +
          "font-mono text-mono-sm text-ink-lo " +
          "data-[hovered=true]:bg-surface-02 data-[hovered=true]:text-ink-hi",
        ellipsis: "px-s-1 font-mono text-mono-sm text-ink-dim",
      },
      compact: {
        root: "gap-[2px]",
        button:
          "h-[26px] min-w-[26px] rounded-l border-l-border bg-l-surface-raised px-[8px] " +
          "font-sans text-[12px] font-medium text-l-ink-lo " +
          "data-[hovered=true]:bg-l-surface-hover data-[hovered=true]:text-l-ink",
        ellipsis: "px-[6px] font-sans text-[12px] text-l-ink-dim",
      },
    },
  },
  defaultVariants: { density: "brand" },
});

export interface PaginationProps {
  page?: number;
  defaultPage?: number;
  totalPages: number;
  /** Number of pages to show on each side of the current one. */
  siblings?: number;
  onPageChange?: (page: number) => void;
  className?: string;
  density?: "compact" | "brand";
  labels?: {
    previous?: string;
    next?: string;
    page?: (p: number) => string;
  };
}

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function buildItems(
  current: number,
  total: number,
  siblings: number
): (number | "…")[] {
  const first = 1;
  const last = total;
  const leftBound = Math.max(current - siblings, first);
  const rightBound = Math.min(current + siblings, last);

  const items: (number | "…")[] = [];

  if (leftBound > first + 1) {
    items.push(first, "…");
  } else {
    items.push(...range(first, Math.min(leftBound - 1, last)));
  }

  items.push(...range(leftBound, rightBound));

  if (rightBound < last - 1) {
    items.push("…", last);
  } else if (rightBound < last) {
    items.push(...range(rightBound + 1, last));
  }

  return items;
}

const PageButton = ({
  isCurrent,
  density,
  className,
  ...rest
}: RACButtonProps & { isCurrent?: boolean; density: "compact" | "brand" }) => {
  const slots = paginationStyles({ density });
  return (
    <RACButton
      {...rest}
      className={composeTwRenderProps(
        typeof className === "string" ? className : undefined,
        `${slots.button()}${isCurrent ? ` ${slots.current()}` : ""}`
      )}
    />
  );
};

export function Pagination({
  page,
  defaultPage = 1,
  totalPages,
  siblings = 1,
  onPageChange,
  className,
  density: densityProp,
  labels,
}: PaginationProps) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = paginationStyles({ density });
  const [internal, setInternal] = React.useState(defaultPage);
  const current = page ?? internal;
  const set = (p: number) => {
    const clamped = Math.max(1, Math.min(totalPages, p));
    if (page === undefined) setInternal(clamped);
    onPageChange?.(clamped);
  };

  const items = buildItems(current, totalPages, siblings);

  return (
    <nav
      aria-label="Pagination"
      className={`${slots.root()}${className ? ` ${className}` : ""}`}
    >
      <PageButton
        density={density}
        onPress={() => set(current - 1)}
        isDisabled={current === 1}
        aria-label={labels?.previous ?? "Previous page"}
      >
        ‹
      </PageButton>
      {items.map((it, idx) =>
        it === "…" ? (
          <span key={`gap-${idx}`} className={slots.ellipsis()} aria-hidden>
            …
          </span>
        ) : (
          <PageButton
            density={density}
            key={it}
            onPress={() => set(it)}
            isCurrent={it === current}
            aria-current={it === current ? "page" : undefined}
            aria-label={labels?.page ? labels.page(it) : `Page ${it}`}
          >
            {it}
          </PageButton>
        )
      )}
      <PageButton
        density={density}
        onPress={() => set(current + 1)}
        isDisabled={current === totalPages}
        aria-label={labels?.next ?? "Next page"}
      >
        ›
      </PageButton>
    </nav>
  );
}
