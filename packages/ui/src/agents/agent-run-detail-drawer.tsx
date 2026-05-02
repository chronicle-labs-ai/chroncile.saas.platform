"use client";

import * as React from "react";
import { Hash, Search } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { Drawer } from "../primitives/drawer";
import { formatStableDateTime, RelativeTime } from "../connections/time";

import { AgentConfigHashChip } from "./agent-config-hash-chip";
import { AgentFrameworkBadge } from "./agent-framework-badge";
import { AgentModelLabel } from "./agent-model-label";
import { AgentVersionBadge } from "./agent-version-badge";
import { HashDomainChip } from "./hash-domain-chip";
import { RunStatusDot } from "./run-status-dot";
import { TokenUsageBar } from "./token-usage-bar";
import type { AgentRun, AgentSnapshot, AgentToolCall } from "./types";

/*
 * AgentRunDetailDrawer — overlay drawer for inspecting one run.
 * Shows everything the registry records:
 *
 *   - Run identity: runId, configHash, artifactId, status, time
 *   - Effective call (preparedCall hash, activeTools, providerOptions)
 *   - Response: modelId resolved, bodyHash, finishReason, usage
 *   - Provider observation: providerMetadata, modelMetadata
 *   - Operational: headers (request id, processing-ms, service tier)
 *   - Tool call timeline: per call args/result/duration/status
 *   - Trace metadata: userId, environment
 *   - Errors (when present)
 *
 * Mirrors `DatasetTraceDetailDrawer` in placement and density.
 */

export interface AgentRunDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  run: AgentRun | null;
  snapshot: AgentSnapshot;
  onOpenHashSearch?: (hint?: string) => void;
}

export function AgentRunDetailDrawer({
  isOpen,
  onClose,
  run,
  snapshot,
  onOpenHashSearch,
}: AgentRunDetailDrawerProps) {
  if (!run) return null;

  const artifact = snapshot.versions.find(
    (v) => v.artifact.artifactId === run.artifactId,
  )?.artifact;
  const version = run.artifactId.split("@")[1] ?? run.artifactId;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      density="compact"
      placement="right"
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <RunStatusDot status={run.status} />
          <span className="truncate font-mono text-[12px] text-l-ink">
            {run.runId}
          </span>
          <AgentVersionBadge version={version} />
          {artifact ? (
            <AgentFrameworkBadge framework={artifact.framework} />
          ) : null}
        </div>
      }
      actions={
        onOpenHashSearch ? (
          <div className="flex items-center justify-between gap-2">
            <Button
              density="compact"
              variant="secondary"
              size="sm"
              onPress={() => onOpenHashSearch(run.runId)}
              leadingIcon={<Search className="size-3.5" strokeWidth={1.75} />}
            >
              Find related hashes
            </Button>
            <Button
              density="compact"
              variant="ghost"
              size="sm"
              onPress={onClose}
            >
              Close
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <Section title="Identity">
          <KvList
            rows={[
              {
                label: "Status",
                value: (
                  <span
                    className={cx(
                      "capitalize",
                      run.status === "success"
                        ? "text-event-green"
                        : run.status === "error"
                          ? "text-event-red"
                          : "text-event-amber",
                    )}
                  >
                    {run.status}
                  </span>
                ),
              },
              {
                label: "Operation",
                value: <span className="capitalize">{run.operation}</span>,
              },
              {
                label: "Started",
                value: (
                  <span>
                    {formatStableDateTime(run.startedAt)}
                    <span className="ml-2 text-l-ink-dim">
                      <RelativeTime iso={run.startedAt} />
                    </span>
                  </span>
                ),
              },
              {
                label: "Duration",
                value: run.durationMs != null ? formatMs(run.durationMs) : "—",
              },
              {
                label: "Artifact",
                value: (
                  <span className="font-mono">{run.artifactId}</span>
                ),
              },
              {
                label: "Config hash",
                value: <AgentConfigHashChip hash={run.configHash} />,
              },
              {
                label: "Input hash",
                value: run.inputHash ? (
                  <AgentConfigHashChip hash={run.inputHash} />
                ) : (
                  <Empty />
                ),
              },
              {
                label: "Call options hash",
                value: run.callOptionsHash ? (
                  <AgentConfigHashChip hash={run.callOptionsHash} />
                ) : (
                  <Empty />
                ),
              },
            ]}
          />
        </Section>

        {run.preparedCall ? (
          <Section title="Effective call">
            <span className="mb-1 block">
              <HashDomainChip domain="effective.run" inline />
            </span>
            <KvList
              rows={[
                {
                  label: "Prepared call hash",
                  value: <AgentConfigHashChip hash={run.preparedCall.hash} />,
                },
                {
                  label: "Active tools",
                  value:
                    run.preparedCall.activeTools &&
                    run.preparedCall.activeTools.length > 0 ? (
                      <span className="flex flex-wrap items-center gap-1">
                        {run.preparedCall.activeTools.map((t) => (
                          <span
                            key={t}
                            className="rounded-[3px] border border-l-border-faint bg-l-surface-input px-1.5 py-[2px] font-mono text-[11px] text-l-ink-lo"
                          >
                            {t}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <Empty />
                    ),
                },
                {
                  label: "Provider options hash",
                  value: run.preparedCall.providerOptionsHash ? (
                    <AgentConfigHashChip
                      hash={run.preparedCall.providerOptionsHash}
                    />
                  ) : (
                    <Empty />
                  ),
                },
              ]}
            />
          </Section>
        ) : null}

        <Section title="Response">
          <span className="mb-1 flex items-center gap-1.5">
            <HashDomainChip domain="output" inline />
            <HashDomainChip domain="provider.observation" inline />
          </span>
          <KvList
            rows={[
              {
                label: "Resolved model",
                value: artifact ? (
                  <AgentModelLabel
                    model={artifact.model}
                    resolvedModelId={run.response?.modelId}
                    size="xs"
                  />
                ) : (
                  <span className="font-mono">
                    {run.response?.modelId ?? "—"}
                  </span>
                ),
              },
              {
                label: "Response id",
                value: run.response?.id ? (
                  <span className="font-mono">{run.response.id}</span>
                ) : (
                  <Empty />
                ),
              },
              {
                label: "Finish reason",
                value: <span>{run.response?.finishReason ?? "—"}</span>,
              },
              {
                label: "Body hash",
                value: run.response?.bodyHash ? (
                  <AgentConfigHashChip hash={run.response.bodyHash} />
                ) : (
                  <Empty />
                ),
              },
            ]}
          />
          <div className="mt-3">
            <span className="mb-1.5 block font-sans text-[12px] text-l-ink-dim">
              Token usage
            </span>
            <TokenUsageBar usage={run.response?.usage} variant="detailed" />
          </div>
          {run.response?.providerMetadata ||
          run.response?.modelMetadata ? (
            <div className="mt-3">
              <span className="mb-1.5 block font-sans text-[12px] text-l-ink-dim">
                Provider metadata
              </span>
              <pre className="overflow-x-auto rounded-[3px] bg-l-surface-input px-2 py-1.5 font-mono text-[11px] leading-snug text-l-ink-lo">
                {JSON.stringify(
                  {
                    providerMetadata: run.response.providerMetadata,
                    modelMetadata: run.response.modelMetadata,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          ) : null}
        </Section>

        <Section title="Operational">
          <span className="mb-1 block">
            <HashDomainChip domain="operational" inline />
          </span>
          {run.response?.headers && Object.keys(run.response.headers).length > 0 ? (
            <dl className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {Object.entries(run.response.headers)
                .filter(([key]) => INTERESTING_HEADERS.has(key))
                .map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-baseline gap-2 font-sans text-[11px]"
                  >
                    <dt className="shrink-0 text-l-ink-dim">{key}</dt>
                    <dd className="truncate font-mono text-l-ink-lo">
                      {value}
                    </dd>
                  </div>
                ))}
            </dl>
          ) : (
            <Empty>No headers captured.</Empty>
          )}
        </Section>

        <Section title={`Tool calls (${run.toolCalls.length})`}>
          {run.toolCalls.length === 0 ? (
            <Empty>This run did not invoke any tools.</Empty>
          ) : (
            <ol className="flex flex-col gap-2">
              {run.toolCalls.map((call) => (
                <ToolCallRow key={call.callId} call={call} />
              ))}
            </ol>
          )}
        </Section>

        {run.trace ? (
          <Section title="Trace">
            <KvList
              rows={Object.entries(run.trace).map(([key, value]) => ({
                label: capitalize(key),
                value: <span>{String(value)}</span>,
              }))}
            />
          </Section>
        ) : null}

        {run.error ? (
          <Section title="Error">
            <div className="rounded-[3px] border border-event-red/30 bg-event-red/[0.05] p-2.5">
              <div className="font-sans text-[11px] font-medium text-event-red">
                {run.error.name ?? "Error"}
              </div>
              <p className="mt-1 font-sans text-[12px] leading-snug text-l-ink-lo">
                {run.error.message}
              </p>
              {run.error.stack ? (
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-l-ink-dim">
                  {run.error.stack}
                </pre>
              ) : null}
            </div>
          </Section>
        ) : null}
      </div>
    </Drawer>
  );
}

const INTERESTING_HEADERS = new Set([
  "x-request-id",
  "openai-processing-ms",
  "openai-organization",
  "openai-project",
  "openai-version",
  "x-ratelimit-remaining-requests",
  "x-ratelimit-remaining-tokens",
  "cf-ray",
  "date",
  "content-type",
]);

function Section({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-sans text-[13px] font-medium text-l-ink">{title}</h3>
      <div className="rounded-[4px] border border-l-border bg-l-surface-raised p-3">
        {children}
      </div>
    </section>
  );
}

interface KvListRow {
  label: React.ReactNode;
  value: React.ReactNode;
}

/**
 * Linear-style metadata rail — left column labels in `--l-ink-dim`,
 * right column values in `--l-ink-lo`/`--l-ink`. Inter regular for
 * labels, no uppercase tracking. Mirrors the right sidebar pattern
 * on Linear's issue page.
 */
function KvList({ rows }: { rows: readonly KvListRow[] }) {
  return (
    <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-1.5">
      {rows.map((row, index) => (
        <React.Fragment key={index}>
          <dt className="font-sans text-[12px] text-l-ink-dim">{row.label}</dt>
          <dd className="min-w-0 font-sans text-[12px] text-l-ink-lo">
            {row.value}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function Empty({ children }: { children?: React.ReactNode }) {
  return (
    <span className="font-sans text-[12px] text-l-ink-dim">
      {children ?? "—"}
    </span>
  );
}

function ToolCallRow({ call }: { call: AgentToolCall }) {
  return (
    <li
      data-status={call.status}
      className={cx(
        "flex flex-col gap-2 rounded-[3px] border border-l-border-faint bg-l-surface-input/40 px-3 py-2.5",
        call.status === "error" && "border-event-red/30 bg-event-red/[0.04]",
      )}
    >
      <div className="flex items-center gap-2">
        <RunStatusDot status={call.status} />
        <span className="font-sans text-[13px] font-medium text-l-ink">
          {call.toolName}
        </span>
        <span className="ml-auto flex items-center gap-1 font-sans text-[11px] text-l-ink-dim">
          <span>{call.durationMs != null ? formatMs(call.durationMs) : "—"}</span>
          <span aria-hidden>·</span>
          <Hash className="inline size-3" strokeWidth={1.75} />
          <span className="font-mono">{call.callId.slice(0, 8)}</span>
        </span>
      </div>
      <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-1.5">
        {call.argsHash ? (
          <>
            <dt className="font-sans text-[11px] text-l-ink-dim">args</dt>
            <dd>
              <AgentConfigHashChip hash={call.argsHash} tone="subtle" />
            </dd>
          </>
        ) : null}
        {call.resultHash ? (
          <>
            <dt className="font-sans text-[11px] text-l-ink-dim">result</dt>
            <dd>
              <AgentConfigHashChip hash={call.resultHash} tone="subtle" />
            </dd>
          </>
        ) : null}
        {call.argsPreview ? (
          <>
            <dt className="font-sans text-[11px] text-l-ink-dim">preview</dt>
            <dd>
              <pre className="overflow-x-auto rounded-[3px] bg-l-surface-input px-2 py-1.5 font-mono text-[11px] leading-snug text-l-ink-lo">
                {JSON.stringify(call.argsPreview, null, 2)}
              </pre>
            </dd>
          </>
        ) : null}
        {call.error ? (
          <>
            <dt className="font-sans text-[11px] text-event-red">error</dt>
            <dd className="font-sans text-[12px] text-event-red">
              {call.error.message}
            </dd>
          </>
        ) : null}
      </dl>
      <span className="font-sans text-[11px] text-l-ink-dim">
        started {formatStableDateTime(call.startedAt)}
      </span>
    </li>
  );
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** "userId" → "User id", "environment" → "Environment". */
function capitalize(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase())
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}
