/* ------------------------------------------------------------------ */
/*  Export labeled traces to industry-standard LLM training formats    */
/*                                                                     */
/*  Supported:                                                         */
/*    - Alpaca JSONL  (SFT — instruction tuning)                       */
/*    - ShareGPT JSONL (multi-turn conversation fine-tuning)           */
/*    - DPO JSONL (preference pair training)                           */
/* ------------------------------------------------------------------ */

import type {
  Trace,
  TraceEvent,
  ActionAnnotation,
  InstructionViolation,
  ContextIntegrityViolation,
  OODScoreBreakdown,
  AlpacaRow,
  ShareGPTRow,
  DPORow,
  ExportFormat,
} from "./types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function serializeEvents(events: TraceEvent[]): string {
  if (events.length === 0) return "(empty trace)";

  const base = new Date(events[0].occurred_at).getTime();

  return events
    .map((e) => {
      const mins = Math.round(
        (new Date(e.occurred_at).getTime() - base) / 60_000
      );
      const actor = e.actor.name ?? e.actor.actor_id;
      const role =
        e.actor.actor_type.charAt(0).toUpperCase() +
        e.actor.actor_type.slice(1);
      const body = e.message ?? JSON.stringify(e.payload ?? {});
      return `[T+${mins}m] ${role} (${actor}) via ${e.source}/${e.event_type}: ${body}`;
    })
    .join("\n");
}

function serializeAnnotations(annotations: ActionAnnotation[]): string {
  if (annotations.length === 0) return "No actions annotated.";

  return annotations
    .map((a, i) => {
      const parts = [
        `Action ${i + 1} [${a.event_id}]: ${a.verdict.toUpperCase()}`,
      ];
      if (a.reasoning) parts.push(`  Reasoning: ${a.reasoning}`);
      if (a.should_have_done)
        parts.push(`  Should have done: ${a.should_have_done}`);
      if (a.instruction_violations?.length) {
        for (const iv of a.instruction_violations) {
          parts.push(
            `  Instruction Violation [${iv.instruction_id}]: ${iv.violation_description}`
          );
          if (iv.context_evidence)
            parts.push(`    Evidence: ${iv.context_evidence}`);
        }
      }
      if (a.context_violations?.length) {
        for (const cv of a.context_violations) {
          parts.push(
            `  Context Violation (${cv.type}): ${cv.description} [${cv.severity}]`
          );
        }
      }
      return parts.join("\n");
    })
    .join("\n\n");
}

function serializeOODScore(ood: OODScoreBreakdown): string {
  const parts = [
    `OOD Composite Score: ${ood.composite_score.toFixed(2)} (${ood.flagged ? "FLAGGED" : "normal"})`,
    `  Transition: ${ood.transition_deviation.toFixed(2)}`,
    `  Tool Frequency: ${ood.tool_frequency_deviation.toFixed(2)}`,
    `  Temporal: ${ood.temporal_deviation.toFixed(2)}`,
    `  Embedding: ${ood.embedding_distance.toFixed(2)}`,
  ];
  return parts.join("\n");
}

function serializeContextIntegrity(
  violations: ContextIntegrityViolation[]
): string {
  if (violations.length === 0) return "Context Integrity: PASSED";
  const lines = [
    `Context Integrity: FAILED (${violations.length} violation${violations.length > 1 ? "s" : ""})`,
  ];
  for (const v of violations) {
    lines.push(`  - [${v.severity}] ${v.type}: ${v.description}`);
  }
  return lines.join("\n");
}

function serializeInstructionViolations(
  violations: InstructionViolation[]
): string {
  if (violations.length === 0) return "Instruction Violations: None";
  const lines = [`Instruction Violations (${violations.length}):`];
  for (const v of violations) {
    lines.push(`  - [${v.instruction_id}] "${v.instruction_text}"`);
    lines.push(`    ${v.violation_description}`);
    if (v.context_evidence) lines.push(`    Evidence: ${v.context_evidence}`);
  }
  return lines.join("\n");
}

function buildAuditOutput(trace: Trace): string {
  const audit = trace.humanAudit;
  if (!audit) return "";

  const parts: string[] = [];

  parts.push("## Per-Action Audit");
  parts.push(serializeAnnotations(audit.action_annotations));

  parts.push("");
  parts.push("## Trace-Level Summary");
  parts.push(`Overall Agent Score: ${audit.overall_score}/5`);

  if (audit.critical_errors.length > 0) {
    parts.push(
      `Critical Errors:\n${audit.critical_errors.map((e) => `  - ${e}`).join("\n")}`
    );
  } else {
    parts.push("Critical Errors: None");
  }

  if (audit.correction_summary) {
    parts.push(`Correction Summary: ${audit.correction_summary}`);
  }

  if (audit.notes) {
    parts.push(`Reviewer Notes: ${audit.notes}`);
  }

  return parts.join("\n");
}

function buildAutoAuditOutput(trace: Trace): string {
  const auto = trace.autoAudit;
  if (!auto) return "";

  const parts: string[] = [];

  parts.push("## Per-Action Audit");
  parts.push(serializeAnnotations(auto.action_annotations));

  parts.push("");
  parts.push("## Detection Layers");
  parts.push(serializeOODScore(auto.ood_score));
  parts.push(serializeContextIntegrity(auto.context_integrity.violations));
  parts.push(
    serializeInstructionViolations(auto.instruction_violations_summary)
  );

  parts.push("");
  parts.push("## Trace-Level Summary");
  parts.push(`Overall Agent Score: ${auto.overall_score}/5`);

  if (auto.critical_errors.length > 0) {
    parts.push(
      `Critical Errors:\n${auto.critical_errors.map((e) => `  - ${e}`).join("\n")}`
    );
  } else {
    parts.push("Critical Errors: None");
  }

  if (auto.correction_summary) {
    parts.push(`Correction Summary: ${auto.correction_summary}`);
  }

  parts.push(`Summary: ${auto.summary}`);

  return parts.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Alpaca format                                                      */
/* ------------------------------------------------------------------ */

const ALPACA_INSTRUCTION =
  "Audit the following AI agent actions in a customer support event trace. " +
  "For each agent action, assess whether it was correct, partially correct, incorrect, or unnecessary. " +
  "Identify any instruction violations (referencing specific SOP rules), context integrity failures " +
  "(missing fields, stale data, data mismatches), and behavioral anomalies (OOD scores). " +
  "Then provide a trace-level summary with overall score (1-5), critical errors, and a correction summary.";

function traceToAlpaca(trace: Trace): AlpacaRow {
  return {
    instruction: ALPACA_INSTRUCTION,
    input: serializeEvents(trace.events),
    output: buildAuditOutput(trace),
  };
}

/* ------------------------------------------------------------------ */
/*  ShareGPT format                                                    */
/* ------------------------------------------------------------------ */

const SHAREGPT_SYSTEM =
  "You are an expert at auditing AI customer support agent actions across multi-system event traces " +
  "(Intercom, Slack, Stripe, GitHub). Given a trace, assess each agent action as correct, partially correct, " +
  "incorrect, or unnecessary. Check for: instruction violations (referencing specific SOP rules the agent should follow), " +
  "context integrity failures (missing required fields, stale values, data mismatches between events and agent context), " +
  "and behavioral anomalies (unusual tool usage, transition patterns, or timing). " +
  "Provide a trace-level summary: overall agent score (1-5), critical errors, and correction summary.";

function traceToShareGPT(trace: Trace): ShareGPTRow {
  return {
    conversations: [
      { from: "system", value: SHAREGPT_SYSTEM },
      {
        from: "human",
        value: `Audit the AI agent actions in this event trace:\n\n${serializeEvents(trace.events)}`,
      },
      {
        from: "gpt",
        value: buildAuditOutput(trace),
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  DPO format                                                         */
/*  Uses human audit as "chosen" and auto audit as "rejected"         */
/* ------------------------------------------------------------------ */

function traceToDPO(trace: Trace): DPORow | null {
  if (!trace.humanAudit || !trace.autoAudit) return null;

  const humanOutput = buildAuditOutput(trace);
  const autoOutput = buildAutoAuditOutput(trace);

  if (humanOutput === autoOutput) return null;

  return {
    prompt: `Audit the AI agent actions in this customer support event trace:\n\n${serializeEvents(trace.events)}`,
    chosen: humanOutput,
    rejected: autoOutput,
  };
}

/* ------------------------------------------------------------------ */
/*  Main export function                                               */
/* ------------------------------------------------------------------ */

export function exportTraces(traces: Trace[], format: ExportFormat): string {
  const labeled = traces.filter((t) => t.status === "labeled");

  let rows: unknown[];

  switch (format) {
    case "alpaca":
      rows = labeled.map(traceToAlpaca);
      break;
    case "sharegpt":
      rows = labeled.map(traceToShareGPT);
      break;
    case "dpo":
      rows = labeled.map(traceToDPO).filter((r): r is DPORow => r !== null);
      break;
    default:
      throw new Error(`Unknown export format: ${format}`);
  }

  return rows.map((r) => JSON.stringify(r)).join("\n");
}
