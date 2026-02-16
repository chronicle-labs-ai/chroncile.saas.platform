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
  AlpacaRow,
  ShareGPTRow,
  DPORow,
  ExportFormat,
} from "./types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Serialize trace events into a human-readable timeline string */
function serializeEvents(events: TraceEvent[]): string {
  if (events.length === 0) return "(empty trace)";

  const base = new Date(events[0].occurred_at).getTime();

  return events
    .map((e) => {
      const mins = Math.round(
        (new Date(e.occurred_at).getTime() - base) / 60_000
      );
      const actor =
        e.actor.name ??
        e.actor.actor_id;
      const role = e.actor.actor_type.charAt(0).toUpperCase() + e.actor.actor_type.slice(1);
      const body = e.message ?? JSON.stringify(e.payload ?? {});
      return `[T+${mins}m] ${role} (${actor}) via ${e.source}/${e.event_type}: ${body}`;
    })
    .join("\n");
}

/** Format action annotations as a readable audit output */
function serializeAnnotations(annotations: ActionAnnotation[]): string {
  if (annotations.length === 0) return "No actions annotated.";

  return annotations
    .map((a, i) => {
      const parts = [`Action ${i + 1} [${a.event_id}]: ${a.verdict.toUpperCase()}`];
      if (a.reasoning) parts.push(`  Reasoning: ${a.reasoning}`);
      if (a.should_have_done) parts.push(`  Should have done: ${a.should_have_done}`);
      return parts.join("\n");
    })
    .join("\n\n");
}

/** Build the human audit output string */
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
    parts.push(`Critical Errors:\n${audit.critical_errors.map((e) => `  - ${e}`).join("\n")}`);
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

/** Build the auto audit output string (for DPO rejected) */
function buildAutoAuditOutput(trace: Trace): string {
  const auto = trace.autoAudit;
  if (!auto) return "";

  const parts: string[] = [];

  parts.push("## Per-Action Audit");
  parts.push(serializeAnnotations(auto.action_annotations));

  parts.push("");
  parts.push("## Trace-Level Summary");
  parts.push(`Overall Agent Score: ${auto.overall_score}/5`);

  if (auto.critical_errors.length > 0) {
    parts.push(`Critical Errors:\n${auto.critical_errors.map((e) => `  - ${e}`).join("\n")}`);
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
/*  { instruction, input, output }                                     */
/* ------------------------------------------------------------------ */

const ALPACA_INSTRUCTION =
  "Audit the following agent actions in a customer support event trace. " +
  "For each agent/bot action, assess whether it was correct, partially correct, incorrect, or unnecessary, " +
  "and explain what should have been done. Then provide a trace-level summary with overall score (1-5), " +
  "critical errors, and a correction summary.";

function traceToAlpaca(trace: Trace): AlpacaRow {
  return {
    instruction: ALPACA_INSTRUCTION,
    input: serializeEvents(trace.events),
    output: buildAuditOutput(trace),
  };
}

/* ------------------------------------------------------------------ */
/*  ShareGPT format                                                    */
/*  { conversations: [{ from, value }] }                              */
/* ------------------------------------------------------------------ */

const SHAREGPT_SYSTEM =
  "You are an expert at auditing customer support agent actions across multi-system event traces " +
  "(Intercom, Slack, Stripe, GitHub). Given a trace of connected events, assess each agent/bot action " +
  "as correct, partially correct, incorrect, or unnecessary. Provide reasoning and what should have been " +
  "done differently. Then give a trace-level summary: overall agent score (1-5), critical errors, " +
  "and correction summary.";

function traceToShareGPT(trace: Trace): ShareGPTRow {
  return {
    conversations: [
      { from: "system", value: SHAREGPT_SYSTEM },
      {
        from: "human",
        value: `Audit the agent actions in this event trace:\n\n${serializeEvents(trace.events)}`,
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
/*  { prompt, chosen, rejected }                                       */
/*  Uses human audit as "chosen" and auto audit as "rejected"         */
/* ------------------------------------------------------------------ */

function traceToDPO(trace: Trace): DPORow | null {
  // DPO only makes sense when both human and auto audits exist AND they differ
  if (!trace.humanAudit || !trace.autoAudit) return null;

  const humanOutput = buildAuditOutput(trace);
  const autoOutput = buildAutoAuditOutput(trace);

  // Skip if audits are identical (no preference signal)
  if (humanOutput === autoOutput) return null;

  return {
    prompt: `Audit the agent actions in this customer support event trace:\n\n${serializeEvents(trace.events)}`,
    chosen: humanOutput,
    rejected: autoOutput,
  };
}

/* ------------------------------------------------------------------ */
/*  Main export function                                               */
/* ------------------------------------------------------------------ */

export function exportTraces(
  traces: Trace[],
  format: ExportFormat
): string {
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
      rows = labeled
        .map(traceToDPO)
        .filter((r): r is DPORow => r !== null);
      break;
    default:
      throw new Error(`Unknown export format: ${format}`);
  }

  // JSONL — one JSON object per line
  return rows.map((r) => JSON.stringify(r)).join("\n");
}
