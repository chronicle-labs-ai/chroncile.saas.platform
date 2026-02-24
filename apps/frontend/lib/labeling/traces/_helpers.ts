/* ------------------------------------------------------------------ */
/*  Shared helpers for mock trace construction                         */
/* ------------------------------------------------------------------ */

import type {
  Trace,
  TraceEvent,
  AgentContextSnapshot,
  AutoActionAudit,
  HumanActionAudit,
} from "../types";

export const TENANT = "demo-tenant";

let _id = 0;
export const uid = () => `trace_${(++_id).toString().padStart(3, "0")}`;
export const eid = () => `evt_${Math.random().toString(36).slice(2, 10)}`;

export function offset(base: Date, minutes: number): string {
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}

export interface BuildTraceOpts {
  conversationId: string;
  agentId: string;
  agentContext: AgentContextSnapshot;
  events: TraceEvent[];
  status: Trace["status"];
  autoAudit: AutoActionAudit | null;
  confidence: number | null;
  humanAudit?: HumanActionAudit | null;
}

export function buildTrace(opts: BuildTraceOpts): Trace {
  const sorted = [...opts.events].sort(
    (a, b) =>
      new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );
  const sources = [...new Set(sorted.map((e) => e.source))];

  return {
    id: uid(),
    tenantId: TENANT,
    conversationId: opts.conversationId,
    agentId: opts.agentId,
    agentContext: opts.agentContext,
    status: opts.status,
    events: sorted,
    eventCount: sorted.length,
    sources,
    firstEventAt: sorted[0].occurred_at,
    lastEventAt: sorted[sorted.length - 1].occurred_at,
    autoAudit: opts.autoAudit,
    confidence: opts.confidence,
    humanAudit: opts.humanAudit ?? null,
    reviewedBy: opts.humanAudit ? "reviewer_01" : null,
    reviewedAt: opts.humanAudit ? new Date().toISOString() : null,
    createdAt: sorted[0].occurred_at,
    updatedAt: new Date().toISOString(),
  };
}
