"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type {
  SandboxNode,
  SandboxEdge,
  SandboxNodeData,
  SandboxNodeType,
  SandboxEvent,
  SandboxStatus,
} from "@/features/sandbox/components/types";
import {
  DEFAULT_EVENT_SOURCE_CONFIG,
  DEFAULT_FILTER_CONFIG,
  DEFAULT_OUTPUT_CONFIG,
  DEFAULT_GENERATOR_CONFIG,
  NODE_COLORS,
} from "@/features/sandbox/components/constants";
import { SandboxCanvas } from "@/features/sandbox/components/SandboxCanvas";
import { NodeConfigDrawer } from "@/features/sandbox/components/panels/NodeConfigDrawer";
import { AgentRecorder } from "@/features/sandbox/components/panels/AgentRecorder";
import { GenerativePrompt } from "@/features/sandbox/components/panels/GenerativePrompt";
import { useSandboxVisualization } from "@/features/sandbox/components/use-sandbox-visualization";
import { useSandboxExecution } from "@/features/sandbox/client/use-sandbox-execution";
import { TimelinePanel } from "@/features/events/timeline/TimelinePanel";
import { EventDetailPanel } from "@/features/events/timeline/EventDetailPanel";
import type {
  TimelineEvent,
  PlaybackState,
} from "@/features/events/timeline/types";
import type { SandboxExecutionPhase } from "@/lib/sandbox/runtime";

/* ------------------------------------------------------------------ */
/*  Node palette items                                                 */
/* ------------------------------------------------------------------ */

const PALETTE_ITEMS: {
  type: SandboxNodeType;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    type: "event-source",
    label: "Source",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
        />
      </svg>
    ),
  },
  {
    type: "filter",
    label: "Filter",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"
        />
      </svg>
    ),
  },
  {
    type: "output",
    label: "Output",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
        />
      </svg>
    ),
  },
  {
    type: "generator",
    label: "Generator",
    icon: (
      <svg
        className="w-4 h-4"
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
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Default data factory for each node type                            */
/* ------------------------------------------------------------------ */

function makeNodeData(
  nodeType: SandboxNodeType,
  label: string
): SandboxNodeData {
  switch (nodeType) {
    case "event-source":
      return { label, nodeType, config: { ...DEFAULT_EVENT_SOURCE_CONFIG } };
    case "filter":
      return {
        label,
        nodeType,
        config: { ...DEFAULT_FILTER_CONFIG, rules: [] },
      };
    case "output":
      return { label, nodeType, config: { ...DEFAULT_OUTPUT_CONFIG } };
    case "generator":
      return { label, nodeType, config: { ...DEFAULT_GENERATOR_CONFIG } };
  }
}

const SANDBOX_STATUS_BADGES: Record<SandboxStatus, string> = {
  active: "bg-nominal-bg text-nominal border-nominal-dim",
  draft: "bg-caution-bg text-caution border-caution-dim",
  paused: "bg-elevated text-secondary border-border-default",
  error: "bg-critical-bg text-critical border-critical-dim",
  archived: "bg-elevated text-tertiary border-border-dim",
};

function getExecutionBadge(
  phase: SandboxExecutionPhase,
  speed: number
): {
  label: string;
  className: string;
} {
  switch (phase) {
    case "saving":
      return {
        label: "Saving graph",
        className: "bg-data-bg text-data border-data-dim",
      };
    case "saveError":
      return {
        label: "Save failed",
        className: "bg-critical-bg text-critical border-critical-dim",
      };
    case "applyingChanges":
      return {
        label: "Applying changes",
        className: "bg-caution-bg text-caution border-caution-dim",
      };
    case "replaying":
      return {
        label: `Playing ${speed}x`,
        className: "bg-nominal-bg text-nominal border-nominal-dim",
      };
    case "streaming":
      return {
        label: "Live",
        className: "bg-nominal-bg text-nominal border-nominal-dim",
      };
    case "waitingForEvents":
      return {
        label: "Waiting for events",
        className: "bg-base text-data border-data-dim",
      };
    case "replayComplete":
      return {
        label: "Replay complete",
        className: "bg-base text-secondary border-border-default",
      };
    case "error":
      return {
        label: "Runtime error",
        className: "bg-critical-bg text-critical border-critical-dim",
      };
    case "draft":
      return {
        label: "Draft",
        className: "bg-base text-tertiary border-border-dim",
      };
    case "paused":
      return {
        label: "Paused",
        className: "bg-base text-secondary border-border-default",
      };
    case "archived":
      return {
        label: "Archived",
        className: "bg-base text-tertiary border-border-dim",
      };
    case "loading":
      return {
        label: "Loading",
        className: "bg-base text-tertiary border-border-dim",
      };
  }
}

/* ------------------------------------------------------------------ */
/*  Inner editor (needs ReactFlowProvider)                             */
/* ------------------------------------------------------------------ */

function EditorInner({
  sandboxId,
  tenantId,
}: {
  sandboxId: string;
  tenantId: string;
}) {
  const router = useRouter();

  /* React Flow state */
  const [nodes, setNodes, onNodesChange] = useNodesState<SandboxNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<SandboxEdge>([]);
  const [graphReady, setGraphReady] = useState(false);

  const execution = useSandboxExecution({
    sandboxId,
    nodes,
    edges,
    graphReady,
  });

  const sandbox = execution.sandbox;
  const events = execution.events;
  const actions = execution.actions;

  /* Sync when sandbox loads */
  const initializedRef = useRef(false);
  useEffect(() => {
    if (sandbox && !initializedRef.current) {
      setNodes(sandbox.nodes);
      // Ensure all edges use the animated edge type
      setEdges(sandbox.edges.map((e) => ({ ...e, type: "animated" })));
      initializedRef.current = true;
      queueMicrotask(() => setGraphReady(true));
    }
  }, [sandbox, setEdges, setNodes]);

  const visualization = useSandboxVisualization({
    nodes,
    edges,
    runtimeEvents: execution.runtimeEvents,
    speed: execution.speed,
    graphRevisionKey: `${sandbox?.id ?? sandboxId}:${
      sandbox?.appliedConfigVersion ?? 0
    }:${sandbox?.runtimePhase ?? "draft"}`,
    enabled:
      graphReady &&
      execution.phase !== "saving" &&
      execution.phase !== "saveError" &&
      execution.phase !== "applyingChanges",
  });

  /* Memoize context values to avoid unnecessary re-renders */
  const simulationCtx = useMemo(
    () => ({ nodeActivity: visualization.nodeActivity }),
    [visualization.nodeActivity]
  );

  const edgeSimCtx = useMemo(
    () => ({
      particles: visualization.edgeParticles,
      activeEdgeIds: visualization.activeEdgeIds,
    }),
    [visualization.activeEdgeIds, visualization.edgeParticles]
  );

  /* Map SandboxEvents to TimelineEvents for the timeline panel.
     During playback, only feed simulated events so the topic tree stays
     focused on the live stream (stored events from days ago would create
     dozens of irrelevant rows and push the active topics out of view).
     When paused, show everything for browsing. */
  const mapSandboxEvent = useCallback(
    (e: SandboxEvent): TimelineEvent => ({
      id: e.event_id,
      source: e.source,
      type: e.event_type,
      occurredAt: e.occurred_at,
      actor: e.actor?.name ?? e.actor?.actor_id,
      message: undefined,
      payload: e.payload,
    }),
    []
  );

  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    const runtime = execution.runtimeEvents.map((entry) =>
      mapSandboxEvent(entry.event)
    );

    if (execution.playback !== "paused") {
      // During playback: only show real-time simulated events
      return runtime;
    }

    // When paused: merge stored + simulated, deduplicated
    const stored = events.map(mapSandboxEvent);
    const seen = new Set<string>();
    const deduped: TimelineEvent[] = [];
    for (const ev of [...stored, ...runtime]) {
      if (!seen.has(ev.id)) {
        seen.add(ev.id);
        deduped.push(ev);
      }
    }
    return deduped;
  }, [events, execution.playback, execution.runtimeEvents, mapSandboxEvent]);

  const [selectedTimelineEventId, setSelectedTimelineEventId] = useState<
    string | null
  >(null);
  const selectedTimelineEvent = useMemo(
    () => timelineEvents.find((e) => e.id === selectedTimelineEventId) ?? null,
    [timelineEvents, selectedTimelineEventId]
  );

  /* UI state */
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [bottomPanel, setBottomPanel] = useState<"timeline" | "recorder">(
    "timeline"
  );
  const [showBottomPanel, setShowBottomPanel] = useState(true);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  /* Auto-select node from URL parameter (for testing) */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const nodeIdParam = params.get("selectNode");
      if (nodeIdParam && nodes.some((n) => n.id === nodeIdParam)) {
        setSelectedNodeId(nodeIdParam);
      }
    }
  }, [nodes]);

  /* Node counter for unique IDs */
  const nodeCounter = useRef(100);

  /* ---- Connect handler ---- */
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, type: "animated" }, eds));
    },
    [setEdges]
  );

  /* ---- Node click ---- */
  const onNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  /* ---- Drag and drop from palette ---- */
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData(
        "application/sandbox-node-type"
      ) as SandboxNodeType;
      if (!nodeType) return;

      const colors = NODE_COLORS[nodeType];
      nodeCounter.current += 1;
      const id = `node_${nodeType}_${nodeCounter.current}`;

      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left - 110,
        y: event.clientY - reactFlowBounds.top - 40,
      };

      const newNode: SandboxNode = {
        id,
        type: nodeType,
        position,
        data: makeNodeData(nodeType, `${colors.label} ${nodeCounter.current}`),
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  /* ---- Node config update ---- */
  const onNodeDataChange = useCallback(
    (nodeId: string, newData: SandboxNodeData) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: newData } : n))
      );
    },
    [setNodes]
  );

  /* ---- Generative prompt handler ---- */
  const onGenerateNodes = useCallback(
    (newNodes: SandboxNode[], newEdges: SandboxEdge[]) => {
      setNodes(newNodes);
      setEdges(newEdges.map((edge) => ({ ...edge, type: "animated" })));
    },
    [setNodes, setEdges]
  );

  /* ---- Loading state ---- */
  if (execution.isLoading && !sandbox) {
    return (
      <div className="h-[calc(100vh-48px)] flex items-center justify-center bg-base">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-data border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-xs text-tertiary uppercase tracking-wider">
            Loading sandbox...
          </span>
        </div>
      </div>
    );
  }

  if (execution.error) {
    return (
      <div className="h-[calc(100vh-48px)] flex items-center justify-center bg-base px-4">
        <div className="panel max-w-md w-full">
          <div className="p-4 space-y-3">
            <div className="text-sm text-critical font-medium">
              Failed to load sandbox
            </div>
            <div className="text-xs text-secondary">{execution.error}</div>
            <button
              onClick={() => void execution.refresh()}
              className="btn btn--secondary"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!sandbox) {
    return null;
  }

  const executionBadge = getExecutionBadge(execution.phase, execution.speed);

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col bg-void overflow-hidden -m-4 lg:-m-6">
      {/* Top bar: header + generative prompt */}
      <div className="shrink-0 border-b border-border-dim bg-surface">
        {/* Header row */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border-dim">
          <button
            onClick={() => router.push("/dashboard/sandbox")}
            className="flex items-center gap-1.5 text-tertiary hover:text-primary transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            <span className="font-mono text-[10px] uppercase tracking-wider">
              Back
            </span>
          </button>

          <div className="h-4 w-px bg-border-dim" />

          <h2 className="text-sm font-medium text-primary truncate">
            {sandbox.name}
          </h2>

          <span
            className={`badge shrink-0 ${SANDBOX_STATUS_BADGES[sandbox.status]}`}
          >
            {sandbox.status}
          </span>

          <span className={`badge shrink-0 ${executionBadge.className}`}>
            {executionBadge.label}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <span className="font-mono text-[10px] text-tertiary tabular-nums">
              {nodes.length} nodes &middot; {edges.length} edges
            </span>
            {execution.runtimeEvents.length > 0 && (
              <span className="font-mono text-[10px] text-nominal tabular-nums">
                &middot; {execution.runtimeEvents.length} runtime
              </span>
            )}
          </div>
        </div>

        {(execution.phase === "saveError" ||
          execution.phase === "applyingChanges" ||
          execution.phase === "waitingForEvents" ||
          execution.phase === "replayComplete") && (
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border-dim bg-base">
            <span className="font-mono text-[10px] uppercase tracking-wider text-secondary">
              {execution.saveError
                ? execution.saveError
                : execution.phase === "applyingChanges"
                  ? "Runtime is pausing briefly so the latest graph can take effect."
                  : execution.phase === "waitingForEvents"
                    ? "Live mode is connected and waiting for the next matching event."
                    : "Historical replay finished. Press live to tail new events or play to start over."}
            </span>
            {execution.phase === "saveError" && (
              <button
                onClick={() => void execution.retrySave()}
                className="btn btn--secondary ml-auto"
              >
                Retry Save
              </button>
            )}
          </div>
        )}

        {/* Generative prompt */}
        <GenerativePrompt
          nodes={nodes}
          edges={edges}
          selectedNodeId={selectedNodeId}
          onApplyPreview={onGenerateNodes}
        />
      </div>

      {/* Main area: palette + canvas + drawer */}
      <div className="flex-1 flex min-h-0">
        {/* Left palette */}
        <div className="w-16 shrink-0 bg-surface border-r border-border-dim flex flex-col items-center py-3 gap-2">
          {PALETTE_ITEMS.map((item) => {
            const colors = NODE_COLORS[item.type];
            return (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/sandbox-node-type",
                    item.type
                  );
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="w-12 h-12 flex flex-col items-center justify-center gap-1 rounded cursor-grab active:cursor-grabbing transition-all duration-fast hover:bg-hover border border-transparent hover:border-border-default"
                title={`Drag to add ${item.label}`}
              >
                <span style={{ color: colors.accent }}>{item.icon}</span>
                <span
                  className="font-mono text-[8px] font-medium tracking-wider uppercase"
                  style={{ color: colors.accent }}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Canvas */}
        <div className="flex-1 min-w-0">
          <SandboxCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            simulationCtx={simulationCtx}
            edgeSimCtx={edgeSimCtx}
          />
        </div>

        {/* Right drawer */}
        {selectedNode && (
          <NodeConfigDrawer
            node={selectedNode}
            onClose={() => setSelectedNodeId(null)}
            onUpdate={(newData) => onNodeDataChange(selectedNode.id, newData)}
            sandboxId={sandboxId}
            tenantId={tenantId}
          />
        )}
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 border-t border-border-dim bg-surface">
        {/* Tab buttons */}
        <div className="flex items-center gap-0 border-b border-border-dim">
          <button
            onClick={() => {
              setBottomPanel("timeline");
              setShowBottomPanel(true);
            }}
            className={`px-4 py-1.5 font-mono text-[10px] font-medium tracking-wider uppercase transition-colors ${
              bottomPanel === "timeline" && showBottomPanel
                ? "text-data border-b-2 border-data"
                : "text-tertiary hover:text-secondary"
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => {
              setBottomPanel("recorder");
              setShowBottomPanel(true);
            }}
            className={`px-4 py-1.5 font-mono text-[10px] font-medium tracking-wider uppercase transition-colors ${
              bottomPanel === "recorder" && showBottomPanel
                ? "text-data border-b-2 border-data"
                : "text-tertiary hover:text-secondary"
            }`}
          >
            Agent Recorder
          </button>

          {/* Simulation speed controls */}
          <div className="flex items-center gap-1 ml-4">
            <span className="font-mono text-[9px] text-tertiary uppercase tracking-wider mr-1">
              Speed
            </span>
            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => void execution.setSpeed(s)}
                className={`px-1.5 py-0.5 rounded font-mono text-[10px] transition-colors ${
                  execution.speed === s
                    ? "bg-data-bg text-data border border-data-dim"
                    : "text-tertiary hover:text-secondary"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Simulated event count */}
          {execution.runtimeEvents.length > 0 && (
            <span className="font-mono text-[10px] text-nominal tabular-nums ml-2">
              {execution.runtimeEvents.length} runtime
            </span>
          )}

          <button
            onClick={() => setShowBottomPanel((v) => !v)}
            className="ml-auto px-3 py-1.5 text-tertiary hover:text-secondary transition-colors"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${
                showBottomPanel ? "" : "rotate-180"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </button>
        </div>

        {/* Panel content */}
        {showBottomPanel && (
          <div className="h-64 overflow-hidden flex">
            {bottomPanel === "timeline" ? (
              <>
                <TimelinePanel
                  events={timelineEvents}
                  playback={execution.playback as PlaybackState}
                  selectedEventId={selectedTimelineEventId}
                  onPlaybackChange={(state) =>
                    void execution.setPlayback(state)
                  }
                  onSelect={(e) => setSelectedTimelineEventId(e.eventId)}
                  className={
                    selectedTimelineEvent ? "flex-1 min-w-0" : "w-full"
                  }
                />
                {selectedTimelineEvent && (
                  <div className="w-80 border-l border-[rgb(30,35,50)] overflow-y-auto flex-shrink-0">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-[rgb(30,35,50)] bg-[rgb(18,22,35)]">
                      <span className="font-mono text-[10px] text-tertiary uppercase tracking-wider">
                        Event Detail
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedTimelineEventId(null)}
                        className="text-tertiary hover:text-secondary text-xs px-1"
                      >
                        ✕
                      </button>
                    </div>
                    <EventDetailPanel
                      event={selectedTimelineEvent}
                      className="h-full"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="w-full">
                <AgentRecorder
                  sandboxId={sandboxId}
                  actions={actions}
                  onNewAction={() => void execution.refresh()}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Outer wrapper with ReactFlowProvider                               */
/* ------------------------------------------------------------------ */

export function SandboxEditorClient({
  sandboxId,
  tenantId,
}: {
  sandboxId: string;
  tenantId: string;
}) {
  return (
    <ReactFlowProvider>
      <EditorInner sandboxId={sandboxId} tenantId={tenantId} />
    </ReactFlowProvider>
  );
}
