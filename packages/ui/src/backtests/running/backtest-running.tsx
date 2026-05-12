/*
 * BacktestRunning — Stage 2 surface (Variant A from the mockup).
 * Renders the live run dashboard:
 *
 *   header       (run name + actions: pause / abort / jump-to-results)
 *   progress row (big bar + 4 gauges)
 *   candidates   (per-agent progress + tiny metric strip)
 *   split        (live trace feed table | early divergences preview)
 */

"use client";

import * as React from "react";
import { Pause, Play, SkipForward, X } from "lucide-react";

import { cx } from "../../utils/cx";
import { Button } from "../../primitives/button";
import { Eyebrow } from "../../primitives/eyebrow";
import { Mono } from "../../typography/mono";
import { Sparkline } from "../../primitives/sparkline";

import {
  BacktestToneTag,
  CandidateHueDot,
  SeverityDot,
} from "../atoms";
import { divergenceDeltaTone } from "../delta-meta";
import { buildLiveFeed } from "../data";
import type {
  BacktestAgent,
  BacktestDivergence,
  BacktestLiveCase,
  BacktestRecipe,
} from "../types";

export interface BacktestRunningProps {
  recipe: BacktestRecipe;
  /** Override divergences shown on the right column. */
  divergences: readonly BacktestDivergence[];
  /** Initial progress 0..100. Stories pin this. */
  initialProgress?: number;
  /** Workers count rendered in the live feed header. */
  workers?: number;
  onFinish?: () => void;
  onAbort?: () => void;
  className?: string;
}

const TOTAL_CASES_DEFAULT = 1842;

export function BacktestRunning({
  recipe,
  divergences,
  initialProgress = 47,
  workers = 32,
  onFinish,
  onAbort,
  className,
}: BacktestRunningProps) {
  const [progress, setProgress] = React.useState(initialProgress);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused || progress >= 100) return;
    const id = window.setInterval(() => {
      setProgress((p) => Math.min(100, p + 0.3));
    }, 200);
    return () => window.clearInterval(id);
  }, [paused, progress]);

  const total = TOTAL_CASES_DEFAULT;
  const done = Math.round((progress / 100) * total);
  const running = paused ? 0 : workers;
  const queued = Math.max(0, total - done - running);
  const eta = Math.max(1, Math.round((100 - progress) * 0.14));

  const candidates = recipe.agents;
  const liveFeed = React.useMemo(
    () => buildLiveFeed(28, candidates.map((c) => c.id)),
    [candidates],
  );
  const candidateById = React.useMemo(() => {
    const m = new Map<string, BacktestAgent>();
    candidates.forEach((c) => m.set(c.id, c));
    return m;
  }, [candidates]);

  return (
    <div className={cx("mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-6", className)}>
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-hairline bg-surface-01 px-4 py-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="inline-flex items-center gap-1.5 text-event-green">
            <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-event-green" />
            <Mono size="sm" tone="lo" tactical uppercase className="text-event-green">
              LIVE
            </Mono>
          </span>
          <h1 className="text-title-sm font-medium text-ink-hi">{recipe.name}</h1>
          <Mono size="sm" tone="dim">
            run_a82c3 · started 14:02
          </Mono>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            leadingIcon={
              paused ? (
                <Play className="size-3.5" fill="currentColor" />
              ) : (
                <Pause className="size-3.5" fill="currentColor" />
              )
            }
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? "resume" : "pause"}
          </Button>
          <Button
            variant="ghost"
            leadingIcon={<X className="size-3.5" strokeWidth={1.6} />}
            onClick={onAbort}
          >
            abort
          </Button>
          <Button
            variant="ember"
            trailingIcon={<SkipForward className="size-3.5" strokeWidth={1.6} />}
            onClick={onFinish}
          >
            jump to results
          </Button>
        </div>
      </header>

      {/* Progress + gauges */}
      <section className="grid gap-3 rounded-md border border-hairline bg-surface-01 p-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-display-sm font-light tracking-tight text-ink-hi">
              {done.toLocaleString()}
            </span>
            <span className="text-ink-dim">/</span>
            <span className="text-title-sm text-ink-lo">{total.toLocaleString()}</span>
            <Mono className="ml-2 text-ember" tone="default">
              {progress.toFixed(1)}%
            </Mono>
          </div>
          <div className="relative h-2 overflow-hidden rounded-pill bg-surface-03">
            <div
              className="h-full bg-ember transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
            {[25, 50, 75].map((tick) => (
              <span
                key={tick}
                aria-hidden
                className="absolute top-0 h-full w-px bg-surface-00/60"
                style={{ left: `${tick}%` }}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-ink-lo">
            <span>
              <b className="text-ink-hi">{running}</b> running
            </span>
            <span className="text-ink-dim">·</span>
            <span>
              <b className="text-ink-hi">{queued.toLocaleString()}</b> queued
            </span>
            <span className="text-ink-dim">·</span>
            <span>
              <b className="text-ink-hi">{done.toLocaleString()}</b> complete
            </span>
            <span className="text-ink-dim">·</span>
            <span>
              ETA <b className="text-ink-hi">{eta}m</b>
            </span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Gauge
            label="pass rate"
            value="89.4%"
            tone="green"
            trend={[86, 87, 88, 88, 89, 89, 89, 89]}
          />
          <Gauge
            label="divergence"
            value="11.2%"
            tone="violet"
            trend={[9, 10, 10, 11, 11, 12, 11, 11]}
          />
          <Gauge
            label="error rate"
            value="0.8%"
            tone="red"
            trend={[0.6, 0.7, 0.8, 0.9, 0.8, 0.8, 0.7, 0.8]}
          />
          <Gauge
            label="$ spent"
            value="$4.21"
            tone="amber"
            trend={[0.5, 1.1, 1.8, 2.4, 2.9, 3.4, 3.8, 4.2]}
          />
        </div>
      </section>

      {/* Candidate rows */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((c, i) => (
          <CandidateRunRow key={c.id} agent={c} done={done} total={total} isBaseline={i === 0} />
        ))}
      </section>

      {/* Live feed + divergence preview */}
      <section className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex min-h-0 flex-col rounded-md border border-hairline bg-surface-01">
          <header className="flex items-center justify-between border-b border-hairline px-3 py-2">
            <Eyebrow className="text-ink-dim">LIVE TRACE FEED</Eyebrow>
            <span className="inline-flex items-center gap-1.5 text-body-sm text-ink-lo">
              <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-event-green" />
              streaming · {running} workers
            </span>
          </header>
          <LiveFeedTable feed={liveFeed} candidateById={candidateById} />
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-hairline bg-surface-01">
          <header className="flex items-center justify-between border-b border-hairline px-3 py-2">
            <Eyebrow className="text-ember">EARLY DIVERGENCES</Eyebrow>
            <span className="text-body-sm text-ink-lo">
              <b className="text-ink-hi">{divergences.length}</b> flagged so far
            </span>
          </header>
          <ul className="flex flex-col divide-y divide-hairline">
            {divergences.slice(0, 5).map((d) => (
              <li key={d.id} className="flex flex-col gap-1.5 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <SeverityDot severity={d.severity} />
                  <Mono size="sm" tone="lo">
                    {d.id}
                  </Mono>
                  <BacktestToneTag tone={divergenceDeltaTone(d.delta)}>{d.delta}</BacktestToneTag>
                </div>
                <p className="line-clamp-2 text-body-sm text-ink">&ldquo;{d.prompt}&rdquo;</p>
                <div className="flex items-center gap-2 text-mono-sm text-ink-lo">
                  <span>{d.cluster}</span>
                  <span className="text-ink-dim">·</span>
                  <span>{d.grader}</span>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="border-t border-hairline px-3 py-2 text-left text-body-sm text-ember transition-colors hover:bg-surface-02"
          >
            view all {divergences.length} →
          </button>
        </div>
      </section>
    </div>
  );
}

function Gauge({
  label,
  value,
  tone,
  trend,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "red" | "violet";
  trend: number[];
}) {
  const toneClass: Record<string, string> = {
    green: "text-event-green",
    amber: "text-event-amber",
    red: "text-event-red",
    violet: "text-event-violet",
  };
  const sparkTone = tone === "violet" ? "ember" : (tone as "green" | "amber" | "red");
  return (
    <div className="rounded-md border border-hairline bg-surface-02 p-3">
      <Eyebrow className="text-ink-dim">{label}</Eyebrow>
      <div className={cx("mt-1 font-display text-title-sm font-light", toneClass[tone])}>
        {value}
      </div>
      <div className="mt-1 h-5">
        <Sparkline values={trend} tone={sparkTone} width={120} height={20} className="!h-5" />
      </div>
    </div>
  );
}

function CandidateRunRow({
  agent,
  done,
  total,
  isBaseline,
}: {
  agent: BacktestAgent;
  done: number;
  total: number;
  isBaseline: boolean;
}) {
  const pct = Math.min(100, (done / total) * 100);
  const metrics = isBaseline
    ? { pass: 92.1, div: null as string | null, err: 0.2, dur: "8.4s", cost: "$1.02" }
    : {
        pass:
          agent.id === "support-v4.0"
            ? 91.2
            : agent.id === "support-v4.1"
              ? 89.4
              : 86.7,
        div:
          agent.id === "support-v4.0"
            ? "7.2%"
            : agent.id === "support-v4.1"
              ? "10.1%"
              : "18.4%",
        err: agent.id === "support-v4.2" ? 1.4 : 0.6,
        dur: agent.id === "support-v4.2" ? "13.2s" : "9.1s",
        cost: agent.id === "support-v4.2" ? "$1.84" : "$1.07",
      };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-hairline bg-surface-01 p-3">
      <div className="flex items-center gap-2">
        <CandidateHueDot hue={agent.hue} size="sm" />
        <span className="flex-1 text-body-sm text-ink-hi">{agent.label}</span>
        <span
          className={cx(
            "rounded-xs px-1.5 py-0.5 font-mono text-mono-sm uppercase tracking-tactical",
            isBaseline
              ? "bg-surface-03 text-ink-lo"
              : "bg-ember/15 text-ember",
          )}
        >
          {isBaseline ? "baseline" : "candidate"}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-pill bg-surface-03">
        <div
          className="h-full transition-[width] duration-200"
          style={{ width: `${pct}%`, background: agent.hue }}
        />
      </div>
      <div className="grid grid-cols-5 gap-2 border-t border-hairline pt-2">
        <Stat label="pass" value={`${metrics.pass}%`} />
        <Stat label="diverge" value={metrics.div ?? "—"} />
        <Stat label="error" value={`${metrics.err}%`} />
        <Stat label="dur" value={metrics.dur} />
        <Stat label="spent" value={metrics.cost} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <Eyebrow className="text-ink-dim">{label}</Eyebrow>
      <span className="font-mono text-body-sm text-ink-hi">{value}</span>
    </div>
  );
}

function LiveFeedTable({
  feed,
  candidateById,
}: {
  feed: readonly BacktestLiveCase[];
  candidateById: Map<string, BacktestAgent>;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-[24px_88px_minmax(120px,1fr)_minmax(180px,2fr)_minmax(120px,1fr)_56px_64px] gap-2 border-b border-hairline bg-surface-02 px-3 py-1.5 text-mono-sm uppercase tracking-tactical text-ink-dim">
        <span aria-hidden />
        <span>TRACE</span>
        <span>CLUSTER</span>
        <span>PROMPT</span>
        <span>CANDIDATE</span>
        <span>DUR</span>
        <span>TIME</span>
      </div>
      <ul className="flex max-h-[420px] min-h-0 flex-1 flex-col overflow-auto">
        {feed.map((row) => {
          const agent = candidateById.get(row.agentId);
          return (
            <li
              key={row.id}
              className="grid grid-cols-[24px_88px_minmax(120px,1fr)_minmax(180px,2fr)_minmax(120px,1fr)_56px_64px] items-center gap-2 border-b border-hairline/60 px-3 py-1.5"
            >
              <FeedStatus status={row.status} />
              <Mono size="sm" tone="lo">
                {row.id}
              </Mono>
              <span className="truncate text-body-sm text-ink-lo">{row.cluster}</span>
              <span className="truncate text-body-sm text-ink">&ldquo;{row.prompt}&rdquo;</span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                {agent ? <CandidateHueDot hue={agent.hue} size="xs" /> : null}
                <span className="truncate text-body-sm text-ink-hi">{agent?.label ?? "—"}</span>
              </span>
              <Mono size="sm" tone="lo">
                {row.durationSec.toFixed(1)}s
              </Mono>
              <Mono size="sm" tone="dim">
                {row.ts}
              </Mono>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FeedStatus({ status }: { status: BacktestLiveCase["status"] }) {
  if (status === "running") {
    return <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-event-amber" />;
  }
  if (status === "pass") {
    return (
      <span aria-hidden className="text-event-green">
        ✓
      </span>
    );
  }
  if (status === "fail") {
    return (
      <span aria-hidden className="text-event-red">
        ✕
      </span>
    );
  }
  return (
    <span aria-hidden className="text-event-amber">
      ◐
    </span>
  );
}
