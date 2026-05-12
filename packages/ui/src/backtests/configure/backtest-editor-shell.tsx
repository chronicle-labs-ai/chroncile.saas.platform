/*
 * BacktestEditorShell — shared chrome for the three inline editors
 * (agents, data, graders). Linear-density title row: small display
 * h3 + 12.5 px sans body, hairline divider, "Done" affordance with
 * lucide × glyph.
 */

"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cx } from "../../utils/cx";
import { Eyebrow } from "../../primitives/eyebrow";

export interface BacktestEditorShellProps {
  title: string;
  sub?: string;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function BacktestEditorShell({
  title,
  sub,
  onClose,
  children,
  className,
}: BacktestEditorShellProps) {
  return (
    <div className={cx("flex flex-col gap-3", className)}>
      <header className="flex items-start justify-between gap-3 border-b border-divider pb-2.5">
        <div className="flex flex-col gap-0.5">
          <Eyebrow className="text-ink-dim">EDITING</Eyebrow>
          <h3 className="font-display text-[15px] leading-none tracking-[-0.02em] text-ink-hi">
            {title}
          </h3>
          {sub ? <p className="max-w-2xl text-[12.5px] text-ink-lo">{sub}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 rounded-[2px] border border-divider px-2 py-1 text-[12.5px] text-ink-lo transition-colors hover:border-hairline-strong hover:text-ink-hi"
        >
          Done <X className="size-3" strokeWidth={1.6} />
        </button>
      </header>
      {children}
    </div>
  );
}
