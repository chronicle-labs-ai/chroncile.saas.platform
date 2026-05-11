"use client";

import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";

import { cx } from "../utils/cx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../primitives/popover";
import { Status } from "../primitives/status";

import type { DatasetCluster, DatasetSplit, TraceStatus } from "./types";

/*
 * Reusable inline editors for the three pieces of trace metadata an
 * agent builder mutates constantly while triaging a dataset:
 *
 *   - cluster      → ClusterPicker
 *   - split        → SplitPicker
 *   - status       → StatusPicker
 *
 * Every picker is a `<Popover>`-backed chip that swaps to a list of
 * options on click. Same shape, same animation, same Esc-closes
 * semantics; the only thing that differs is the option set and the
 * resolved label/dot.
 *
 * Designed to drop into rows AND the batch-actions strip — that's
 * why the value can be a single trace's value or `"mixed"` (when
 * multiple selected traces disagree). The `mixed` state is
 * intentionally shown as `—` so the chip never lies about the
 * underlying state.
 */

const STATUS_OPTIONS: Array<{
  value: TraceStatus;
  label: string;
  kind: React.ComponentProps<typeof Status>["kind"];
  ring: string;
}> = [
  { value: "ok", label: "OK", kind: "done", ring: "ring-l-status-done/30" },
  {
    value: "warn",
    label: "Warn",
    kind: "inprogress",
    ring: "ring-l-status-inprogress/40",
  },
  { value: "error", label: "Error", kind: "todo", ring: "ring-l-p-urgent/40" },
];

const SPLIT_OPTIONS: Array<{ value: DatasetSplit; label: string; dot: string }> = [
  { value: "train", label: "Train", dot: "bg-event-violet" },
  { value: "validation", label: "Validation", dot: "bg-event-teal" },
  { value: "test", label: "Test", dot: "bg-event-amber" },
];

/* ── ClusterPicker ───────────────────────────────────────── */

export interface ClusterPickerProps {
  value: string | null | "mixed";
  clusters: readonly DatasetCluster[];
  onChange: (next: string | null) => void;
  /** Hide chrome — render as a borderless inline label. Useful in
   *  tight grid cells. */
  variant?: "chip" | "ghost";
  disabled?: boolean;
  className?: string;
}

export function ClusterPicker({
  value,
  clusters,
  onChange,
  variant = "ghost",
  disabled,
  className,
}: ClusterPickerProps) {
  const cluster = React.useMemo<DatasetCluster | null>(() => {
    if (value === "mixed" || value == null) return null;
    return clusters.find((c) => c.id === value) ?? null;
  }, [value, clusters]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <ChipTrigger
          aria-label={cluster ? `Cluster: ${cluster.label}` : "No cluster"}
          variant={variant}
          disabled={disabled}
          className={className}
        >
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-pill"
            style={
              cluster ? { background: cluster.color } : { background: "var(--l-ink-dim)" }
            }
          />
          <span className="truncate">
            {value === "mixed" ? (
              <MixedLabel />
            ) : cluster ? (
              cluster.label
            ) : (
              <Unset>Unclustered</Unset>
            )}
          </span>
        </ChipTrigger>
      </PopoverTrigger>
      <PopoverContent
        placement="bottom start"
        className="w-[260px] max-h-[320px] overflow-auto p-1"
      >
        <PickerList
          options={[
            ...clusters.map((c) => ({
              value: c.id,
              label: c.label,
              dot: c.color,
              isSelected: cluster?.id === c.id,
            })),
            {
              value: "__none__",
              label: "Unclustered",
              isSelected: value === null,
              dot: "var(--l-ink-dim)",
              divider: true,
            },
          ]}
          onSelect={(v) => onChange(v === "__none__" ? null : (v as string))}
        />
      </PopoverContent>
    </Popover>
  );
}

/* ── SplitPicker ─────────────────────────────────────────── */

export interface SplitPickerProps {
  value: DatasetSplit | null | "mixed";
  onChange: (next: DatasetSplit | null) => void;
  variant?: "chip" | "ghost";
  disabled?: boolean;
  className?: string;
}

export function SplitPicker({
  value,
  onChange,
  variant = "chip",
  disabled,
  className,
}: SplitPickerProps) {
  const meta =
    value === "mixed" || value == null
      ? null
      : SPLIT_OPTIONS.find((s) => s.value === value) ?? null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <ChipTrigger
          aria-label={meta ? `Split: ${meta.label}` : "No split assigned"}
          variant={variant}
          disabled={disabled}
          className={className}
        >
          <span
            aria-hidden
            className={cx(
              "size-1.5 shrink-0 rounded-pill",
              meta?.dot ?? "bg-l-ink-dim",
            )}
          />
          <span className="truncate">
            {value === "mixed" ? (
              <MixedLabel />
            ) : meta ? (
              meta.label
            ) : (
              <Unset>—</Unset>
            )}
          </span>
        </ChipTrigger>
      </PopoverTrigger>
      <PopoverContent
        placement="bottom start"
        className="w-[180px] p-1"
      >
        <PickerList
          options={[
            ...SPLIT_OPTIONS.map((s) => ({
              value: s.value,
              label: s.label,
              dotClass: s.dot,
              isSelected: value === s.value,
            })),
            {
              value: "__none__",
              label: "Unassigned",
              dotClass: "bg-l-ink-dim",
              isSelected: value === null,
              divider: true,
            },
          ]}
          onSelect={(v) =>
            onChange(v === "__none__" ? null : (v as DatasetSplit))
          }
        />
      </PopoverContent>
    </Popover>
  );
}

/* ── StatusPicker ────────────────────────────────────────── */

export interface StatusPickerProps {
  value: TraceStatus | "mixed";
  onChange: (next: TraceStatus) => void;
  /** Render as a tiny dot-only trigger (matches the Linear-density
   *  status indicator on the trace row). Defaults to `dot`. */
  variant?: "dot" | "chip";
  disabled?: boolean;
  className?: string;
}

export function StatusPicker({
  value,
  onChange,
  variant = "dot",
  disabled,
  className,
}: StatusPickerProps) {
  const meta =
    value === "mixed"
      ? null
      : STATUS_OPTIONS.find((s) => s.value === value) ?? null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        {variant === "dot" ? (
          <button
            type="button"
            disabled={disabled}
            aria-label={meta ? `Status: ${meta.label}` : "Mixed status"}
            className={cx(
              "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md",
              "text-l-ink-dim transition-colors duration-fast ease-out",
              "hover:bg-l-surface-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
              "disabled:cursor-not-allowed disabled:opacity-60",
              className,
            )}
          >
            {meta ? (
              <Status
                kind={meta.kind}
                size={12}
                className={cx("ring-1", meta.ring)}
                ariaLabel={meta.label}
              />
            ) : (
              <span className="size-2 rounded-pill bg-l-ink-dim" aria-hidden />
            )}
          </button>
        ) : (
          <ChipTrigger
            aria-label={meta ? `Status: ${meta.label}` : "Mixed status"}
            variant="chip"
            disabled={disabled}
            className={className}
          >
            {meta ? (
              <>
                <Status kind={meta.kind} size={10} className="shrink-0" ariaLabel={meta.label} />
                <span>{meta.label}</span>
              </>
            ) : (
              <>
                <span aria-hidden className="size-1.5 shrink-0 rounded-pill bg-l-ink-dim" />
                <MixedLabel />
              </>
            )}
          </ChipTrigger>
        )}
      </PopoverTrigger>
      <PopoverContent placement="bottom start" className="w-[160px] p-1">
        <PickerList
          options={STATUS_OPTIONS.map((s) => ({
            value: s.value,
            label: s.label,
            renderDot: (
              <Status
                kind={s.kind}
                size={10}
                className="shrink-0"
                ariaLabel={s.label}
              />
            ),
            isSelected: value === s.value,
          }))}
          onSelect={(v) => onChange(v as TraceStatus)}
        />
      </PopoverContent>
    </Popover>
  );
}

/* ── Shared bits ─────────────────────────────────────────── */

interface ChipTriggerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: "chip" | "ghost";
  children: React.ReactNode;
}

const ChipTrigger = React.forwardRef<HTMLButtonElement, ChipTriggerProps>(
  function ChipTrigger({ variant = "chip", className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        {...rest}
        onClick={(e) => {
          /* Stop trace-row clicks from firing — the chip should edit,
             not select-the-row. */
          e.stopPropagation();
          rest.onClick?.(e);
        }}
        className={cx(
          "group inline-flex max-w-full items-center gap-1.5 rounded-[3px]",
          "min-w-0 truncate text-left",
          "font-sans text-[12px] leading-tight text-l-ink",
          "transition-colors duration-fast ease-out",
          "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
          "disabled:cursor-not-allowed disabled:opacity-60",
          variant === "chip"
            ? "h-6 border border-l-border-faint bg-l-surface-input px-1.5 hover:border-hairline-strong hover:bg-l-surface-hover [@media(pointer:coarse)]:h-9"
            : "h-6 px-1 hover:bg-l-surface-hover [@media(pointer:coarse)]:h-9",
          className,
        )}
      >
        {children}
        <ChevronDown
          className="size-3 shrink-0 text-l-ink-dim opacity-0 transition-opacity group-hover:opacity-100 group-data-[state=open]:opacity-100"
          strokeWidth={1.6}
          aria-hidden
        />
      </button>
    );
  },
);

interface PickerOption {
  value: string;
  label: React.ReactNode;
  /** Tailwind class for a dot. */
  dotClass?: string;
  /** CSS-variable color (overrides dotClass). */
  dot?: string;
  /** Custom render for the leading visual (e.g. a `<Status>`). */
  renderDot?: React.ReactNode;
  isSelected?: boolean;
  /** Insert a divider above this option. */
  divider?: boolean;
}

function PickerList({
  options,
  onSelect,
}: {
  options: PickerOption[];
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5" role="listbox">
      {options.map((opt, idx) => (
        <React.Fragment key={opt.value}>
          {opt.divider && idx > 0 ? (
            <div className="my-0.5 h-px bg-hairline" aria-hidden />
          ) : null}
          <button
            type="button"
            role="option"
            aria-selected={opt.isSelected || undefined}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(opt.value);
            }}
            className={cx(
              "flex w-full items-center gap-2 rounded-[3px] px-1.5 py-1.5 text-left",
              "font-sans text-[12px] text-l-ink",
              "hover:bg-l-surface-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
              "[@media(pointer:coarse)]:py-2.5",
              opt.isSelected ? "bg-l-surface-selected" : null,
            )}
          >
            {opt.renderDot ? (
              opt.renderDot
            ) : (
              <span
                aria-hidden
                className={cx(
                  "size-1.5 shrink-0 rounded-pill",
                  opt.dotClass ?? "",
                )}
                style={opt.dot ? { background: opt.dot } : undefined}
              />
            )}
            <span className="truncate">{opt.label}</span>
            {opt.isSelected ? (
              <Check
                className="ml-auto size-3.5 shrink-0 text-ember"
                strokeWidth={1.75}
                aria-hidden
              />
            ) : null}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function MixedLabel() {
  return (
    <span className="font-mono text-[10.5px] tracking-[0.06em] text-l-ink-dim">
      Mixed
    </span>
  );
}

function Unset({ children }: { children: React.ReactNode }) {
  return <span className="text-l-ink-dim">{children}</span>;
}

/* Re-export a small clear button used by the batch-actions strip. */
export function ClearSelectionButton({
  count,
  onClear,
}: {
  count: number;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className={cx(
        "inline-flex h-6 items-center gap-1.5 rounded-[3px] border border-hairline-strong bg-l-surface-raised px-1.5",
        "font-sans text-[11.5px] text-l-ink",
        "transition-colors duration-fast ease-out",
        "hover:bg-l-surface-hover",
        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
        "[@media(pointer:coarse)]:h-9",
      )}
      aria-label={`Clear selection of ${count} traces`}
    >
      <span className="font-mono tabular-nums">{count}</span>
      <span className="text-l-ink-lo">selected</span>
      <X className="size-3 text-l-ink-dim" strokeWidth={1.75} aria-hidden />
    </button>
  );
}
