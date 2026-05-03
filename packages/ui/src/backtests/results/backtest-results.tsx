/*
 * BacktestResults — Stage 3 surface (Variant A from the mockup).
 * Layout:
 *
 *   verdict strip      (winner + headline copy + actions)
 *   agent score cards  (per-candidate net-score + tiny stats)
 *   metrics table      (baseline vs candidates with delta chips + sparklines)
 *   divergences list   (side-by-side outcome rows, sorted by severity)
 */

"use client";

import * as React from "react";
import { ArrowRight, CheckCircle2, FileJson, Share2 } from "lucide-react";

import { cx } from "../../utils/cx";
import { Button } from "../../primitives/button";
import { Eyebrow } from "../../primitives/eyebrow";
import { Mono } from "../../typography/mono";
import { Tag } from "../../primitives/tag";
import { NativeSelect } from "../../primitives/native-select";

import {
  BacktestAnchorSparkline,
  BacktestDelta,
  BacktestToneTag,
  CandidateHueDot,
  SeverityDot,
} from "../atoms";
import { divergenceDeltaTone } from "../delta-meta";
import { outcomeLabel, outcomeTagVariant } from "../outcome-meta";
import { backtestSparkline } from "../data";
import type {
  BacktestAgent,
  BacktestDivergence,
  BacktestMetric,
  BacktestRecipe,
} from "../types";

export interface BacktestResultsProps {
  recipe: BacktestRecipe;
  metrics: readonly BacktestMetric[];
  divergences: readonly BacktestDivergence[];
  /** Defaults to the first non-baseline candidate. */
  defaultFocusedAgentId?: string;
  /** Free-text verdict copy override. */
  verdictTitle?: React.ReactNode;
  verdictSub?: React.ReactNode;
  onPromote?: (agentId: string) => void;
  onEditRecipe?: () => void;
  className?: string;
}

export function BacktestResults({
  recipe,
  metrics,
  divergences,
  defaultFocusedAgentId,
  verdictTitle,
  verdictSub,
  onPromote,
  onEditRecipe,
  className,
}: BacktestResultsProps) {
  const baseline = recipe.agents[0];
  const candidates = recipe.agents.slice(1);
  const winner = candidates.find((c) => c.id === "support-v4.0") ?? candidates[0] ?? null;
  const watch = candidates.find((c) => c.id === "support-v4.2");
  const [focused, setFocused] = React.useState<string>(
    defaultFocusedAgentId ?? winner?.id ?? candidates[0]?.id ?? "",
  );
  const [sortBy, setSortBy] = React.useState<string>(metrics[0]?.id ?? "resolve");

  return (
    <div className={cx("mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 py-6", className)}>
      {/* Verdict */}
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-md border border-hairline bg-surface-01 px-4 py-4">
        <div className="flex max-w-3xl flex-col gap-2">
          <Eyebrow className="text-event-green">RUN COMPLETE · 28m 14s</Eyebrow>
          <h1 className="font-display text-display-sm font-light tracking-tight text-ink-hi">
            {verdictTitle ?? (
              <>
                <CandidateHueDot
                  hue={winner?.hue ?? "var(--c-event-teal)"}
                  size="md"
                  className="mr-2 inline-block align-middle"
                />
                <b className="font-medium">{winner?.label ?? "no candidate"}</b> wins on{" "}
                <b className="font-medium">5 of {metrics.length}</b> metrics
              </>
            )}
          </h1>
          <p className="text-body-sm text-ink-lo">
            {verdictSub ?? (
              <>
                Significant improvement on resolution rate (+5.2pp), escalation rate
                (−3.3pp), and cost. Worth promoting — but review{" "}
                <b className="text-ink-hi">2 high-severity regressions</b> before merge.
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            leadingIcon={<FileJson className="size-3.5" strokeWidth={1.6} />}
          >
            export JSON
          </Button>
          <Button
            variant="ghost"
            leadingIcon={<Share2 className="size-3.5" strokeWidth={1.6} />}
          >
            share report
          </Button>
          <Button
            variant="ember"
            leadingIcon={<CheckCircle2 className="size-3.5" strokeWidth={1.6} />}
            onClick={() => winner && onPromote?.(winner.id)}
          >
            promote to prod
          </Button>
        </div>
      </header>

      {/* Agent score cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {recipe.agents.map((agent, i) => (
          <AgentScoreCard
            key={agent.id}
            agent={agent}
            isBaseline={i === 0}
            isWinner={agent.id === winner?.id}
            isWatch={watch ? agent.id === watch.id : false}
            isFocused={agent.id === focused}
            onClick={() => i > 0 && setFocused(agent.id)}
          />
        ))}
      </section>

      {/* Metrics table */}
      <section className="flex flex-col gap-3 rounded-md border border-hairline bg-surface-01">
        <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <Eyebrow className="text-ink-dim">METRICS · BASELINE vs CANDIDATES</Eyebrow>
          <div className="flex items-center gap-2">
            <span className="text-mono-sm uppercase tracking-tactical text-ink-dim">sort by</span>
            <NativeSelect
              value={sortBy}
              onChange={(e) => setSortBy((e.target as HTMLSelectElement).value)}
            >
              {metrics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-hairline text-mono-sm uppercase tracking-tactical text-ink-dim">
                <th className="px-4 py-2 font-normal">Metric</th>
                <th className="px-4 py-2 font-normal">
                  <span className="inline-flex items-center gap-1.5">
                    <CandidateHueDot hue="#9aa0a6" size="xs" />
                    baseline
                  </span>
                </th>
                {candidates.map((c) => (
                  <th key={c.id} className="px-4 py-2 font-normal">
                    <span className="inline-flex items-center gap-1.5">
                      <CandidateHueDot hue={c.hue} size="xs" />
                      {c.label}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-2 font-normal">Trend</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.id} className="border-b border-hairline/60">
                  <td className="px-4 py-2.5">
                    <div className="text-body-sm text-ink-hi">{m.label}</div>
                    <div className="text-mono-sm text-ink-dim">
                      {m.higher ? "higher is better" : "lower is better"}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Mono className="text-ink-hi">
                      {m.baseline}
                      {m.unit}
                    </Mono>
                  </td>
                  {candidates.map((c) => {
                    const v = m.rows[c.id];
                    if (v === undefined) {
                      return (
                        <td key={c.id} className="px-4 py-2.5">
                          <Mono tone="dim">—</Mono>
                        </td>
                      );
                    }
                    const delta = v - m.baseline;
                    return (
                      <td
                        key={c.id}
                        className={cx(
                          "px-4 py-2.5",
                          c.id === focused ? "bg-ember/[0.04]" : undefined,
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Mono className="text-ink-hi">
                            {v}
                            {m.unit}
                          </Mono>
                          <BacktestDelta value={delta} unit={m.unit} higherIsBetter={m.higher} />
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5">
                    <BacktestAnchorSparkline
                      values={backtestSparkline(
                        m.id.charCodeAt(0) * 7,
                        m.baseline,
                        m.baseline * 0.08,
                      )}
                      anchor={m.baseline}
                      width={88}
                      height={20}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Divergences */}
      <section className="flex flex-col gap-3 rounded-md border border-hairline bg-surface-01">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <Eyebrow className="text-ember">
            DIVERGENCES · {divergences.length} flagged · sorted by severity
          </Eyebrow>
          {onEditRecipe ? (
            <Button variant="ghost" onClick={onEditRecipe}>
              edit recipe
            </Button>
          ) : null}
        </header>
        <ul className="flex flex-col divide-y divide-hairline">
          {divergences.map((d) => (
            <DivergenceRow key={d.id} divergence={d} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function AgentScoreCard({
  agent,
  isBaseline,
  isWinner,
  isWatch,
  isFocused,
  onClick,
}: {
  agent: BacktestAgent;
  isBaseline: boolean;
  isWinner: boolean;
  isWatch: boolean;
  isFocused: boolean;
  onClick: () => void;
}) {
  const score = isBaseline
    ? "—"
    : agent.id === "support-v4.0"
      ? "+4.8"
      : agent.id === "support-v4.1"
        ? "+2.1"
        : "−0.4";
  const stats = {
    resolve:
      agent.id === "support-v3"
        ? "78.2%"
        : agent.id === "support-v4.0"
          ? "83.4%"
          : agent.id === "support-v4.1"
            ? "81.9%"
            : "85.1%",
    p95:
      agent.id === "support-v3"
        ? "18.4s"
        : agent.id === "support-v4.0"
          ? "16.1s"
          : agent.id === "support-v4.1"
            ? "19.8s"
            : "27.2s",
    cost:
      agent.id === "support-v3"
        ? "1.82¢"
        : agent.id === "support-v4.0"
          ? "1.78¢"
          : agent.id === "support-v4.1"
            ? "2.11¢"
            : "3.44¢",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      data-baseline={isBaseline || undefined}
      data-focused={isFocused || undefined}
      className={cx(
        "flex flex-col gap-3 rounded-md border bg-surface-01 p-3 text-left transition-colors",
        isWinner
          ? "border-event-green/40 bg-event-green/[0.04]"
          : isWatch
            ? "border-event-amber/40 bg-event-amber/[0.04]"
            : isFocused
              ? "border-ember/60"
              : "border-hairline hover:border-hairline-strong",
        isBaseline && "cursor-default opacity-90",
      )}
    >
      <div className="flex items-center gap-2">
        <CandidateHueDot hue={agent.hue} size="sm" />
        <span className="flex-1 text-body-sm text-ink-hi">{agent.label}</span>
        {isWinner ? (
          <Tag variant="green" className="uppercase">
            winner
          </Tag>
        ) : null}
        {isWatch ? (
          <Tag variant="amber" className="uppercase">
            needs review
          </Tag>
        ) : null}
        {isBaseline ? (
          <Tag variant="neutral" className="uppercase">
            baseline
          </Tag>
        ) : null}
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={cx(
            "font-display text-display-sm font-light tracking-tight",
            score === "—"
              ? "text-ink-dim"
              : score.startsWith("+")
                ? "text-event-green"
                : "text-event-red",
          )}
        >
          {score}
        </span>
        <span className="text-mono-sm uppercase tracking-tactical text-ink-dim">
          {isBaseline ? "reference" : "net score"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-hairline pt-2">
        <Stat label="RESOLVE" value={stats.resolve} />
        <Stat label="P95" value={stats.p95} />
        <Stat label="COST" value={stats.cost} />
      </div>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <Eyebrow className="text-ink-dim">{label}</Eyebrow>
      <Mono tone="hi">{value}</Mono>
    </div>
  );
}

function DivergenceRow({ divergence }: { divergence: BacktestDivergence }) {
  const d = divergence;
  return (
    <li className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto]">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityDot severity={d.severity} />
          <Mono size="sm" tone="lo">
            {d.id}
          </Mono>
          <BacktestToneTag tone={divergenceDeltaTone(d.delta)}>{d.delta}</BacktestToneTag>
          <span className="text-body-sm text-ink-lo">{d.cluster}</span>
          <span className="text-ink-dim">·</span>
          <Mono size="sm" tone="dim">
            {d.grader}
          </Mono>
        </div>
        <p className="text-body-sm text-ink">&ldquo;{d.prompt}&rdquo;</p>
        <p className="text-body-sm text-ink-lo">{d.note}</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <DivergenceSide title="BASELINE" side={d.baseline} />
        <ArrowRight className="size-4 text-ink-dim" strokeWidth={1.6} />
        <DivergenceSide
          title={(d.candidate.label ?? "candidate").toUpperCase()}
          side={d.candidate}
        />
      </div>
      <button
        type="button"
        className="self-start rounded-md border border-hairline px-2.5 py-1 text-body-sm text-ink-lo transition-colors hover:border-hairline-strong hover:text-ink-hi"
      >
        open →
      </button>
    </li>
  );
}

function DivergenceSide({
  title,
  side,
}: {
  title: string;
  side: BacktestDivergence["baseline"];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Eyebrow className="text-ink-dim">{title}</Eyebrow>
      <div className="flex items-center gap-2">
        <Tag variant={outcomeTagVariant(side.outcome)}>{outcomeLabel(side.outcome)}</Tag>
        <Mono size="sm" tone="dim">
          {side.turns}t · {side.latency}
        </Mono>
      </div>
      <p className="line-clamp-2 text-body-sm text-ink-lo">{side.verdict}</p>
    </div>
  );
}
