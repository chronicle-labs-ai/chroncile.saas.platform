"use client";

import React, { useCallback, useState } from "react";
import type { Stream, RecordingState, StreamId } from "./types";
import {
  REC_IDLE,
  REC_SELECTING,
  recRecording,
  recPendingSave,
} from "./types";
import { TIMELINE_THEME } from "@/components/timeline/constants";

const LIVE_API_STREAM_ID = "live-api";

const defaultStreams: Stream[] = [
  {
    id: LIVE_API_STREAM_ID,
    name: "Live API",
    enabled: true,
    status: "online",
    kind: "LiveApi",
    event_count: 0,
  },
];

export interface StreamsPanelProps {
  recordingState: RecordingState;
  streams?: Stream[];
  onRecordingStateChange: (state: RecordingState) => void;
  onSaveRecordingRequested?: () => void;
  onRecordEvent?: (streamId: StreamId) => void;
  className?: string;
}

export function StreamsPanel({
  recordingState,
  streams = defaultStreams,
  onRecordingStateChange,
  onSaveRecordingRequested,
  className = "",
}: StreamsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [streamsToRecord, setStreamsToRecord] = useState<Set<StreamId>>(
    new Set(streams.filter((s) => s.enabled).map((s) => s.id))
  );

  const startSelecting = useCallback(() => {
    setStreamsToRecord(new Set(streams.filter((s) => s.enabled).map((s) => s.id)));
    onRecordingStateChange(REC_SELECTING);
  }, [streams, onRecordingStateChange]);

  const startRecording = useCallback(() => {
    const ids = Array.from(streamsToRecord);
    onRecordingStateChange(recRecording(Date.now(), 0, ids));
  }, [streamsToRecord, onRecordingStateChange]);

  const stopRecording = useCallback(() => {
    if (recordingState.kind !== "Recording") return;
    const durationSecs = Math.round((Date.now() - recordingState.startedAt) / 1000);
    onRecordingStateChange(
      recPendingSave(
        recordingState.eventCount,
        durationSecs,
        recordingState.recordingStreamIds
      )
    );
  }, [recordingState, onRecordingStateChange]);

  const saveRecording = useCallback(() => {
    if (recordingState.kind !== "PendingSave") return;
    onSaveRecordingRequested?.();
    onRecordingStateChange(REC_IDLE);
  }, [recordingState, onSaveRecordingRequested, onRecordingStateChange]);

  const discardRecording = useCallback(() => {
    onRecordingStateChange(REC_IDLE);
  }, [onRecordingStateChange]);

  const cancelSelecting = useCallback(() => {
    onRecordingStateChange(REC_IDLE);
  }, [onRecordingStateChange]);

  const toggleStreamForRecord = useCallback((id: StreamId) => {
    setStreamsToRecord((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div
      className={className}
      style={{
        background: TIMELINE_THEME.bg_surface,
        border: `1px solid ${TIMELINE_THEME.separator}`,
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: TIMELINE_THEME.bg_elevated,
          border: "none",
          color: TIMELINE_THEME.text_primary,
          cursor: "pointer",
          fontSize: 12,
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: TIMELINE_THEME.text_muted }}>STREAMS</span>
        <span>{collapsed ? "▶" : "▼"}</span>
      </button>

      {!collapsed && (
        <>
          <div
            style={{
              padding: 12,
              borderBottom: `1px solid ${TIMELINE_THEME.separator}`,
            }}
          >
            {recordingState.kind === "Idle" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={startSelecting}
                  style={{
                    background: TIMELINE_THEME.button_bg,
                    color: TIMELINE_THEME.text_secondary,
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  ⏺ REC
                </button>
                <span style={{ fontSize: 11, color: TIMELINE_THEME.text_muted }}>
                  Record events to file
                </span>
              </div>
            )}

            {recordingState.kind === "SelectingStreams" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 11, color: TIMELINE_THEME.text_muted }}>
                  📼 Select streams to record
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {streams.map((s) => (
                    <label
                      key={s.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={streamsToRecord.has(s.id)}
                        onChange={() => toggleStreamForRecord(s.id)}
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={startRecording}
                    style={{
                      background: TIMELINE_THEME.accent,
                      color: TIMELINE_THEME.bg_primary,
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    ⏺ Start Recording
                  </button>
                  <button
                    type="button"
                    onClick={cancelSelecting}
                    style={{
                      background: TIMELINE_THEME.button_bg,
                      color: TIMELINE_THEME.text_secondary,
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {recordingState.kind === "Recording" && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={stopRecording}
                  style={{
                    background: TIMELINE_THEME.playhead,
                    color: TIMELINE_THEME.text_primary,
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  ⏹ STOP
                </button>
                <span className="animate-pulse" style={{ fontSize: 11, color: TIMELINE_THEME.playhead }}>
                  RECORDING
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: TIMELINE_THEME.text_muted }}>
                  {recordingState.eventCount} events · {Math.round((Date.now() - recordingState.startedAt) / 1000)}s
                </span>
              </div>
            )}

            {recordingState.kind === "PendingSave" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 12, color: TIMELINE_THEME.accent }}>
                  ✓ Recording Complete
                </span>
                <span style={{ fontSize: 11, color: TIMELINE_THEME.text_muted }}>
                  {recordingState.eventCount} events · {recordingState.durationSecs}s
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={saveRecording}
                    style={{
                      background: TIMELINE_THEME.accent,
                      color: TIMELINE_THEME.bg_primary,
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    💾 Save to File
                  </button>
                  <button
                    type="button"
                    onClick={discardRecording}
                    style={{
                      background: TIMELINE_THEME.button_bg,
                      color: TIMELINE_THEME.text_secondary,
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    🗑 Discard
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: 8 }}>
            {streams.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  fontSize: 12,
                  color: TIMELINE_THEME.text_primary,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: s.enabled ? TIMELINE_THEME.accent : TIMELINE_THEME.text_muted,
                  }}
                />
                <span>{s.name}</span>
                <span style={{ marginLeft: "auto", color: TIMELINE_THEME.text_muted, fontFamily: "monospace" }}>
                  {s.event_count}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
