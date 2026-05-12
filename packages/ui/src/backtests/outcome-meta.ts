/*
 * Backtests · Outcome meta — map an outcome string to a tag
 * variant + display label. Used by the divergence rows on Running
 * and Results.
 */

import type { TagVariant } from "../primitives/tag";
import type { BacktestOutcome } from "./types";

interface OutcomeMeta {
  variant: TagVariant;
  label: string;
}

const META: Record<BacktestOutcome, OutcomeMeta> = {
  resolved:  { variant: "green",  label: "resolved" },
  escalated: { variant: "amber",  label: "escalated" },
  failed:    { variant: "red",    label: "failed" },
  partial:   { variant: "orange", label: "partial" },
  merged:    { variant: "teal",   label: "merged" },
  pr_opened: { variant: "violet", label: "pr opened" },
};

export function outcomeTagVariant(outcome: BacktestOutcome): TagVariant {
  return META[outcome].variant;
}

export function outcomeLabel(outcome: BacktestOutcome): string {
  return META[outcome].label;
}
