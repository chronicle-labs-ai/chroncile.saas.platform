"use client";

import * as React from "react";
import { Input } from "./input";
import { cn } from "../utils/cn";

/*
 * WorkspaceUrlField — composite input rendering `chronicle.io/<slug>`.
 *
 * Used by the workspace-setup capture step (A.4) and any other surface
 * that needs a slug-shaped identifier with a fixed prefix. The prefix
 * sits in a non-editable mono span, the slug uses `<Input variant="auth">`
 * so it lines up with the rest of the sign-up form rail.
 *
 * Slug auto-normalises on every keystroke: lowercase, hyphens for
 * spaces, strips anything outside `[a-z0-9-]`. The parent owns the
 * canonical value — we mirror it back via `onChange(slug)` after
 * normalisation.
 */

export interface WorkspaceUrlFieldProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "prefix"
  > {
  /** Prefix shown in the non-editable mono span. Default `"chronicle.io/"`. */
  prefix?: string;
  /** Current slug value (without the prefix). */
  value: string;
  /** Fires with the post-slugified next value. */
  onChange: (slug: string) => void;
  /** Render as invalid (red border tone via `<Input invalid>`). */
  invalid?: boolean;
  /** Wrapper className passthrough. */
  className?: string;
}

/** Slugify in the same shape WorkOS / our slug column expects. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function WorkspaceUrlField({
  prefix = "chronicle.io/",
  value,
  onChange,
  invalid = false,
  disabled = false,
  id,
  placeholder = "your-workspace",
  className,
  ...rest
}: WorkspaceUrlFieldProps) {
  return (
    <div
      data-disabled={disabled || undefined}
      data-invalid={invalid || undefined}
      className={cn(
        "flex w-full items-stretch overflow-hidden border",
        "transition-[border-color,box-shadow,background-color] duration-fast ease-out",
        "data-[invalid=true]:border-event-red",
        "data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed",
        "rounded-md border-hairline-strong bg-l-surface-input focus-within:border-[rgba(216,67,10,0.5)] focus-within:shadow-[0_0_0_3px_rgba(216,67,10,0.12)]",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex shrink-0 select-none items-center",
          "px-[10px] border-r border-hairline-strong bg-l-surface-raised font-sans text-[13px] text-l-ink-dim"
        )}
      >
        {prefix}
      </span>
      <Input
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="none"
        variant="auth"
        invalid={invalid}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(slugify(e.currentTarget.value))}
        className="flex-1 border-0 rounded-none bg-transparent focus:shadow-none focus:border-0"
        {...rest}
      />
    </div>
  );
}
