import type { EventEnvelopeDto } from "@/lib/events-manager-sse";
import type { TimelineEvent } from "./types";

export function eventEnvelopeToTimelineEvent(e: EventEnvelopeDto): TimelineEvent {
  const message =
    typeof e.payload?.text === "string" ? e.payload.text : undefined;
  return {
    id: e.event_id,
    source: e.source,
    type: e.event_type,
    occurredAt: e.occurred_at,
    actor: e.actor_name ?? e.actor_id,
    message,
    payload: e.payload as Record<string, unknown>,
    stream: undefined,
  };
}
