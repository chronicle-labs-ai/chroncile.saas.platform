"use client";

import * as React from "react";
import { useTheme } from "./theme-provider";

export interface ThemeToggleProps extends React.HTMLAttributes<HTMLButtonElement> {
  /** When true, renders fixed to the bottom-right like the handoff prototype. */
  floating?: boolean;
  /** Show the `T` keyboard-shortcut hint. Default true. */
  showShortcut?: boolean;
}

/**
 * A restrained pill that flips the theme. Matches the handoff's
 * bottom-right toggle in spirit but is a real React component.
 */
export function ThemeToggle({
  floating = false,
  showShortcut = true,
  className = "",
  ...rest
}: ThemeToggleProps) {
  const { theme, toggle } = useTheme();

  const base =
    "inline-flex items-center gap-s-3 rounded-pill border border-hairline-strong bg-surface-01 px-s-3 py-s-2 font-mono text-mono-sm uppercase tracking-eyebrow text-ink-lo shadow-card transition-colors duration-fast hover:border-ink-dim hover:text-ink-hi";
  const position = floating ? "fixed bottom-s-5 right-s-5 z-50" : "";

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      aria-pressed={theme === "light"}
      onClick={toggle}
      className={[base, position, className].filter(Boolean).join(" ")}
      {...rest}
    >
      <span
        aria-hidden
        className="h-[10px] w-[10px] rounded-full"
        style={{
          background: "var(--grad-lightsource)",
          boxShadow: "0 0 0 1px var(--c-hairline-strong)",
        }}
      />
      <span className="min-w-[5ch] text-left font-medium text-ink-hi">
        {theme === "light" ? "Light" : "Dark"}
      </span>
      {showShortcut ? (
        <kbd className="rounded-xs bg-surface-03 px-[6px] py-[2px] text-mono-xs text-ink-dim">
          T
        </kbd>
      ) : null}
    </button>
  );
}
