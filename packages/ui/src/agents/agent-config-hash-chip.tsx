"use client";

import * as React from "react";
import { Copy } from "lucide-react";

import { cx } from "../utils/cx";
import { useCopy } from "../utils/use-copy";

/*
 * AgentConfigHashChip — compact `sha256:abcd…1234` chip with optional
 * copy affordance.
 *
 * Hashes are everywhere in the agent registry (configHash,
 * instructionsHash, providerOptionsHash, inputSchemaHash, runId,
 * bodyHash, …). The chip:
 *
 *   - truncates the middle of the hex so the prefix + suffix stay
 *     visually pinned;
 *   - keeps the `sha256:` prefix so the customer can tell algorithms
 *     apart at a glance;
 *   - exposes a click-to-copy affordance that doesn't depend on an
 *     async clipboard helper — failures are silently no-op.
 */

export interface AgentConfigHashChipProps {
  hash: string;
  /** Number of leading hex chars after `sha256:` to keep visible. */
  leading?: number;
  /** Number of trailing hex chars to keep visible. */
  trailing?: number;
  /** Hide the copy icon. Use for inline mentions inside a sentence. */
  hideCopy?: boolean;
  /** Visual tone — `subtle` for inline mentions, `outlined` for chips
   *  in tables and detail headers. */
  tone?: "subtle" | "outlined";
  /** Optional label rendered before the hash (e.g. "config", "prompt"). */
  label?: React.ReactNode;
  className?: string;
}

export function AgentConfigHashChip({
  hash,
  leading = 6,
  trailing = 4,
  hideCopy,
  tone = "outlined",
  label,
  className,
}: AgentConfigHashChipProps) {
  const { copy, copied } = useCopy();

  const { algo, hex } = parseHash(hash);
  const truncated =
    hex.length > leading + trailing + 1
      ? `${hex.slice(0, leading)}…${hex.slice(-trailing)}`
      : hex;

  const onCopy = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      void copy(hash);
    },
    [copy, hash],
  );

  return (
    <span
      data-tone={tone}
      className={cx(
        "inline-flex items-center gap-1 font-mono text-[11px] tabular-nums",
        tone === "outlined" &&
          "rounded-[2px] border border-l-border-faint bg-l-surface-input px-1.5 py-[1px] text-l-ink-lo",
        tone === "subtle" && "text-l-ink-dim",
        className,
      )}
      title={hash}
    >
      {label ? (
        <span className="text-l-ink-dim">{label}</span>
      ) : (
        <span className="text-l-ink-dim">{algo}:</span>
      )}
      <span className="text-l-ink-lo">{truncated}</span>
      {hideCopy ? null : (
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? "Copied hash" : `Copy ${algo} hash`}
          className={cx(
            // Visual stays compact (size-3.5 = 14px) but touch hit area grows to 44px.
            "ml-0.5 inline-flex size-3.5 [@media(pointer:coarse)]:size-11 items-center justify-center rounded-[2px] text-l-ink-dim touch-manipulation",
            "hover:bg-l-surface-hover hover:text-l-ink",
            "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-ember",
          )}
        >
          {copied ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="size-3"
              aria-hidden
            >
              <path
                d="M4.5 12.75l6 6 9-13.5"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <Copy className="size-3" strokeWidth={1.75} />
          )}
        </button>
      )}
    </span>
  );
}

function parseHash(hash: string): { algo: string; hex: string } {
  const colonIndex = hash.indexOf(":");
  if (colonIndex <= 0) return { algo: "hash", hex: hash };
  return {
    algo: hash.slice(0, colonIndex),
    hex: hash.slice(colonIndex + 1),
  };
}
