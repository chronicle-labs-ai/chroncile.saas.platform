"use client";

/*
 * Pagination — a numeric page selector with prev/next affordances.
 * Uncontrolled by default (internal state from `defaultPage`); becomes
 * controlled by passing `page` + `onPageChange`.
 *
 * Uses native buttons so it can be embedded in any app shell.
 */

import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "../utils/cn";

export const paginationVariants = cva("inline-flex items-center gap-[2px]");

export const paginationButtonVariants = cva(
  "inline-flex items-center justify-center border outline-none transition-colors duration-fast ease-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember disabled:opacity-40 disabled:cursor-not-allowed h-[26px] min-w-[26px] rounded-md border-hairline-strong bg-l-surface-raised px-[8px] font-sans text-[12px] font-medium text-l-ink-lo hover:bg-l-surface-hover hover:text-l-ink",
  {
    variants: {
      current: {
        true: "border-ember bg-[rgba(216,67,10,0.08)] text-ember hover:bg-[rgba(216,67,10,0.12)]",
      },
    },
  }
);

export const paginationEllipsisVariants = cva(
  "px-[6px] font-sans text-[12px] text-l-ink-dim"
);

export interface PaginationProps {
  page?: number;
  defaultPage?: number;
  totalPages: number;
  /** Number of pages to show on each side of the current one. */
  siblings?: number;
  onPageChange?: (page: number) => void;
  className?: string;
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
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isCurrent?: boolean;
}) => {
  return (
    <button
      type="button"
      {...rest}
      className={cn(paginationButtonVariants({ current: isCurrent }), className)}
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
  labels,
}: PaginationProps) {
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
      className={paginationVariants({ className })}
    >
      <PageButton
        onClick={() => set(current - 1)}
        disabled={current === 1}
        aria-label={labels?.previous ?? "Previous page"}
      >
        ‹
      </PageButton>
      {items.map((it, idx) =>
        it === "…" ? (
          <span
            key={`gap-${idx}`}
            className={paginationEllipsisVariants()}
            aria-hidden
          >
            …
          </span>
        ) : (
          <PageButton
            key={it}
            onClick={() => set(it)}
            isCurrent={it === current}
            aria-current={it === current ? "page" : undefined}
            aria-label={labels?.page ? labels.page(it) : `Page ${it}`}
          >
            {it}
          </PageButton>
        )
      )}
      <PageButton
        onClick={() => set(current + 1)}
        disabled={current === totalPages}
        aria-label={labels?.next ?? "Next page"}
      >
        ›
      </PageButton>
    </nav>
  );
}
