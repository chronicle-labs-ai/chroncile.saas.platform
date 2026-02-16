"use client";

import type { TraceEvent, ActionAnnotation } from "@/lib/labeling/types";
import { EventCard } from "./EventCard";

interface EventTimelineProps {
  events: TraceEvent[];
  /** AI-generated annotations (keyed by event_id) */
  autoAnnotations?: ActionAnnotation[];
  /** Human annotations (keyed by event_id) */
  annotations?: ActionAnnotation[];
  /** Callback when a human annotation changes */
  onAnnotationChange?: (annotation: ActionAnnotation) => void;
}

function formatOffset(baseMs: number, eventMs: number): string {
  const mins = Math.round((eventMs - baseMs) / 60_000);
  if (mins === 0) return "T+0m";
  if (mins < 60) return `T+${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `T+${hrs}h${rem}m` : `T+${hrs}h`;
}

export function EventTimeline({
  events,
  autoAnnotations,
  annotations,
  onAnnotationChange,
}: EventTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-tertiary text-sm">
        No events in this trace
      </div>
    );
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  const baseMs = new Date(sorted[0].occurred_at).getTime();

  // Build lookup maps for O(1) access
  const autoMap = new Map(
    (autoAnnotations ?? []).map((a) => [a.event_id, a])
  );
  const humanMap = new Map(
    (annotations ?? []).map((a) => [a.event_id, a])
  );

  return (
    <div className="py-2">
      {sorted.map((event, idx) => (
        <EventCard
          key={event.event_id}
          event={event}
          offset={formatOffset(baseMs, new Date(event.occurred_at).getTime())}
          isFirst={idx === 0}
          isLast={idx === sorted.length - 1}
          autoAnnotation={autoMap.get(event.event_id)}
          annotation={humanMap.get(event.event_id)}
          onAnnotationChange={onAnnotationChange}
        />
      ))}
    </div>
  );
}
