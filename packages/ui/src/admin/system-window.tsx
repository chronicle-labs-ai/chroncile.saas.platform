"use client";

import * as React from "react";
import { cx } from "../utils/cx";

/*
 * SystemWindow — terminal-styled chrome used by every operator-facing
 * admin/log surface across the auth flow:
 *
 *   • E.1 importer log — backend/bin/workos-import progress
 *   • F.1 webhook payload — directory.user.created event inspector
 *   • F.2 admin user detail — admin · users · <email> row dump
 *   • F.4 deletion event — directory.user.deleted + SQL UPDATE
 *
 * The chrome is a rounded-md container with three traffic-light dots
 * on the left, the title centered (mono, small, dim), and a body with
 * `bg-surface-00` and `font-mono`. Sub-components let consumers
 * compose typical "system" content:
 *
 *   <SystemWindow title="…">
 *     <SysRow label="EMAIL" value="ada@acme.com" />
 *     <SysPre>{json}</SysPre>
 *     <SysOk>200 OK</SysOk>
 *   </SystemWindow>
 *
 * Lives in the admin module (not auth) because these surfaces also
 * power future operator UIs — directory inspector, audit log viewer,
 * webhook tail, etc.
 */

export interface SystemWindowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Titlebar text — usually a route or shell command, mono. */
  title?: React.ReactNode;
  /** Body content. Pass `Sys*` sub-components for the typical row/log
   *  layouts, or any node for a free-form body. */
  children: React.ReactNode;
  /** Show the macOS-style traffic-light dots in the title bar. Default true. */
  showDots?: boolean;
  /** Optional right-hand side note in the title bar (e.g. "/ live"). */
  note?: React.ReactNode;
}

export function SystemWindow({
  title,
  children,
  showDots = true,
  note,
  className,
  ...rest
}: SystemWindowProps) {
  return (
    <div
      data-slot="system-window"
      className={cx(
        "flex w-full flex-col overflow-hidden rounded-md",
        "border border-hairline-strong bg-surface-00",
        "shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)]",
        className,
      )}
      {...rest}
    >
      {/* Title bar */}
      <div
        className={cx(
          "flex items-center gap-s-3 border-b border-hairline px-s-3 py-s-2",
          "bg-surface-01",
        )}
      >
        {showDots ? (
          <span aria-hidden className="flex shrink-0 items-center gap-[6px]">
            <span className="inline-block h-[10px] w-[10px] rounded-pill bg-event-red/80" />
            <span className="inline-block h-[10px] w-[10px] rounded-pill bg-event-amber/80" />
            <span className="inline-block h-[10px] w-[10px] rounded-pill bg-event-green/80" />
          </span>
        ) : null}
        <span className="flex-1 truncate text-center font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
          {title}
        </span>
        {note ? (
          <span className="shrink-0 font-mono text-mono-sm text-ink-dim">
            {note}
          </span>
        ) : (
          // keep the title centered when there's no note + dots are
          // shown by reserving symmetric space.
          showDots ? (
            <span aria-hidden className="inline-block w-[42px] shrink-0" />
          ) : null
        )}
      </div>

      {/* Body */}
      <div
        className={cx(
          "flex flex-col gap-s-2 px-s-4 py-s-3",
          "font-mono text-mono text-ink",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/* ── SysRow — `label : value` line ─────────────────────────── */

export interface SysRowProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Override the row's tone — typically used for the "createdVia" callout. */
  tone?: "default" | "highlight" | "muted";
}

export function SysRow({ label, value, tone = "default" }: SysRowProps) {
  return (
    <div className="flex items-baseline gap-s-3">
      <span className="shrink-0 min-w-[88px] uppercase tracking-tactical text-ink-dim">
        {label}
      </span>
      <span
        className={cx(
          "flex-1 break-all",
          tone === "highlight" && "text-ember",
          tone === "muted" && "text-ink-dim",
          tone === "default" && "text-ink-hi",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* ── SysPre — pretty-printed JSON / log block ──────────────── */

export interface SysPreProps extends React.HTMLAttributes<HTMLPreElement> {
  /** Prefix shown above the block (e.g. "BODY", "EVENT"). */
  label?: React.ReactNode;
}

export function SysPre({
  label,
  className,
  children,
  ...rest
}: SysPreProps) {
  return (
    <div className="flex flex-col gap-s-1">
      {label ? (
        <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
          {label}
        </span>
      ) : null}
      <pre
        className={cx(
          "max-h-[340px] overflow-auto rounded-sm border border-hairline",
          "bg-surface-00 px-s-3 py-s-2",
          "font-mono text-[12px] leading-[1.55] text-ink",
          "whitespace-pre-wrap break-words",
          className,
        )}
        {...rest}
      >
        {children}
      </pre>
    </div>
  );
}

/* ── SysOk / SysWarn / SysErr — inline status chips ────────── */

const STATUS_CHIP =
  "inline-flex items-center gap-[6px] rounded-xs px-s-2 py-[2px] " +
  "font-mono text-mono-sm uppercase tracking-tactical leading-none border";

export function SysOk({
  className,
  children = "OK",
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cx(
        STATUS_CHIP,
        "border-event-green/40 bg-event-green/[0.10] text-event-green",
        className,
      )}
      {...rest}
    >
      <span aria-hidden className="inline-block h-[6px] w-[6px] rounded-pill bg-event-green" />
      {children}
    </span>
  );
}

export function SysWarn({
  className,
  children = "WARN",
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cx(
        STATUS_CHIP,
        "border-event-amber/40 bg-event-amber/[0.10] text-event-amber",
        className,
      )}
      {...rest}
    >
      <span aria-hidden className="inline-block h-[6px] w-[6px] rounded-pill bg-event-amber" />
      {children}
    </span>
  );
}

export function SysErr({
  className,
  children = "ERR",
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cx(
        STATUS_CHIP,
        "border-event-red/40 bg-event-red/[0.10] text-event-red",
        className,
      )}
      {...rest}
    >
      <span aria-hidden className="inline-block h-[6px] w-[6px] rounded-pill bg-event-red" />
      {children}
    </span>
  );
}
