/* ------------------------------------------------------------------ */
/*  Labeling system types                                              */
/*  Chronicle OOD + Context Integrity Detection — per-action           */
/*  annotations, detection layer results, and export formats           */
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
  message?: string;
  payload?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Agent profile types                                                */
/* ------------------------------------------------------------------ */

export interface InstructionRule {
  id: string;        // e.g., "R1", "R2"
  text: string;
  category: string;  // "verification", "policy", "communication", etc.
}

export interface RequiredContextField {
  field: string;
  description: string;
  source: string;    // where this data should come from
}

export interface AgentProfile {
  id: string;
  name: string;
  workflow_type: string;
  description: string;
  instructions: InstructionRule[];
  required_context_fields: RequiredContextField[];
  tools_available: string[];
}

/* ------------------------------------------------------------------ */
/*  Agent context snapshot                                             */
/* ------------------------------------------------------------------ */

export interface StaleField {
  field: string;
  value_in_context: unknown;
  correct_value: unknown;
  source: string;
}

export interface AgentContextSnapshot {
  fields: Record<string, unknown>;
  missing_fields: string[];
  stale_fields: StaleField[];
}

/* ------------------------------------------------------------------ */
/*  OOD scoring                                                        */
/* ------------------------------------------------------------------ */

export interface OODScoreBreakdown {
  transition_deviation: number;       // 0-1
  tool_frequency_deviation: number;   // 0-1
  temporal_deviation: number;         // 0-1
  embedding_distance: number;         // 0-1
  composite_score: number;            // weighted sum
  flagged: boolean;
}

/* ------------------------------------------------------------------ */
/*  Context integrity violations                                       */
/* ------------------------------------------------------------------ */

export type ContextViolationType =
  | "missing_field"
  | "stale_value"
  | "data_mismatch"
  | "event_context_inconsistency";

export interface ContextIntegrityViolation {
  type: ContextViolationType;
  field: string;
  description: string;
  expected?: unknown;
  actual?: unknown;
  severity: "critical" | "warning";
}

/* ------------------------------------------------------------------ */
/*  Instruction violations                                             */
/* ------------------------------------------------------------------ */

export interface InstructionViolation {
  instruction_id: string;          // e.g., "R3"
  instruction_text: string;
  violation_description: string;
  context_evidence?: string;
}

/* ------------------------------------------------------------------ */
/*  Action annotation types (per-event audit)                          */
/* ------------------------------------------------------------------ */

export type ActionVerdict = "correct" | "partial" | "incorrect" | "unnecessary";

export interface ActionAnnotation {
  event_id: string;
  verdict: ActionVerdict;
  should_have_done?: string;
  reasoning?: string;
  instruction_violations?: InstructionViolation[];
  context_violations?: ContextIntegrityViolation[];
}

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
  action_annotations: ActionAnnotation[];
  overall_score: number;          // 1-5
  critical_errors: string[];
  correction_summary: string;
  summary: string;
  confidence: number;             // 0.0-1.0

  ood_score: OODScoreBreakdown;
  context_integrity: {
    violations: ContextIntegrityViolation[];
    passed: boolean;
  };
  instruction_violations_summary: InstructionViolation[];
}

/* ------------------------------------------------------------------ */
/*  Human action audit                                                 */
/* ------------------------------------------------------------------ */

export interface HumanActionAudit {
  action_annotations: ActionAnnotation[];
  overall_score: number;
  critical_errors: string[];
  correction_summary: string;
  notes: string;
}

/* ------------------------------------------------------------------ */
/*  Trace                                                              */
/* ------------------------------------------------------------------ */

export type TraceStatus =
  | "pending"
  | "auto_labeled"
  | "in_review"
  | "labeled"
  | "skipped";

export interface Trace {
  id: string;
  tenantId: string;
  conversationId: string;
  agentId: string;
  agentContext: AgentContextSnapshot;
  status: TraceStatus;
  events: TraceEvent[];
  eventCount: number;
  sources: string[];
  firstEventAt: string;
  lastEventAt: string;
  autoAudit: AutoActionAudit | null;
  confidence: number | null;
  humanAudit: HumanActionAudit | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TraceSummary = Omit<Trace, "events">;

/* ------------------------------------------------------------------ */
/*  Filter / query types                                               */
/* ------------------------------------------------------------------ */

export interface TraceFilters {
  status?: TraceStatus;
  source?: string;
  agentId?: string;
  minConfidence?: number;
  maxConfidence?: number;
  search?: string;
  sortBy?: "confidence" | "date" | "events" | "ood";
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
