"use client";

import * as React from "react";
import { Hash } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { Chip } from "../primitives/chip";
import { Input } from "../primitives/input";
import { formatStableDateTime, RelativeTime } from "../connections/time";

import { AgentConfigHashChip } from "./agent-config-hash-chip";
import { AgentFrameworkBadge } from "./agent-framework-badge";
import { HashDomainChip } from "./hash-domain-chip";
import { HASH_DOMAIN_META } from "./framework-meta";
import { globalHashIndexSeed } from "./data";
import type { AgentFramework, HashDomain, HashIndexEntry } from "./types";

/*
 * AgentHashIndexPage — standalone surface for cross-agent hash
 * lookups. Mirrors the wrapper's CLI commands:
 *
 *   npm run cli -- find-runs kind <domain>
 *   npm run cli -- explain-hash <sha256:...>
 *
 * Three filter axes — all combinable:
 *
 *   - free-text (matches hash, artifactId, runId, path, preview)
 *   - hash domain chips (prompt, model.contract, …)
 *   - source filter ("artifacts only" / "runs only" / both)
 *
 * Each result row exposes:
 *
 *   - the hash chip with click-to-copy
 *   - the domain chip
 *   - the path it was observed at
 *   - the artifact + run it came from (clickable to deep-link out)
 *   - a one-line preview of the value the hash was computed over
 */

export interface AgentHashIndexPageProps {
  entries?: readonly HashIndexEntry[];
  /** Pre-fill the search box. Used when arriving from the run drawer
   *  with `?hash=…` deep links. */
  initialQuery?: string;
  /** Pre-select hash domains. */
  initialDomains?: readonly HashDomain[];
  /** Optional handlers for navigating from a result row. */
  onOpenArtifact?: (artifactId: string) => void;
  onOpenRun?: (runId: string, artifactId: string) => void;
  className?: string;
}

const DOMAIN_GROUPS: ReadonlyArray<{
  label: string;
  domains: readonly HashDomain[];
}> = [
  {
    label: "Artifact",
    domains: [
      "agent.root",
      "prompt",
      "model.contract",
      "provider.options",
      "tool.contract",
      "runtime.policy",
      "dependency",
      "knowledge.contract",
      "workflow.graph",
    ],
  },
  {
    label: "Run",
    domains: [
      "effective.run",
      "provider.observation",
      "operational",
      "output",
    ],
  },
];

type SourceFilter = "all" | "artifacts" | "runs";

export function AgentHashIndexPage({
  entries = globalHashIndexSeed,
  initialQuery = "",
  initialDomains = [],
  onOpenArtifact,
  onOpenRun,
  className,
}: AgentHashIndexPageProps) {
  const [query, setQuery] = React.useState(initialQuery);
  const [domains, setDomains] = React.useState<HashDomain[]>([
    ...initialDomains,
  ]);
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>("all");

  const toggleDomain = (d: HashDomain) =>
    setDomains((cur) =>
      cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d],
    );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (domains.length > 0 && !domains.includes(entry.kind)) return false;
      if (sourceFilter === "artifacts" && entry.runId) return false;
      if (sourceFilter === "runs" && !entry.runId) return false;
      if (!q) return true;
      const haystack = `${entry.hash} ${entry.artifactId ?? ""} ${
        entry.runId ?? ""
      } ${entry.path} ${entry.preview ?? ""} ${entry.framework ?? ""}`;
      return haystack.toLowerCase().includes(q);
    });
  }, [entries, query, domains, sourceFilter]);

  // Group by hash so the customer sees how many places a single hash
  // was observed (this is the entire point of the index).
  const grouped = React.useMemo(() => {
    const map = new Map<string, HashIndexEntry[]>();
    for (const entry of filtered) {
      const existing = map.get(entry.hash);
      if (existing) {
        existing.push(entry);
      } else {
        map.set(entry.hash, [entry]);
      }
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 200);
  }, [filtered]);

  return (
    <div className={cx("flex flex-col gap-4 bg-l-surface p-4", className)}>
      <header className="flex flex-col gap-1">
        <h1 className="font-sans text-[18px] font-medium leading-tight text-l-ink">
          Hash index
        </h1>
        <p className="max-w-2xl font-sans text-[13px] leading-5 text-l-ink-dim">
          Look up where a specific configHash, prompt hash, tool contract,
          response body, or any other observed value was used. Each entry
          is a single hash observation across artifacts and runs.
        </p>
      </header>

      <section className="flex flex-col gap-2 rounded-[4px] border border-l-border-faint bg-l-wash-1 p-3">
        <Input
          density="compact"
          search
          placeholder="Paste a hash or part of one — sha256:…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          className="max-w-[640px]"
        />
        <div className="flex flex-wrap items-center gap-2">
          {DOMAIN_GROUPS.map((group) => (
            <div
              key={group.label}
              className="flex flex-wrap items-center gap-1.5"
            >
              <span className="font-sans text-[11px] text-l-ink-dim">
                {group.label}
              </span>
              {group.domains.map((domain) => (
                <HashDomainChip
                  key={domain}
                  domain={domain}
                  active={domains.includes(domain)}
                  onClick={() => toggleDomain(domain)}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-sans text-[11px] text-l-ink-dim">Source</span>
          {(["all", "artifacts", "runs"] as const).map((s) => (
            <Chip
              key={s}
              density="compact"
              active={sourceFilter === s}
              onClick={() => setSourceFilter(s)}
            >
              {s === "all" ? "All" : s === "artifacts" ? "Artifacts" : "Runs"}
            </Chip>
          ))}
          <span className="ml-auto font-sans text-[11px] text-l-ink-dim">
            {filtered.length} of {entries.length} entries · {grouped.length}{" "}
            unique hashes
          </span>
        </div>
      </section>

      {grouped.length === 0 ? (
        <div className="rounded-[4px] border border-l-border-faint bg-l-wash-1 p-6 text-center font-sans text-[12px] text-l-ink-dim">
          No matching hashes. Try clearing a filter or pasting a different
          hash.
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {grouped.map(([hash, observations]) => (
            <HashGroup
              key={hash}
              hash={hash}
              observations={observations}
              onOpenArtifact={onOpenArtifact}
              onOpenRun={onOpenRun}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

interface HashGroupProps {
  hash: string;
  observations: readonly HashIndexEntry[];
  onOpenArtifact?: (artifactId: string) => void;
  onOpenRun?: (runId: string, artifactId: string) => void;
}

function HashGroup({
  hash,
  observations,
  onOpenArtifact,
  onOpenRun,
}: HashGroupProps) {
  // The dominant kind in the group sets the icon/color.
  const dominantDomain = observations[0]!.kind;
  const meta = HASH_DOMAIN_META[dominantDomain];
  const Icon = meta.Icon;

  const frameworks = Array.from(
    new Set(
      observations
        .map((o) => o.framework)
        .filter((f): f is AgentFramework => Boolean(f)),
    ),
  );

  return (
    <li
      data-domain={dominantDomain}
      className="rounded-[4px] border border-l-border bg-l-surface-raised"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-l-border-faint px-3 py-2.5">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-[3px] bg-l-surface-input"
        >
          <Hash className="size-3.5 text-l-ink-dim" strokeWidth={1.75} />
        </span>
        <AgentConfigHashChip hash={hash} leading={8} trailing={6} />
        <HashDomainChip domain={dominantDomain} inline />
        <span className="font-sans text-[11px] text-l-ink-dim">
          Observed in {observations.length} place
          {observations.length === 1 ? "" : "s"}
          <Icon
            className={cx("ml-1 inline size-3", meta.ink)}
            strokeWidth={1.75}
            aria-hidden
          />
        </span>
        {frameworks.length > 0 ? (
          <span className="ml-auto flex items-center gap-1">
            {frameworks.map((f) => (
              <AgentFrameworkBadge key={f} framework={f} iconless />
            ))}
          </span>
        ) : null}
      </header>

      <ul className="divide-y divide-l-border-faint">
        {observations.map((obs, index) => (
          <li
            key={`${obs.path}:${obs.observedAt}:${index}`}
            className="grid grid-cols-1 gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px]"
          >
            <div className="flex flex-col gap-1">
              <span className="truncate font-mono text-[12px] text-l-ink-lo">
                {obs.path}
              </span>
              {obs.preview ? (
                <span className="truncate font-sans text-[11px] text-l-ink-dim">
                  {obs.preview}
                </span>
              ) : null}
            </div>
            <div className="flex flex-col gap-1 font-sans text-[11px]">
              {obs.artifactId ? (
                <button
                  type="button"
                  onClick={() => onOpenArtifact?.(obs.artifactId!)}
                  className="flex truncate text-left text-l-ink-lo hover:text-ember"
                >
                  <span className="text-l-ink-dim">Artifact</span>
                  <span className="ml-1 truncate font-mono">
                    {obs.artifactId}
                  </span>
                </button>
              ) : null}
              {obs.runId ? (
                <button
                  type="button"
                  onClick={() =>
                    obs.artifactId
                      ? onOpenRun?.(obs.runId!, obs.artifactId)
                      : undefined
                  }
                  className="flex truncate text-left text-l-ink-lo hover:text-ember"
                >
                  <span className="text-l-ink-dim">Run</span>
                  <span className="ml-1 truncate font-mono">
                    {obs.runId.slice(0, 12)}…
                  </span>
                </button>
              ) : null}
            </div>
            <div className="text-right font-sans text-[11px] text-l-ink-dim">
              <div>{formatStableDateTime(obs.observedAt)}</div>
              <div className="text-l-ink-dim">
                <RelativeTime iso={obs.observedAt} fallback="—" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </li>
  );
}

/* Convenience action for the manager toolbar. */
export function HashIndexLaunchButton({
  onPress,
  className,
}: {
  onPress: () => void;
  className?: string;
}) {
  return (
    <Button
      density="compact"
      variant="secondary"
      size="sm"
      onPress={onPress}
      leadingIcon={<Hash className="size-3.5" strokeWidth={1.75} />}
      className={className}
    >
      Hash search
    </Button>
  );
}
