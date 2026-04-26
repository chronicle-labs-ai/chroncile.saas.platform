"use client";

import * as React from "react";
import { cx } from "../utils/cx";
import { CopyButton } from "../primitives/copy-button";
import { Checkbox } from "../primitives/checkbox";
import { CheckIcon } from "../icons/glyphs";

/*
 * Shared internal building blocks for the connector modals.
 *
 * Not re-exported from the package barrel. If a third caller appears
 * outside `src/connectors/`, promote the helper to `primitives/`
 * (or `icons/`) instead of widening the import.
 *
 * Conventions:
 *  - Presentational + uncontrolled-friendly (state lives at the
 *    boundary). The connector modals own state; these are dumb views.
 *  - Token-only styling. CSS class names land in
 *    `../styles/connectors.css` under the `cmodal-*` / `mode-pill` /
 *    `cfield` / `scope-list` / `evt-chip` / `step-rail` /
 *    `cinput-readonly` / `ccode` / `numlist` / `evt-recv` namespaces.
 */

/* ── ModePill — segmented Test/Live, Listen/Post/Both, etc. ── */

export interface ModePillOption<TId extends string> {
  id: TId;
  label: React.ReactNode;
  /** Optional inline icon prefix. */
  icon?: React.ReactNode;
}

export interface ModePillProps<TId extends string>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  options: readonly ModePillOption<TId>[];
  value: TId;
  onChange: (next: TId) => void;
  size?: "sm" | "md";
}

export function ModePill<TId extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
  ...rest
}: ModePillProps<TId>) {
  return (
    <div
      role="tablist"
      data-size={size}
      className={cx("mode-pill", className)}
      {...rest}
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          data-active={value === opt.id || undefined}
          aria-selected={value === opt.id}
          onClick={() => onChange(opt.id)}
          className="mode-pill-btn"
        >
          {opt.icon ? (
            <span className="mode-pill-ico" aria-hidden>
              {opt.icon}
            </span>
          ) : null}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ── FieldRow — labelled field with optional helper + invalid state ── */

export interface FieldRowProps {
  /** Form-control id; rendered as the htmlFor on the label. */
  id?: string;
  label: React.ReactNode;
  /** Renders to the right of the label as a faint hint. */
  hint?: React.ReactNode;
  /** Help text below the field. */
  help?: React.ReactNode;
  /** Validation message — replaces `help` when present, tinted red. */
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function FieldRow({
  id,
  label,
  hint,
  help,
  error,
  children,
  className,
}: FieldRowProps) {
  return (
    <div className={cx("cfield", className)} data-invalid={error ? true : undefined}>
      <div className="cfield-head">
        <label htmlFor={id} className="cfield-label">
          {label}
        </label>
        {hint ? <span className="cfield-hint">{hint}</span> : null}
      </div>
      <div className="cfield-body">{children}</div>
      {error ? (
        <div className="cfield-error">{error}</div>
      ) : help ? (
        <div className="cfield-help">{help}</div>
      ) : null}
    </div>
  );
}

/* ── ReadonlyInput — boxed text + copy button (URLs, secrets, etc.) ── */

export interface ReadonlyInputProps {
  value: string;
  /** Mask renders dots regardless of `value` length. Reveal flips it back. */
  secret?: boolean;
  /** Allow toggling visibility when `secret`. */
  reveal?: boolean;
  /** Removes the inner copy button. */
  noCopy?: boolean;
  /** Apply mono font (default true). */
  mono?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function ReadonlyInput({
  value,
  secret = false,
  reveal = false,
  noCopy = false,
  mono = true,
  className,
  ariaLabel,
}: ReadonlyInputProps) {
  const display = secret && !reveal ? "•".repeat(Math.min(value.length, 24)) : value;
  return (
    <div
      className={cx("cinput-readonly", className)}
      data-mono={mono || undefined}
    >
      <span className="cinput-readonly-value" aria-label={ariaLabel}>
        {display}
      </span>
      {!noCopy ? (
        <CopyButton text={value} className="cinput-readonly-copy" />
      ) : null}
    </div>
  );
}

/* ── ScopeList — list of permission scopes with reasons ────── */

export interface ScopeListItem {
  id: string;
  label?: React.ReactNode;
  reason: React.ReactNode;
  /** When `true`, the row is locked checked + tagged "REQUIRED". */
  required?: boolean;
}

export interface ScopeListProps {
  items: readonly ScopeListItem[];
  selected: readonly string[];
  onToggle: (id: string, next: boolean) => void;
  className?: string;
}

export function ScopeList({
  items,
  selected,
  onToggle,
  className,
}: ScopeListProps) {
  return (
    <ul className={cx("scope-list", className)}>
      {items.map((it) => {
        const checked = it.required || selected.includes(it.id);
        return (
          <li
            key={it.id}
            className="scope-list-row"
            data-required={it.required || undefined}
          >
            <Checkbox
              checked={checked}
              isDisabled={it.required}
              onChange={(next: boolean) => onToggle(it.id, next)}
              size="sm"
              variant="auth"
            />
            <div className="scope-list-meta">
              <span className="scope-list-id">{it.label ?? it.id}</span>
              <span className="scope-list-reason">{it.reason}</span>
            </div>
            {it.required ? (
              <span className="scope-list-tag">REQUIRED</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/* ── StepRail — vertical step rail for wizard bodies ───────── */

export interface StepRailItem {
  id: string;
  label: React.ReactNode;
  /** Optional secondary label rendered under the step name. */
  hint?: React.ReactNode;
}

export interface StepRailProps {
  items: readonly StepRailItem[];
  /** Index of the active step (0-based). */
  currentIndex: number;
  /** When provided, past steps render as buttons that jump back. */
  onJump?: (index: number, id: string) => void;
  className?: string;
}

export function StepRail({
  items,
  currentIndex,
  onJump,
  className,
}: StepRailProps) {
  return (
    <ol className={cx("step-rail", className)}>
      {items.map((it, i) => {
        const state =
          i < currentIndex ? "done" : i === currentIndex ? "active" : "idle";
        const canJump = onJump != null && i < currentIndex;
        const Marker = canJump ? "button" : "span";
        return (
          <li key={it.id} className="step-rail-row" data-state={state}>
            <Marker
              className="step-rail-marker"
              {...(canJump
                ? {
                    type: "button" as const,
                    onClick: () => onJump?.(i, it.id),
                    "aria-label": `Go to step ${i + 1}`,
                  }
                : { "aria-hidden": true })}
            >
              {state === "done" ? (
                <CheckIcon size={10} />
              ) : (
                <span className="step-rail-num">{i + 1}</span>
              )}
            </Marker>
            <div className="step-rail-meta">
              <span className="step-rail-label">{it.label}</span>
              {it.hint ? (
                <span className="step-rail-hint">{it.hint}</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ── EventChip — toggleable event-type pill ────────────────── */

export interface EventChipProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onChange"> {
  active?: boolean;
  /** `object.action` event id rendered as inline mono. */
  children: React.ReactNode;
  onChange?: (next: boolean) => void;
}

export function EventChip({
  active = false,
  children,
  onChange,
  className,
  onClick,
  ...rest
}: EventChipProps) {
  return (
    <button
      type="button"
      data-active={active || undefined}
      aria-pressed={active}
      onClick={(e) => {
        onChange?.(!active);
        onClick?.(e);
      }}
      className={cx("evt-chip", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ── NumberedList — body copy with numbered markers ────────── */

export interface NumberedListProps
  extends Omit<React.OlHTMLAttributes<HTMLOListElement>, "children"> {
  children: React.ReactNode;
}

export function NumberedList({
  className,
  children,
  ...rest
}: NumberedListProps) {
  return (
    <ol className={cx("numlist", className)} {...rest}>
      {children}
    </ol>
  );
}

/* ── CodeBlock — monospaced block with copy affordance ─────── */

export interface CodeBlockProps {
  code: string;
  /** Adds a copy button in the corner. Default `true`. */
  copy?: boolean;
  /** Caption rendered above the block. */
  caption?: React.ReactNode;
  className?: string;
}

export function CodeBlock({
  code,
  copy = true,
  caption,
  className,
}: CodeBlockProps) {
  return (
    <div className={cx("ccode-wrap", className)}>
      {caption ? <div className="ccode-cap">{caption}</div> : null}
      <pre className="ccode">
        <code>{code}</code>
        {copy ? <CopyButton text={code} className="ccode-copy" /> : null}
      </pre>
    </div>
  );
}

/* ── EventRecv — "received" preview row for webhook archetype ── */

export interface EventRecvProps {
  /** ISO timestamp string, displayed as-is. */
  ts: string;
  /** HTTP verb (defaults to POST). */
  method?: string;
  /** Inline preview of the payload (truncated upstream). */
  preview: React.ReactNode;
  /** Status code; tints the row green/red based on 2xx vs error. */
  status: number;
  className?: string;
}

export function EventRecv({
  ts,
  method = "POST",
  preview,
  status,
  className,
}: EventRecvProps) {
  const ok = status >= 200 && status < 300;
  return (
    <div
      className={cx("evt-recv", className)}
      data-ok={ok || undefined}
      data-err={!ok || undefined}
    >
      <span className="evt-recv-ts">{ts}</span>
      <span className="evt-recv-method">{method}</span>
      <span className="evt-recv-preview">{preview}</span>
      <span className="evt-recv-status">{status}</span>
    </div>
  );
}
