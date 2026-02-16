/* ------------------------------------------------------------------ */
/*  Labeling system types                                              */
/*  Agent action audit for LLM training — per-action annotations,     */
/*  trace-level audit summaries, and export formats                    */
/* ------------------------------------------------------------------ */

/** A single event within a trace (matches EventEnvelope shape) */
export interface TraceEvent {
  event_id: string;
  source: string; // "intercom", "slack", "stripe", "github"
  event_type: string; // "message.received", "charge.retrieved", etc.
  occurred_at: string; // ISO timestamp
  actor: {
    actor_type: "customer" | "agent" | "system" | "manager";
    actor_id: string;
    name?: string;
  };
  message?: string; // Human-readable summary / body
  payload?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Action annotation types (per-event audit)                          */
/* ------------------------------------------------------------------ */

/** Possible verdicts for an agent/system action */
export type ActionVerdict = "correct" | "partial" | "incorrect" | "unnecessary";

/** Per-action annotation (attached to agent/system events) */
export interface ActionAnnotation {
  event_id: string; // which event this annotates
  verdict: ActionVerdict;
  should_have_done?: string; // free text: what the ideal action was
  reasoning?: string; // why this verdict
}

/** Verdict options for UI dropdowns */
export const ACTION_VERDICTS = [
  { value: "correct", label: "Correct", color: "nominal" },
  { value: "partial", label: "Partially Correct", color: "caution" },
  { value: "incorrect", label: "Incorrect", color: "critical" },
  { value: "unnecessary", label: "Unnecessary", color: "neutral" },
] as const;

/* ------------------------------------------------------------------ */
/*  Auto-generated action audit (simulated AI output)                  */
/* ------------------------------------------------------------------ */

export interface AutoActionAudit {
  action_annotations: ActionAnnotation[]; // one per agent/system event
  overall_score: number; // 1-5
  critical_errors: string[]; // list of significant mistakes
  correction_summary: string; // what should have been done differently
  summary: string; // brief trace description
  confidence: number; // 0.0-1.0
}

/* ------------------------------------------------------------------ */
/*  Human action audit (replaces humanLabels)                          */
/* ------------------------------------------------------------------ */

export interface HumanActionAudit {
  action_annotations: ActionAnnotation[];
  overall_score: number; // 1-5
  critical_errors: string[];
  correction_summary: string;
  notes: string;
}

/* ------------------------------------------------------------------ */
/*  Trace                                                              */
/* ------------------------------------------------------------------ */

/** Trace statuses */
export type TraceStatus =
  | "pending"
  | "auto_labeled"
  | "in_review"
  | "labeled"
  | "skipped";

/** Full trace record */
export interface Trace {
  id: string;
  tenantId: string;
  conversationId: string;
  status: TraceStatus;
  events: TraceEvent[];
  eventCount: number;
  sources: string[]; // unique sources in this trace
  firstEventAt: string;
  lastEventAt: string;
  autoAudit: AutoActionAudit | null;
  confidence: number | null; // 0.0 - 1.0 overall
  humanAudit: HumanActionAudit | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Summary returned by the queue list (no events payload) */
export type TraceSummary = Omit<Trace, "events">;

/* ------------------------------------------------------------------ */
/*  Filter / query types                                               */
/* ------------------------------------------------------------------ */

export interface TraceFilters {
  status?: TraceStatus;
  source?: string;
  minConfidence?: number;
  maxConfidence?: number;
  search?: string;
  sortBy?: "confidence" | "date" | "events";
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface TraceStats {
  total: number;
  pending: number;
  autoLabeled: number;
  inReview: number;
  labeled: number;
  skipped: number;
  avgConfidence: number;
  labeledToday: number;
}

/* ------------------------------------------------------------------ */
/*  Export format types                                                 */
/* ------------------------------------------------------------------ */

export type ExportFormat = "alpaca" | "sharegpt" | "dpo";

export interface AlpacaRow {
  instruction: string;
  input: string;
  output: string;
}

export interface ShareGPTRow {
  conversations: Array<{ from: "system" | "human" | "gpt"; value: string }>;
}

export interface DPORow {
  prompt: string;
  chosen: string;
  rejected: string;
}
