"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  Circle,
  Save,
  Square,
  Trash2,
} from "lucide-react";

import { cx } from "../utils/cx";
import { Badge } from "../primitives/badge";
import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import { CompanyLogo } from "../icons/brand-icons";
import { sourceColor, sourceTintedBackground } from "./source-color";
import {
  REC_IDLE,
  REC_SELECTING,
  recPendingSave,
  recRecording,
  type RecordingState,
  type RecordingStream,
  type StreamId,
} from "./types";

export interface StreamsPanelProps {
  recordingState: RecordingState;
  streams: readonly RecordingStream[];
  onRecordingStateChange: (state: RecordingState) => void;
  /** Fired when the user confirms a save in the PendingSave state. */
  onSaveRecordingRequested?: () => void;
  /** Fired when the user discards a pending save. */
  onDiscardRecordingRequested?: () => void;
  className?: string;
  /** Title rendered in the header. */
  title?: React.ReactNode;
}

/** Format ms into MM:SS / HH:MM:SS for the recording elapsed counter. */
function formatElapsed(startedAt: number, now: number): string {
  const totalSecs = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * StreamsPanel — recording-controls sibling for the timeline viewer.
 *
 * Drives the four-state recording machine (idle → selecting → recording
 * → pending-save) and renders the per-stream selector. Brand icons
 * resolved via `CompanyLogo` so unknown API-supplied stream names
 * still get a sensible fallback badge.
 */
export function StreamsPanel({
  recordingState,
  streams,
  onRecordingStateChange,
  onSaveRecordingRequested,
  onDiscardRecordingRequested,
  className,
  title = "Streams",
}: StreamsPanelProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [streamsToRecord, setStreamsToRecord] = React.useState<Set<StreamId>>(
    () => new Set(streams.filter((s) => s.enabled).map((s) => s.id)),
  );
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (recordingState.kind !== "Recording") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [recordingState.kind]);

  const startSelecting = React.useCallback(() => {
    setStreamsToRecord(
      new Set(streams.filter((s) => s.enabled).map((s) => s.id)),
    );
    onRecordingStateChange(REC_SELECTING);
  }, [streams, onRecordingStateChange]);

  const startRecording = React.useCallback(() => {
    const ids = Array.from(streamsToRecord);
    onRecordingStateChange(recRecording(Date.now(), 0, ids));
  }, [streamsToRecord, onRecordingStateChange]);

  const stopRecording = React.useCallback(() => {
    if (recordingState.kind !== "Recording") return;
    const durationSecs = Math.round(
      (Date.now() - recordingState.startedAt) / 1000,
    );
    onRecordingStateChange(
      recPendingSave(
        recordingState.eventCount,
        durationSecs,
        recordingState.recordingStreamIds,
      ),
    );
  }, [recordingState, onRecordingStateChange]);

  const saveRecording = React.useCallback(() => {
    if (recordingState.kind !== "PendingSave") return;
    onSaveRecordingRequested?.();
    onRecordingStateChange(REC_IDLE);
  }, [recordingState, onSaveRecordingRequested, onRecordingStateChange]);

  const discardRecording = React.useCallback(() => {
    if (recordingState.kind !== "PendingSave") return;
    onDiscardRecordingRequested?.();
    onRecordingStateChange(REC_IDLE);
  }, [recordingState, onDiscardRecordingRequested, onRecordingStateChange]);

  const cancelSelecting = React.useCallback(() => {
    onRecordingStateChange(REC_IDLE);
  }, [onRecordingStateChange]);

  const toggleStreamSelected = React.useCallback((id: StreamId) => {
    setStreamsToRecord((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isSelecting = recordingState.kind === "SelectingStreams";
  const isRecording = recordingState.kind === "Recording";
  const isPending = recordingState.kind === "PendingSave";

  return (
    <section
      className={cx(
        "flex flex-col overflow-hidden rounded-md border border-hairline bg-l-surface text-ink",
        className,
      )}
      aria-label="Streams panel"
    >
      <header className="flex items-center gap-s-2 border-b border-hairline bg-l-surface-bar px-s-3 py-s-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand streams" : "Collapse streams"}
          aria-expanded={!collapsed}
          className="inline-flex h-5 w-5 items-center justify-center rounded-xs text-ink-dim transition-colors hover:bg-l-surface-hover hover:text-ink-lo"
        >
          {collapsed ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
        <span className="font-mono text-mono uppercase tracking-tactical text-ink-lo">
          {title}
        </span>
        <span className="font-mono text-mono-xs text-ink-dim">
          ({streams.length})
        </span>

        <div className="ml-auto flex items-center gap-s-2">
          <RecordingStateBadge state={recordingState} now={now} />
          {isRecording ? (
            <Button
              variant="critical"
              size="sm"
              leadingIcon={<Square className="fill-current" />}
              onClick={stopRecording}
            >
              Stop
            </Button>
          ) : isSelecting ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelSelecting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<Circle className="fill-current text-event-red" />}
                isDisabled={streamsToRecord.size === 0}
                onClick={startRecording}
              >
                Record
              </Button>
            </>
          ) : isPending ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<Trash2 />}
                onClick={discardRecording}
              >
                Discard
              </Button>
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<Save />}
                onClick={saveRecording}
              >
                Save
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Circle className="fill-current text-event-red" />}
              onClick={startSelecting}
            >
              New recording
            </Button>
          )}
        </div>
      </header>

      {collapsed ? null : (
        <ul className="flex flex-col">
          {streams.map((stream, idx) => (
            <StreamRow
              key={stream.id}
              stream={stream}
              index={idx}
              selecting={isSelecting}
              selected={streamsToRecord.has(stream.id)}
              recording={
                isRecording &&
                recordingState.recordingStreamIds.includes(stream.id)
              }
              onToggleSelected={toggleStreamSelected}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface StreamRowProps {
  stream: RecordingStream;
  index: number;
  selecting: boolean;
  selected: boolean;
  recording: boolean;
  onToggleSelected: (id: StreamId) => void;
}

function StreamRow({
  stream,
  index,
  selecting,
  selected,
  recording,
  onToggleSelected,
}: StreamRowProps) {
  const tint = sourceTintedBackground(
    stream.color ?? sourceColor(stream.name),
    20,
  );
  return (
    <li
      className={cx(
        "flex items-center gap-s-3 border-b border-hairline px-s-3 py-s-2",
        index % 2 === 0 ? "bg-l-surface" : "bg-l-surface-bar",
      )}
    >
      {selecting ? (
        <Checkbox
          isSelected={selected}
          onChange={() => onToggleSelected(stream.id)}
          aria-label={`Record from ${stream.name}`}
        />
      ) : (
        <span
          aria-hidden
          className={cx(
            "inline-block h-2 w-2 rounded-pill",
            recording ? "animate-chron-pulse bg-event-red" : "bg-event-green",
          )}
        />
      )}
      <CompanyLogo
        name={stream.name}
        size={18}
        radius={4}
        fallbackBackground={tint}
        fallbackColor="var(--c-ink-hi)"
        aria-hidden
      />
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-mono text-mono text-ink-hi">
          {stream.name}
        </span>
        <span className="truncate font-mono text-mono-xs uppercase tracking-tactical text-ink-dim">
          {stream.kind} · {stream.status}
        </span>
      </div>
      <span className="ml-auto font-mono text-mono-xs text-ink-dim tabular-nums">
        {stream.event_count.toLocaleString()}
      </span>
    </li>
  );
}

function RecordingStateBadge({
  state,
  now,
}: {
  state: RecordingState;
  now: number;
}) {
  if (state.kind === "Recording") {
    return (
      <Badge variant="red" className="font-mono tabular-nums">
        REC · {formatElapsed(state.startedAt, now)} · {state.eventCount} evt
      </Badge>
    );
  }
  if (state.kind === "PendingSave") {
    return (
      <Badge variant="amber">
        Pending save · {state.eventCount} evt
      </Badge>
    );
  }
  if (state.kind === "SelectingStreams") {
    return (
      <Badge variant="teal">
        Selecting streams
      </Badge>
    );
  }
  return null;
}
