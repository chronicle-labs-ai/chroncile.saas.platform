import type { EventEnvelopeDto } from "@/lib/events-manager-sse";
import type { TimelineEvent } from "./types";

export function eventEnvelopeToTimelineEvent(e: EventEnvelopeDto): TimelineEvent {
  const payload = (e.event.payload ?? {}) as Record<string, unknown>;
  const platform =
    payload["_platform"] && typeof payload["_platform"] === "object"
      ? (payload["_platform"] as Record<string, unknown>)
      : undefined;
  const actor =
    platform?.actor && typeof platform.actor === "object"
      ? (platform.actor as Record<string, unknown>)
      : undefined;
  const message =
    typeof payload.text === "string"
      ? payload.text
      : typeof payload.message === "string"
        ? payload.message
        : typeof payload.body === "string"
          ? payload.body
          : undefined;
  return {
    id: e.event.event_id,
    source: e.event.source,
    type: e.event.event_type,
    occurredAt: e.event.event_time,
    actor:
      (typeof actor?.name === "string" && actor.name) ||
      (typeof actor?.actor_id === "string" && actor.actor_id) ||
      undefined,
    message,
    payload,
    stream: e.event.topic,
  };
}
