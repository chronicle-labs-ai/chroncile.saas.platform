"use client";

import { useState, useCallback, useRef } from "react";
import type { AgentAction } from "../types";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface AgentRecorderProps {
  sandboxId: string;
  actions: AgentAction[];
  onNewAction: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AgentRecorder({
  sandboxId,
  actions,
  onNewAction,
}: AgentRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [copied, setCopied] = useState(false);

  const ingestionUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/sandbox/${sandboxId}/ingest`
      : `/api/sandbox/${sandboxId}/ingest`;

  /* Start/stop recording */
  const toggleRecording = useCallback(() => {
    if (recording) {
      // Stop
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    } else {
      // Start
      setRecording(true);
      setStartTime(Date.now());
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }
  }, [recording]);

  /* Copy URL */
  const copyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ingestionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [ingestionUrl]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-full flex gap-4 px-4 py-2">
      {/* Left: controls + URL */}
      <div className="w-64 shrink-0 flex flex-col gap-2">
        {/* Ingestion URL */}
        <div>
          <label className="block text-[10px] font-medium tracking-wider text-tertiary uppercase mb-1">
            Ingestion URL
          </label>
          <div className="flex items-center gap-1">
            <div className="flex-1 px-2 py-1.5 bg-base border border-border-dim rounded font-mono text-[10px] text-secondary truncate">
              {ingestionUrl}
            </div>
            <button
              onClick={copyUrl}
              className="shrink-0 px-2 py-1.5 bg-elevated border border-border-dim rounded text-tertiary hover:text-primary transition-colors"
              title="Copy URL"
            >
              {copied ? (
                <svg className="w-3.5 h-3.5 text-nominal" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Recording controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleRecording}
            className={`flex items-center gap-2 px-3 py-1.5 rounded font-mono text-[10px] uppercase tracking-wider border transition-all ${
              recording
                ? "bg-critical-bg text-critical border-critical-dim"
                : "bg-elevated text-secondary border-border-dim hover:border-border-default"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                recording
                  ? "bg-critical animate-pulse"
                  : "bg-tertiary"
              }`}
            />
            {recording ? "Stop" : "Record"}
          </button>

          {recording && (
            <span className="font-mono text-xs text-critical tabular-nums">
              {formatDuration(elapsed)}
            </span>
          )}

          <span className="font-mono text-[10px] text-tertiary ml-auto">
            {actions.length} action{actions.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Right: action log */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {actions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="font-mono text-[10px] text-tertiary">
              No agent actions recorded yet. Use the ingestion URL to send events.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-[9px] font-mono text-tertiary uppercase tracking-wider">
                <th className="text-left py-1 pr-3">Time</th>
                <th className="text-left py-1 pr-3">Agent</th>
                <th className="text-left py-1 pr-3">Action</th>
                <th className="text-left py-1 pr-3">Event</th>
              </tr>
            </thead>
            <tbody>
              {actions
                .slice()
                .reverse()
                .slice(0, 50)
                .map((action) => (
                  <tr
                    key={action.id}
                    className="text-[10px] font-mono border-t border-border-dim"
                  >
                    <td className="py-1 pr-3 text-tertiary tabular-nums whitespace-nowrap">
                      {new Date(action.timestamp).toLocaleTimeString("en-US", {
                        hour12: false,
                      })}
                    </td>
                    <td className="py-1 pr-3 text-secondary truncate max-w-[80px]">
                      {action.agent_id}
                    </td>
                    <td className="py-1 pr-3">
                      <span className="px-1.5 py-0.5 rounded bg-data-bg text-data border border-data-dim text-[9px]">
                        {action.action_type}
                      </span>
                    </td>
                    <td className="py-1 pr-3 text-tertiary truncate max-w-[100px]">
                      {action.event_id}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
