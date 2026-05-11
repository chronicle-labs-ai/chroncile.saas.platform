"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import { HASH_DOMAIN_META } from "./framework-meta";
import type { HashDomain } from "./types";

/*
 * HashDomainChip — color-coded chip for one of the 13 hash domains the
 * wrapper tracks (`prompt`, `model.contract`, `provider.options`,
 * `tool.contract`, `runtime.policy`, `dependency`,
 * `knowledge.contract`, `workflow.graph`, `effective.run`,
 * `provider.observation`, `operational`, `output`, `agent.root`).
 *
 * Renders consistently across the version-compare tab, the hash-index
 * search results, and the run drawer's hash-tree breakdown.
 */

export interface HashDomainChipProps {
  domain: HashDomain;
  /** When true, render with an active "filter selected" tone. */
  active?: boolean;
  /** When true, render only the dot + text — used inside row tables. */
  inline?: boolean;
  size?: "sm" | "md";
  onClick?: () => void;
  className?: string;
}

export function HashDomainChip({
  domain,
  active,
  inline,
  size = "sm",
  onClick,
  className,
}: HashDomainChipProps) {
  const meta = HASH_DOMAIN_META[domain];
  const Icon = meta.Icon;
  const interactive = onClick != null;

  const Element: React.ElementType = interactive ? "button" : "span";

  return (
    <Element
      type={interactive ? "button" : undefined}
      onClick={onClick}
      data-domain={domain}
      data-active={active || undefined}
      className={cx(
        "inline-flex items-center gap-1 rounded-pill font-mono tracking-[0.02em]",
        size === "sm" && "h-5 px-1.5 text-[10.5px]",
        size === "md" && "h-6 px-2 text-[11px]",
        // Touch hit area: chips are 20-24px on desktop; expand to 44px on coarse pointers.
        interactive &&
          "[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:px-3 touch-manipulation",
        inline
          ? "border-0 bg-transparent text-l-ink-lo"
          : "border border-l-border-faint bg-l-surface-input text-l-ink-lo",
        active && "border-ember/55 bg-ember/12 text-ember",
        interactive
          ? "cursor-pointer hover:bg-l-surface-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ember"
          : null,
        className,
      )}
    >
      {inline ? (
        <span aria-hidden className={cx("size-1.5 rounded-pill", meta.dot)} />
      ) : (
        <Icon className={cx(meta.ink, size === "sm" ? "size-2.5" : "size-3")} strokeWidth={1.75} />
      )}
      <span className="truncate">{meta.label}</span>
    </Element>
  );
}
