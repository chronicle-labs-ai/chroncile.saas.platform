"use client";

import * as React from "react";

import { cx } from "../utils/cx";

import { AgentCompanyMark } from "./agent-company-mark";
import { FRAMEWORK_META } from "./framework-meta";
import type { AgentFramework } from "./types";

/*
 * AgentFrameworkBadge — metadata-only chip for the underlying agent
 * framework (Vercel AI SDK, OpenAI Agents, LangChain, Mastra,
 * LangChain-Python, LlamaIndex, CrewAI, …).
 *
 * The framework is *not* a primary filter or comparison axis — this
 * chip exists only to give the customer a quick visual hint of where
 * the agent runs.
 *
 * The visual mark is the *company* behind the framework, fetched via
 * `<CompanyLogo>` (logo.dev). For Vercel AI SDK this means the real
 * Vercel triangle; for LangChain it's the LangChain parrot; for
 * OpenAI Agents it's the OpenAI mark, etc. A lucide fallback kicks
 * in if the network image cannot load.
 *
 * Two sizes:
 *
 *   "sm"  — used inline in row-density tables / sidebar metas.
 *   "md"  — used on cards and detail-page headers.
 */

export interface AgentFrameworkBadgeProps {
  framework: AgentFramework;
  size?: "sm" | "md";
  /** When true, hides the logo and renders just the dot + text. */
  iconless?: boolean;
  className?: string;
}

export function AgentFrameworkBadge({
  framework,
  size = "sm",
  iconless,
  className,
}: AgentFrameworkBadgeProps) {
  const meta = FRAMEWORK_META[framework];

  return (
    <span
      data-framework={framework}
      data-family={meta.family}
      className={cx(
        "inline-flex items-center gap-1 rounded-pill border border-l-border-faint",
        "font-mono uppercase tracking-[0.04em] text-l-ink-lo",
        size === "sm" && "h-5 pl-0.5 pr-1.5 text-[10px]",
        size === "md" && "h-6 pl-0.5 pr-2 text-[10.5px]",
        className,
      )}
    >
      {iconless ? (
        <span aria-hidden className={cx("ml-1 size-1.5 rounded-pill", meta.dot)} />
      ) : (
        <AgentCompanyMark
          name={meta.companyName}
          domain={meta.companyDomain}
          size="xs"
          fallbackIcon={meta.Icon}
          alt={`${meta.label} logo`}
        />
      )}
      <span className="truncate">{meta.label}</span>
      {meta.family === "python" ? (
        <span
          aria-hidden
          className="text-l-ink-dim"
          title="Python framework"
        >
          py
        </span>
      ) : null}
    </span>
  );
}
