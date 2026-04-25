import * as React from "react";
import { cx } from "../utils/cx";

/**
 * Status — Linear's small status circle.
 *
 *   backlog    — dashed outline circle
 *   todo       — solid outline circle
 *   inprogress — half-filled (180° conic) amber circle
 *   done       — filled sage circle with check
 *   canceled   — filled grey circle
 *
 * Used inline next to issue / trace IDs and inside dropdown rows. Pairs
 * with `<Priority>` and the Linear-density row primitives.
 */
export type StatusKind =
  | "backlog"
  | "todo"
  | "inprogress"
  | "done"
  | "canceled";

export interface StatusProps extends React.HTMLAttributes<HTMLSpanElement> {
  kind: StatusKind;
  /** Pixel size. Defaults to 14. */
  size?: number;
  ariaLabel?: string;
}

export function Status({
  kind,
  size = 14,
  ariaLabel,
  className,
  style,
  ...props
}: StatusProps) {
  const ringColor = ringColorFor(kind);
  const fill = fillFor(kind);
  const dashed = kind === "backlog";

  return (
    <span
      role="img"
      aria-label={ariaLabel ?? `status: ${kind}`}
      data-kind={kind}
      className={cx("relative inline-flex shrink-0 rounded-pill", className)}
      style={{
        width: size,
        height: size,
        border: `1.5px ${dashed ? "dashed" : "solid"} ${ringColor}`,
        background: fill,
        ...style,
      }}
      {...props}
    >
      {kind === "inprogress" ? (
        <span
          aria-hidden
          className="absolute inset-0 rounded-pill"
          style={{
            background:
              "conic-gradient(var(--l-status-inprogress) 0deg 180deg, transparent 180deg 360deg)",
          }}
        />
      ) : null}
      {kind === "done" ? (
        <svg
          aria-hidden
          viewBox="0 0 14 14"
          width={size}
          height={size}
          fill="none"
          stroke="var(--l-surface-bar-2)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute inset-0"
        >
          <path d="M3.5 7.2l2.3 2.3 5-5" />
        </svg>
      ) : null}
    </span>
  );
}

function ringColorFor(kind: StatusKind): string {
  switch (kind) {
    case "backlog":
      return "var(--l-status-backlog)";
    case "todo":
      return "var(--l-status-todo)";
    case "inprogress":
      return "var(--l-status-inprogress)";
    case "done":
      return "var(--l-status-done)";
    case "canceled":
      return "var(--l-status-canceled)";
  }
}

function fillFor(kind: StatusKind): string {
  if (kind === "done") return "var(--l-status-done)";
  if (kind === "canceled") return "var(--l-status-canceled)";
  return "transparent";
}
