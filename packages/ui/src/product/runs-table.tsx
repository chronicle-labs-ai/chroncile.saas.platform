import * as React from "react";
import { tv, type VariantProps } from "../utils/tv";

/**
 * RunsTable — shells for the replay-suite results table. This is a
 * styled `<table>` + supporting cell components so consumers can still
 * control semantics and accessibility. The styling matches page 07.
 *
 * For a keyboard-navigable, row-selectable, sortable table, prefer the
 * `Table` primitive (wraps RAC's table collection). This one is purely
 * presentational for handoff-matched layouts.
 */

const runsTable = tv({
  slots: {
    table: "w-full border-collapse font-mono",
    row: "border-b border-hairline hover:bg-white/[0.02] last:border-b-0",
    th:
      "border-b border-hairline px-s-6 py-s-3 text-left " +
      "font-mono text-mono-sm uppercase tracking-tactical font-normal text-ink-dim",
    td: "px-s-6 py-s-4 font-mono text-[12px] text-ink-lo",
  },
});

export type RunsTableProps = React.TableHTMLAttributes<HTMLTableElement>;

export function RunsTable({ className, children, ...props }: RunsTableProps) {
  const slots = runsTable({});
  return (
    <table className={slots.table({ className })} {...props}>
      {children}
    </table>
  );
}

export function RunsTableHead(
  props: React.HTMLAttributes<HTMLTableSectionElement>
) {
  return <thead {...props} />;
}

export function RunsTableRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  const slots = runsTable({});
  return <tr className={slots.row({ className })} {...props} />;
}

export function RunsTableHeader({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  const slots = runsTable({});
  return <th className={slots.th({ className })} {...props} />;
}

export function RunsTableCell({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  const slots = runsTable({});
  return <td className={slots.td({ className })} {...props} />;
}

export interface RunNameProps {
  name: React.ReactNode;
  sub?: React.ReactNode;
}

export function RunName({ name, sub }: RunNameProps) {
  return (
    <div>
      <span className="font-sans text-[13px] font-normal text-ink-hi">
        {name}
      </span>
      {sub ? (
        <span className="mt-[3px] block font-mono text-mono-sm tracking-mono text-ink-dim">
          {sub}
        </span>
      ) : null}
    </div>
  );
}

export type VerdictKind = "pass" | "fail" | "partial" | "pending";

const verdict = tv({
  base:
    "inline-block rounded-xs px-[9px] py-[4px] " +
    "font-mono text-mono-sm uppercase tracking-tactical",
  variants: {
    kind: {
      pass: "bg-[rgba(74,222,128,0.1)] text-event-green",
      fail: "bg-[rgba(239,68,68,0.1)] text-event-red",
      partial: "bg-[rgba(251,191,36,0.1)] text-event-amber",
      pending: "bg-white/[0.04] text-ink-dim",
    },
  },
});

type VerdictVariantProps = VariantProps<typeof verdict>;

const verdictGlyph: Record<VerdictKind, string> = {
  pass: "✓",
  fail: "●",
  partial: "◐",
  pending: "○",
};

const verdictLabel: Record<VerdictKind, string> = {
  pass: "Pass",
  fail: "Fail",
  partial: "Partial",
  pending: "Pending",
};

export interface VerdictProps extends VerdictVariantProps {
  kind: VerdictKind;
  label?: React.ReactNode;
}

export function Verdict({ kind, label }: VerdictProps) {
  return (
    <span className={verdict({ kind })}>
      {verdictGlyph[kind]} {label ?? verdictLabel[kind]}
    </span>
  );
}

const simBar = tv({
  slots: {
    track:
      "mr-s-2 inline-block h-[6px] w-[100px] overflow-hidden rounded-[3px] " +
      "bg-white/[0.06] align-middle",
    fill: "block h-full",
  },
  variants: {
    tone: {
      hi: { fill: "bg-event-green" },
      md: { fill: "bg-event-amber" },
      lo: { fill: "bg-event-red" },
    },
  },
  defaultVariants: { tone: "hi" },
});

type SimBarVariantProps = VariantProps<typeof simBar>;

export interface SimBarProps extends SimBarVariantProps {
  /** 0–100. */
  value: number;
  tone?: "hi" | "md" | "lo";
}

export function SimBar({ value, tone = "hi" }: SimBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const slots = simBar({ tone });
  return (
    <span className={slots.track()}>
      <span className={slots.fill()} style={{ width: `${clamped}%` }} />
    </span>
  );
}
