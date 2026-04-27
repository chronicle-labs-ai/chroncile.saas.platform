"use client";

import { useState, useCallback } from "react";
import type {
  SandboxAiChatMessage,
  SandboxAiChatResponse,
} from "shared/generated";

import type { SandboxNode, SandboxEdge } from "../types";
import {
  graphFromPreview,
  toSandboxEdgeDto,
  toSandboxNodeDto,
} from "@/lib/sandbox/graph-dto";
import { usePlatformApi } from "@/shared/hooks/use-platform-api";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface GenerativePromptProps {
  nodes: SandboxNode[];
  edges: SandboxEdge[];
  selectedNodeId: string | null;
  onApplyPreview: (nodes: SandboxNode[], edges: SandboxEdge[]) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to generate sandbox edits.";
}

function summarizeResponse(response: SandboxAiChatResponse): string | null {
  if (response.errors.length > 0) {
    return (
      response.errors[0]?.message ?? "The AI response could not be applied."
    );
  }

  if (!response.validation.ok && response.validation.issues.length > 0) {
    return (
      response.validation.issues[0]?.message ??
      "The updated graph needs more configuration."
    );
  }

  return response.assistantMessage || null;
}

export function GenerativePrompt({
  nodes,
  edges,
  selectedNodeId,
  onApplyPreview,
}: GenerativePromptProps) {
  const api = usePlatformApi();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<SandboxAiChatMessage[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<
    "idle" | "success" | "warning" | "error"
  >("idle");

  const handleGenerate = useCallback(async () => {
    const nextPrompt = prompt.trim();
    if (!nextPrompt) return;

    setLoading(true);
    setStatusMessage(null);
    setStatusTone("idle");

    try {
      const response = await api.sandboxAiChat({
        prompt: nextPrompt,
        nodes: nodes.map(toSandboxNodeDto),
        edges: edges.map(toSandboxEdgeDto),
        selectedNodeId,
        recentMessages: messages.slice(-6),
      });

      if (response.errors.length === 0) {
        const nextGraph = graphFromPreview(response.preview);
        onApplyPreview(nextGraph.nodes, nextGraph.edges);
      }

      setMessages((previous) => {
        const nextMessages: SandboxAiChatMessage[] = [
          ...previous,
          { role: "user", content: nextPrompt },
          { role: "assistant", content: response.assistantMessage },
        ];

        return nextMessages.slice(-8);
      });
      setStatusMessage(summarizeResponse(response));
      setStatusTone(
        response.errors.length > 0
          ? "error"
          : response.validation.ok
            ? "success"
            : "warning"
      );
      setPrompt("");
    } catch (error) {
      setStatusMessage(readErrorMessage(error));
      setStatusTone("error");
    } finally {
      setLoading(false);
    }
  }, [api, edges, messages, nodes, onApplyPreview, prompt, selectedNodeId]);

  return (
    <div className="px-4 py-2 space-y-2">
      <div className="flex items-center gap-2">
        <svg
          className="w-4 h-4 text-caution shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
          />
        </svg>
        <input
          type="text"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void handleGenerate();
            }
          }}
          placeholder='Describe a graph change, e.g. "Add a filter after the selected source and send matching Stripe events to a webhook output"'
          className="flex-1 px-3 py-1.5 bg-base border border-border-dim rounded text-xs text-primary placeholder:text-disabled focus:outline-none focus:border-caution transition-colors font-mono"
          disabled={loading}
        />
        <button
          onClick={() => void handleGenerate()}
          disabled={!prompt.trim() || loading}
          className="btn btn--secondary text-[10px] px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <svg
                className="w-3 h-3 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Generating
            </span>
          ) : (
            "Generate"
          )}
        </button>
      </div>

      {statusMessage && (
        <div
          className={`rounded border px-3 py-2 font-mono text-[10px] uppercase tracking-wider ${
            statusTone === "error"
              ? "border-critical-dim bg-critical-bg text-critical"
              : statusTone === "warning"
                ? "border-caution-dim bg-caution-bg text-caution"
                : "border-data-dim bg-data-bg text-data"
          }`}
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
}
