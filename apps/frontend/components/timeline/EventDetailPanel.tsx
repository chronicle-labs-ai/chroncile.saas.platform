"use client";

import type { TimelineEvent } from "./types";
import { TIMELINE_THEME } from "./constants";

export interface EventDetailPanelProps {
  event: TimelineEvent | null;
  className?: string;
}

export function EventDetailPanel({ event, className = "" }: EventDetailPanelProps) {
  if (!event) {
    return (
      <div
        className={className}
        style={{
          background: TIMELINE_THEME.bg_elevated,
          color: TIMELINE_THEME.text_muted,
          padding: 24,
          borderRadius: 6,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 120,
        }}
      >
        <span style={{ fontSize: 13 }}>Select an event to view details</span>
      </div>
    );
  }

  const path = `${event.source}/${event.type}`;
  const messagePreview =
    typeof event.message === "string"
      ? event.message.slice(0, 80) + (event.message.length > 80 ? "…" : "")
      : "";

  return (
    <div
      className={className}
      style={{
        background: TIMELINE_THEME.bg_elevated,
        color: TIMELINE_THEME.text_primary,
        padding: 16,
        borderRadius: 6,
        border: `1px solid ${TIMELINE_THEME.separator}`,
        fontSize: 12,
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <span style={{ color: TIMELINE_THEME.text_muted, textTransform: "uppercase", fontSize: 10 }}>Path</span>
        <div style={{ fontFamily: "monospace", color: TIMELINE_THEME.accent }}>{path}</div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <span style={{ color: TIMELINE_THEME.text_muted, textTransform: "uppercase", fontSize: 10 }}>Time</span>
        <div style={{ fontFamily: "monospace" }}>{new Date(event.occurredAt).toLocaleString()}</div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <span style={{ color: TIMELINE_THEME.text_muted, textTransform: "uppercase", fontSize: 10 }}>Actor</span>
        <div>{event.actor ?? "—"}</div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <span style={{ color: TIMELINE_THEME.text_muted, textTransform: "uppercase", fontSize: 10 }}>Source</span>
        <div>{event.source}</div>
      </div>
      {messagePreview ? (
        <div style={{ marginBottom: 8 }}>
          <span style={{ color: TIMELINE_THEME.text_muted, textTransform: "uppercase", fontSize: 10 }}>Message</span>
          <div style={{ color: TIMELINE_THEME.text_secondary }}>{messagePreview}</div>
        </div>
      ) : null}
      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: "pointer", color: TIMELINE_THEME.text_muted }}>Payload</summary>
        <pre
          style={{
            marginTop: 8,
            padding: 8,
            background: TIMELINE_THEME.bg_primary,
            borderRadius: 4,
            overflow: "auto",
            maxHeight: 200,
            fontSize: 11,
            fontFamily: "monospace",
          }}
        >
          {JSON.stringify(event.payload ?? {}, null, 2)}
        </pre>
      </details>
    </div>
  );
}
