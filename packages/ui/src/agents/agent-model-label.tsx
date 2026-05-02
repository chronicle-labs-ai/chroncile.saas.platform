"use client";

import * as React from "react";

import { cx } from "../utils/cx";

import { AgentCompanyMark } from "./agent-company-mark";
import { getModelProviderMeta } from "./framework-meta";
import type { AgentModelDescriptor } from "./types";

/*
 * AgentModelLabel — shows a model descriptor as a logo-prefixed mono
 * line:
 *
 *   ◢ openai / gpt-4.1-mini
 *   △ anthropic / claude-3-5-sonnet
 *   ⚫ vercel / gpt-4o
 *
 * The leading mark is the real company logo via `<CompanyLogo>`
 * (logo.dev). When the provider isn't in our prefix table, the
 * component falls back to rendering just the label without a logo —
 * never blocks the row.
 *
 * Three sizes mirror the rest of the agents module:
 *
 *   "xs" — 10.5px font, 12px logo  (table rows)
 *   "sm" — 11px font,   14px logo  (cards, version rows)
 *   "md" — 12px font,   16px logo  (detail header, metrics strip)
 */

export interface AgentModelLabelProps {
  model: AgentModelDescriptor;
  size?: "xs" | "sm" | "md";
  /** Render the resolved-from-runs id under the label as a faint sub-line. */
  resolvedModelId?: string;
  /** When true, render only the provider mark + label (no `/modelId`). */
  hideModelId?: boolean;
  className?: string;
}

const FONT_SIZE: Record<NonNullable<AgentModelLabelProps["size"]>, string> = {
  xs: "text-[10.5px]",
  sm: "text-[11px]",
  md: "text-[12px]",
};

const MARK_SIZE: Record<
  NonNullable<AgentModelLabelProps["size"]>,
  "xs" | "sm" | "md"
> = {
  xs: "xs",
  sm: "xs",
  md: "sm",
};

export function AgentModelLabel({
  model,
  size = "sm",
  resolvedModelId,
  hideModelId,
  className,
}: AgentModelLabelProps) {
  const meta = getModelProviderMeta(model.provider);
  const providerLabel = meta?.label ?? model.provider ?? "";
  const modelId = model.modelId ?? "";

  return (
    <span
      data-provider={model.provider ?? "unknown"}
      className={cx(
        "inline-flex min-w-0 items-center gap-1.5 font-mono",
        FONT_SIZE[size],
        "text-l-ink-lo",
        className,
      )}
    >
      {meta ? (
        <AgentCompanyMark
          name={meta.companyName}
          domain={meta.companyDomain}
          size={MARK_SIZE[size]}
          alt={`${meta.label} logo`}
        />
      ) : null}
      <span className="flex min-w-0 items-baseline gap-1">
        {providerLabel ? (
          <span className="text-l-ink-lo">{providerLabel}</span>
        ) : null}
        {hideModelId ? null : modelId ? (
          <>
            {providerLabel ? <span className="text-l-ink-dim">/</span> : null}
            <span className="truncate text-l-ink">{modelId}</span>
          </>
        ) : null}
        {resolvedModelId && resolvedModelId !== modelId ? (
          <span
            className="truncate text-l-ink-dim"
            title={`resolves to ${resolvedModelId}`}
          >
            → {resolvedModelId}
          </span>
        ) : null}
      </span>
    </span>
  );
}
