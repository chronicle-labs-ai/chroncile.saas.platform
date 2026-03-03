import type { Trace } from "./types";

export interface TraceSummaryForNotification {
  id: string;
  conversationId: string;
  sources: string[];
  confidence: number | null;
  eventCount: number;
  firstEventAt: string;
  lastEventAt: string;
  incorrectActionsCount: number;
  shortId: string;
}

export function buildTraceSummaryForNotification(
  trace: Trace,
  customMessage?: string | null
): TraceSummaryForNotification & { customMessage?: string } {
  const incorrectActionsCount =
    trace.autoAudit?.instruction_violations_summary?.length ?? 0;
  return {
    id: trace.id,
    conversationId: trace.conversationId,
    sources: trace.sources ?? [],
    confidence: trace.confidence ?? null,
    eventCount: trace.eventCount ?? trace.events?.length ?? 0,
    firstEventAt: trace.firstEventAt,
    lastEventAt: trace.lastEventAt,
    incorrectActionsCount,
    shortId: trace.id.slice(-8),
    ...(customMessage ? { customMessage } : {}),
  };
}

export function formatConfidenceLabel(confidence: number | null): string {
  if (confidence === null) return "—";
  const pct = Math.round(confidence * 100);
  if (pct < 33) return `Low ${pct}%`;
  if (pct < 66) return `Medium ${pct}%`;
  return `High ${pct}%`;
}

export function formatDuration(firstEventAt: string, lastEventAt: string): string {
  const a = new Date(firstEventAt).getTime();
  const b = new Date(lastEventAt).getTime();
  const diffMs = Math.max(0, b - a);
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
