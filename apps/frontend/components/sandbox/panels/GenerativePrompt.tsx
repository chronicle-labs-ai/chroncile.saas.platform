"use client";

import { useState, useCallback } from "react";
import type { SandboxNode, SandboxEdge, SandboxNodeType } from "../types";
import {
  DEFAULT_EVENT_SOURCE_CONFIG,
  DEFAULT_FILTER_CONFIG,
  DEFAULT_OUTPUT_CONFIG,
  DEFAULT_GENERATOR_CONFIG,
} from "../constants";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface GenerativePromptProps {
  onGenerate: (nodes: SandboxNode[], edges: SandboxEdge[]) => void;
}

/* ------------------------------------------------------------------ */
/*  Keyword-based mock generator                                       */
/* ------------------------------------------------------------------ */

function parsePrompt(
  prompt: string
): { nodes: SandboxNode[]; edges: SandboxEdge[] } {
  const lower = prompt.toLowerCase();
  const nodes: SandboxNode[] = [];
  const edges: SandboxEdge[] = [];
  let nodeId = Date.now();

  const makeId = (prefix: string) => {
    nodeId++;
    return `gen_${prefix}_${nodeId}`;
  };

  /* Detect sources */
  const sources: string[] = [];
  if (lower.includes("intercom")) sources.push("intercom");
  if (lower.includes("stripe")) sources.push("stripe");
  if (lower.includes("shipping") || lower.includes("logistics"))
    sources.push("shipping");
  if (lower.includes("email")) sources.push("email");
  if (sources.length === 0 && !lower.includes("generate"))
    sources.push("intercom"); // default

  /* Detect time range */
  const dateRange = { start: "", end: "" };
  if (lower.includes("last week") || lower.includes("past week")) {
    dateRange.start = new Date(
      Date.now() - 7 * 86_400_000
    ).toISOString();
    dateRange.end = new Date().toISOString();
  } else if (lower.includes("last month") || lower.includes("past month")) {
    dateRange.start = new Date(
      Date.now() - 30 * 86_400_000
    ).toISOString();
    dateRange.end = new Date().toISOString();
  } else if (lower.includes("today")) {
    const now = new Date();
    dateRange.start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).toISOString();
    dateRange.end = now.toISOString();
  }

  /* Detect filter keywords */
  const filters: { field: string; operator: string; value: string }[] = [];
  if (lower.includes("filter") || lower.includes("exclude") || lower.includes("only")) {
    if (lower.includes("bot")) {
      filters.push({
        field: "actor_type",
        operator: lower.includes("exclude") ? "not_equals" : "equals",
        value: "bot",
      });
    }
    // Filter specific sources
    for (const s of ["stripe", "intercom", "shipping", "email"]) {
      if (lower.includes(`filter ${s}`) || lower.includes(`exclude ${s}`)) {
        filters.push({
          field: "source",
          operator: "not_equals",
          value: s,
        });
      }
      if (lower.includes(`only ${s}`)) {
        filters.push({ field: "source", operator: "equals", value: s });
      }
    }
  }

  /* Detect if generator is wanted */
  const wantsGenerator =
    lower.includes("generate") ||
    lower.includes("fake") ||
    lower.includes("synthetic") ||
    lower.includes("mock");

  /* Build nodes */
  const xStart = 80;
  let x = xStart;
  const y = 200;
  const xStep = 320;

  // Source or Generator
  let sourceId: string;
  if (wantsGenerator) {
    sourceId = makeId("gen");
    nodes.push({
      id: sourceId,
      type: "generator",
      position: { x, y },
      data: {
        label: "Generated Events",
        nodeType: "generator",
        config: {
          ...DEFAULT_GENERATOR_CONFIG,
          count: 50,
          variationLevel: 0.5,
        },
      },
    });
  } else {
    sourceId = makeId("src");
    nodes.push({
      id: sourceId,
      type: "event-source",
      position: { x, y },
      data: {
        label:
          sources.length === 1
            ? `${sources[0].charAt(0).toUpperCase() + sources[0].slice(1)} Events`
            : "All Events",
        nodeType: "event-source",
        config: {
          dateRange,
          sourceFilter: sources,
          eventTypeFilter: [],
        },
      },
    });
  }
  x += xStep;

  // Filter (if any)
  let lastId = sourceId;
  if (filters.length > 0) {
    const filterId = makeId("flt");
    nodes.push({
      id: filterId,
      type: "filter",
      position: { x, y },
      data: {
        label:
          filters.length === 1
            ? `${filters[0].operator === "not_equals" ? "Exclude" : "Only"} ${filters[0].value}`
            : `${filters.length} Filter Rules`,
        nodeType: "filter",
        config: {
          rules: filters.map((f, i) => ({
            id: `rule_gen_${i}`,
            field: f.field as "source" | "event_type" | "actor_type" | "custom",
            operator: f.operator as "equals" | "not_equals" | "contains" | "not_contains",
            value: f.value,
          })),
        },
      },
    });
    edges.push({
      id: `e_${lastId}_${filterId}`,
      source: lastId,
      target: filterId,
    });
    lastId = filterId;
    x += xStep;
  }

  // Output
  const outputId = makeId("out");
  const wantsWebhook =
    lower.includes("webhook") || lower.includes("send to");
  nodes.push({
    id: outputId,
    type: "output",
    position: { x, y },
    data: {
      label: wantsWebhook ? "Webhook Relay" : "Event Stream",
      nodeType: "output",
      config: {
        outputType: wantsWebhook ? "webhook" : "sse",
        webhookUrl: "",
        fileFormat: "jsonl",
        transformTemplate: "{{ payload }}",
        includedFields: ["event_id", "source", "event_type", "occurred_at", "actor", "subject", "payload"],
      },
    },
  });
  edges.push({
    id: `e_${lastId}_${outputId}`,
    source: lastId,
    target: outputId,
  });

  return { nodes, edges };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function GenerativePrompt({ onGenerate }: GenerativePromptProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);

    // Simulate AI processing delay
    await new Promise((r) => setTimeout(r, 800));

    const result = parsePrompt(prompt);
    onGenerate(result.nodes, result.edges);
    setPrompt("");
    setLoading(false);
  }, [prompt, onGenerate]);

  return (
    <div className="flex items-center gap-2 px-4 py-2">
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
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleGenerate();
        }}
        placeholder='Describe your pipeline, e.g. "Filter stripe events from last week, exclude bots, send to webhook"'
        className="flex-1 px-3 py-1.5 bg-base border border-border-dim rounded text-xs text-primary placeholder:text-disabled focus:outline-none focus:border-caution transition-colors font-mono"
        disabled={loading}
      />
      <button
        onClick={handleGenerate}
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
  );
}
