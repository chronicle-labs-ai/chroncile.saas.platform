"use client";

import * as React from "react";

import { NumberField } from "../../../primitives/number-field";
import type { FilterOperator } from "../types";

export interface NumberEditorProps {
  operator: FilterOperator;
  value: unknown;
  onChange: (next: unknown) => void;
  /**
   * Accepted for API symmetry with the other editors. NumberField commits
   * on blur/Enter via `onChange` before any keydown handler could fire, so
   * Enter-to-submit is intentionally delegated to the parent's Apply button
   * to avoid reading stale state.
   */
  onSubmit?: () => void;
}

function normalize(n: number | undefined): number | undefined {
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

export function NumberEditor({ operator, value, onChange }: NumberEditorProps) {
  if (operator === "between") {
    const [lo, hi] = Array.isArray(value)
      ? (value as [unknown, unknown])
      : [undefined, undefined];
    return (
      <div className="flex w-full flex-col gap-s-2 p-s-2">
        <label className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
          Min
        </label>
        <NumberField
          value={typeof lo === "number" ? lo : undefined}
          onChange={(next) => onChange([normalize(next), hi])}
          placeholder="\u2212\u221E"
        />
        <label className="mt-s-2 font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
          Max
        </label>
        <NumberField
          value={typeof hi === "number" ? hi : undefined}
          onChange={(next) => onChange([lo, normalize(next)])}
          placeholder="\u221E"
        />
      </div>
    );
  }

  const current = typeof value === "number" ? value : undefined;
  return (
    <div className="w-full p-s-2">
      <NumberField
        value={current}
        onChange={(next) => onChange(normalize(next))}
        placeholder="Enter number\u2026"
      />
    </div>
  );
}
