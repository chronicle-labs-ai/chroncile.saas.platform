/**
 * Export mock traces as a JSON file compatible with the TimelinePanel viewer.
 *
 * Run:  npx tsx apps/frontend/lib/labeling/export-timeline-json.ts
 *
 * Outputs: apps/frontend/public/traces-timeline.json
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MOCK_TRACES } from "./traces";
import { getAgentProfile } from "./agents";
import type { Trace, TraceEvent } from "./types";

interface TimelineEvent {
  id: string;
  source: string;
  type: string;
  occurredAt: string;
  actor?: string;
  message?: string;
  payload?: Record<string, unknown>;
  stream?: string;
}

interface ExportedTrace {
  id: string;
  conversationId: string;
  agentId: string;
  agentName: string;
  workflowType: string;
  status: string;
  confidence: number | null;
  sources: string[];
  eventCount: number;
  firstEventAt: string;
  lastEventAt: string;

  agentContext: Trace["agentContext"];

  autoAudit: {
    overall_score: number;
    summary: string;
    critical_errors: string[];
    correction_summary: string;
    ood_score: Trace["autoAudit"] extends infer A
      ? A extends { ood_score: infer O }
        ? O
        : never
      : never;
    context_integrity: Trace["autoAudit"] extends infer A
      ? A extends { context_integrity: infer C }
        ? C
        : never
      : never;
    instruction_violations_summary: Trace["autoAudit"] extends infer A
      ? A extends { instruction_violations_summary: infer I }
        ? I
        : never
      : never;
    action_annotations: Trace["autoAudit"] extends infer A
      ? A extends { action_annotations: infer AA }
        ? AA
        : never
      : never;
  } | null;

  humanAudit: Trace["humanAudit"];

  events: TimelineEvent[];
}

function traceEventToTimeline(e: TraceEvent): TimelineEvent {
  return {
    id: e.event_id,
    source: e.source,
    type: e.event_type,
    occurredAt: e.occurred_at,
    actor: e.actor.name ?? e.actor.actor_id,
    message: e.message,
    payload: e.payload as Record<string, unknown> | undefined,
    stream: e.source,
  };
}

function exportTrace(t: Trace): ExportedTrace {
  const profile = getAgentProfile(t.agentId);

  return {
    id: t.id,
    conversationId: t.conversationId,
    agentId: t.agentId,
    agentName: profile?.name ?? t.agentId,
    workflowType: profile?.workflow_type ?? "unknown",
    status: t.status,
    confidence: t.confidence,
    sources: t.sources,
    eventCount: t.eventCount,
    firstEventAt: t.firstEventAt,
    lastEventAt: t.lastEventAt,
    agentContext: t.agentContext,
    autoAudit: t.autoAudit
      ? {
          overall_score: t.autoAudit.overall_score,
          summary: t.autoAudit.summary,
          critical_errors: t.autoAudit.critical_errors,
          correction_summary: t.autoAudit.correction_summary,
          ood_score: t.autoAudit.ood_score,
          context_integrity: t.autoAudit.context_integrity,
          instruction_violations_summary:
            t.autoAudit.instruction_violations_summary,
          action_annotations: t.autoAudit.action_annotations,
        }
      : null,
    humanAudit: t.humanAudit,
    events: t.events.map(traceEventToTimeline),
  };
}

const output = {
  generated_at: new Date().toISOString(),
  trace_count: MOCK_TRACES.length,
  traces: MOCK_TRACES.map(exportTrace),
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, "../../public/traces-timeline.json");

writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");

console.log(`Wrote ${MOCK_TRACES.length} traces → ${outPath}`);
