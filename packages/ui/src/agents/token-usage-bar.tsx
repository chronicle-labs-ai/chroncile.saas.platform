"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import { formatNumber } from "../connections/time";
import type { AgentRunUsage } from "./types";

/*
 * TokenUsageBar — stacked bar showing how a run's usage breaks down
 * into input / cached / reasoning / output tokens.
 *
 * Source: `RunRecord.response.usage` in the agent-versioning wrapper.
 * Cached input is rendered as a faint slice over the input segment so
 * the customer can tell prompt-cache hits at a glance.
 *
 *   [████████|██|███|██████]
 *    input     cache reason output
 *
 * Two layouts:
 *
 *   variant="compact"  — single-line bar (used in run rows)
 *   variant="detailed" — bar + four-cell legend (used in run drawer)
 */

export interface TokenUsageBarProps {
  usage?: AgentRunUsage;
  variant?: "compact" | "detailed";
  className?: string;
}

export function TokenUsageBar({
  usage,
  variant = "compact",
  className,
}: TokenUsageBarProps) {
  const input = usage?.inputTokens ?? 0;
  const cached = Math.min(usage?.cachedInputTokens ?? 0, input);
  const reasoning = usage?.reasoningTokens ?? 0;
  const output = usage?.outputTokens ?? 0;
  const total = input + reasoning + output;

  if (total === 0) {
    return (
      <span
        className={cx(
          "inline-flex items-center gap-1 font-mono text-[10.5px] tabular-nums text-l-ink-dim",
          className,
        )}
      >
        — tokens
      </span>
    );
  }

  const pct = (n: number) => `${(n / total) * 100}%`;
  const summary =
    `${formatNumber(total)} tokens — ` +
    `${formatNumber(input)} input` +
    (cached > 0 ? ` (${formatNumber(cached)} cached)` : "") +
    (reasoning > 0 ? `, ${formatNumber(reasoning)} reasoning` : "") +
    `, ${formatNumber(output)} output`;

  // Width-based segments are read-only / static here, not animated frame-by-
  // frame, so layout reflow isn't a concern. Accessibility is exposed via the
  // outer progressbar role + a single descriptive aria-label.
  const bar = (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={total}
      aria-label={summary}
      className="flex h-1.5 w-full overflow-hidden rounded-pill bg-l-surface-input"
    >
      <div
        aria-hidden
        className="relative bg-event-teal/70"
        style={{ width: pct(input) }}
      >
        {cached > 0 ? (
          <div
            className="absolute inset-y-0 left-0 bg-event-teal/35"
            style={{ width: pct(cached) }}
          />
        ) : null}
      </div>
      {reasoning > 0 ? (
        <div
          aria-hidden
          className="bg-event-violet/70"
          style={{ width: pct(reasoning) }}
        />
      ) : null}
      <div
        aria-hidden
        className="bg-event-amber/70"
        style={{ width: pct(output) }}
      />
    </div>
  );

  if (variant === "compact") {
    return (
      <div
        className={cx(
          "flex min-w-[120px] items-center gap-2 font-mono text-[10.5px] text-l-ink-dim",
          className,
        )}
      >
        <div className="flex-1">{bar}</div>
        <span className="shrink-0 tabular-nums text-l-ink-lo">
          {formatNumber(total)}
        </span>
      </div>
    );
  }

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {bar}
      <dl className="grid grid-cols-4 gap-2 text-[10.5px]">
        <Cell
          label="Input"
          value={input}
          colorClass="bg-event-teal/70"
          subValue={cached > 0 ? `${formatNumber(cached)} cached` : undefined}
        />
        <Cell
          label="Reasoning"
          value={reasoning}
          colorClass="bg-event-violet/70"
        />
        <Cell label="Output" value={output} colorClass="bg-event-amber/70" />
        <Cell
          label="Total"
          value={total}
          colorClass="bg-l-ink-dim"
          emphasized
        />
      </dl>
    </div>
  );
}

interface CellProps {
  label: string;
  value: number;
  colorClass: string;
  subValue?: string;
  emphasized?: boolean;
}

function Cell({ label, value, colorClass, subValue, emphasized }: CellProps) {
  return (
    <div className="flex flex-col gap-[1px]">
      <dt className="flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.06em] text-l-ink-dim">
        <span aria-hidden className={cx("size-1.5 rounded-pill", colorClass)} />
        {label}
      </dt>
      <dd
        className={cx(
          "font-mono text-[12px] tabular-nums",
          emphasized ? "font-medium text-l-ink" : "text-l-ink-lo",
        )}
      >
        {formatNumber(value)}
      </dd>
      {subValue ? (
        <span className="font-mono text-[9.5px] tabular-nums text-l-ink-dim">
          {subValue}
        </span>
      ) : null}
    </div>
  );
}
