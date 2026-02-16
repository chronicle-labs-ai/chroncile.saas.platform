"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type {
  SandboxNode,
  SandboxEdge,
  SandboxEvent,
  SandboxNodeData,
  FilterRule,
} from "./types";
import { PROVIDER_CATALOG, PROVIDER_IDS } from "./constants";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type PlaybackMode = "paused" | "playing" | "live";

/** Per-node activity counters, updated every tick */
export interface NodeActivity {
  /** Total events emitted/processed by this node */
  total: number;
  /** Events in the last second window */
  rate: number;
  /** For filter nodes: events that passed */
  passed: number;
  /** For filter nodes: events that were rejected */
  rejected: number;
  /** Whether the node is actively processing right now */
  active: boolean;
  /** Timestamp of last event */
  lastEventAt: number;
}

/** An event "in flight" — traveling along an edge visually */
export interface EdgeParticle {
  id: string;
  edgeId: string;
  progress: number; // 0-1 along the edge
  sourceColor: string;
}

export interface SimulationState {
  mode: PlaybackMode;
  speed: number;
  nodeActivity: Record<string, NodeActivity>;
  edgeParticles: EdgeParticle[];
  processedEvents: SandboxEvent[];
  /** Edges that are currently carrying data */
  activeEdgeIds: Set<string>;
}

/* ------------------------------------------------------------------ */
/*  Mock event generation — from PROVIDER_CATALOG                      */
/* ------------------------------------------------------------------ */

const REAL_ACTOR_TYPES = ["customer", "agent", "system"];
const REAL_NAMES: Record<string, string[]> = {
  customer: ["Alice Chen", "Bob Martinez", "Carlos Reyes", "Diana Park", "Eli Nnadi"],
  agent: ["Agent-1", "Agent-2", "Support-Bot-v3"],
  system: ["System", "Webhook Relay", "Auto-Router"],
};

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Generate a realistic payload for a given provider + event type */
function makePayload(source: string, eventType: string): Record<string, unknown> {
  switch (source) {
    case "intercom":
      return {
        conversation_id: `conv_${Math.floor(Math.random() * 5000)}`,
        message_type: eventType.includes("message") ? "comment" : "note",
        admin_assignee_id: Math.random() > 0.5 ? `admin_${Math.floor(Math.random() * 20)}` : null,
        tags: randomChoice([["vip"], ["billing"], ["urgent", "billing"], []]),
      };
    case "stripe":
      return {
        charge_id: `ch_${Math.random().toString(36).slice(2, 14)}`,
        amount: Math.floor(Math.random() * 50000) + 100,
        currency: "usd",
        customer: `cus_${Math.random().toString(36).slice(2, 14)}`,
        status: eventType.includes("failed") ? "failed" : "succeeded",
      };
    case "slack":
      return {
        channel: `#${randomChoice(["support", "general", "engineering", "sales"])}`,
        user: `U${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        ts: `${Date.now() / 1000}`,
      };
    case "hubspot":
      return {
        object_id: Math.floor(Math.random() * 100000),
        portal_id: 12345678,
        property_name: eventType.includes("stage") ? "dealstage" : "lifecyclestage",
        property_value: randomChoice(["lead", "opportunity", "customer"]),
      };
    case "zendesk":
      return {
        ticket_id: Math.floor(Math.random() * 90000) + 10000,
        priority: randomChoice(["low", "normal", "high", "urgent"]),
        status: randomChoice(["new", "open", "pending", "solved"]),
      };
    case "github":
      return {
        repository: `org/${randomChoice(["api", "frontend", "infra"])}`,
        action: eventType.includes(".") ? eventType.split(".")[1] : eventType,
        number: eventType.includes("pull_request") || eventType.includes("issue") ? Math.floor(Math.random() * 500) : undefined,
      };
    case "notion":
      return {
        page_id: `${Math.random().toString(36).slice(2, 10)}`,
        workspace_id: `ws_${Math.random().toString(36).slice(2, 10)}`,
      };
    default:
      return { raw: true, eventType };
  }
}

let eventSeq = 0;

function generateMockEvent(
  sandboxId: string,
  sourceFilter: string[],
  eventTypeFilter: string[],
  _variationLevel = 0.3
): SandboxEvent {
  eventSeq++;

  // Pick source from filter or from all real providers
  const availableSources =
    sourceFilter.length > 0
      ? sourceFilter.filter((s) => PROVIDER_CATALOG[s])
      : PROVIDER_IDS;

  const source = randomChoice(availableSources);
  const provider = PROVIDER_CATALOG[source];

  // Pick event type from filter or from provider's catalog
  const availableTypes =
    eventTypeFilter.length > 0
      ? eventTypeFilter.filter((t) => provider.eventTypes.includes(t))
      : [];
  const eventType =
    availableTypes.length > 0
      ? randomChoice(availableTypes)
      : randomChoice(provider.eventTypes);

  const actorType = randomChoice(REAL_ACTOR_TYPES);

  return {
    event_id: `sim_${eventSeq}_${Math.random().toString(36).slice(2, 6)}`,
    sandbox_id: sandboxId,
    source,
    source_event_id: `${source}_${Math.random().toString(36).slice(2, 10)}`,
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    subject: {
      conversation_id: `conv_${Math.floor(Math.random() * 500)}`,
      customer_id: `cust_${Math.floor(Math.random() * 200)}`,
    },
    actor: {
      actor_type: actorType,
      actor_id: `actor_${Math.floor(Math.random() * 50)}`,
      name: randomChoice(REAL_NAMES[actorType] ?? ["Unknown"]),
    },
    payload: makePayload(source, eventType),
  };
}

/* ------------------------------------------------------------------ */
/*  Filter evaluation                                                  */
/* ------------------------------------------------------------------ */

function evaluateFilter(event: SandboxEvent, rules: FilterRule[]): boolean {
  if (rules.length === 0) return true;

  return rules.every((rule) => {
    let value: string;
    switch (rule.field) {
      case "source":
        value = event.source;
        break;
      case "event_type":
        value = event.event_type;
        break;
      case "actor_type":
        value = event.actor?.actor_type ?? "";
        break;
      case "custom": {
        // Custom field uses "path::matchValue" format
        value = JSON.stringify(event.payload);
        break;
      }
      default:
        value = "";
    }

    // For source and actor_type, value may be comma-separated (multi-select)
    const ruleValues = rule.value.includes(",")
      ? rule.value.split(",").map((v) => v.trim())
      : [rule.value];

    switch (rule.operator) {
      case "equals":
        return ruleValues.some((rv) => value === rv);
      case "not_equals":
        return ruleValues.every((rv) => value !== rv);
      case "contains":
        return ruleValues.some((rv) => value.includes(rv));
      case "not_contains":
        return ruleValues.every((rv) => !value.includes(rv));
      default:
        return true;
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Build adjacency from edges                                         */
/* ------------------------------------------------------------------ */

function buildGraph(
  nodes: SandboxNode[],
  edges: SandboxEdge[]
): {
  roots: string[]; // nodes with no incoming edges (sources/generators)
  children: Record<string, string[]>; // nodeId -> [downstream nodeIds]
  edgeMap: Record<string, string>; // "source->target" -> edgeId
} {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const incoming = new Set<string>();
  const children: Record<string, string[]> = {};
  const edgeMap: Record<string, string> = {};

  for (const e of edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
    incoming.add(e.target);
    if (!children[e.source]) children[e.source] = [];
    children[e.source].push(e.target);
    edgeMap[`${e.source}->${e.target}`] = e.id;
  }

  const roots = nodes
    .filter((n) => !incoming.has(n.id))
    .map((n) => n.id);

  return { roots, children, edgeMap };
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useSandboxSimulation(
  sandboxId: string,
  nodes: SandboxNode[],
  edges: SandboxEdge[],
  storedEvents: SandboxEvent[]
) {
  const [mode, setMode] = useState<PlaybackMode>("paused");
  const [speed, setSpeed] = useState(1);
  const [nodeActivity, setNodeActivity] = useState<Record<string, NodeActivity>>({});
  const [edgeParticles, setEdgeParticles] = useState<EdgeParticle[]>([]);
  const [processedEvents, setProcessedEvents] = useState<SandboxEvent[]>([]);
  const [activeEdgeIds, setActiveEdgeIds] = useState<Set<string>>(new Set());

  const particleIdRef = useRef(0);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  /* Node lookup map */
  const nodeMap = useMemo(() => {
    const map = new Map<string, SandboxNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  /* Graph topology */
  const graph = useMemo(
    () => buildGraph(nodes, edges),
    [nodes, edges]
  );

  /* ---- Emit a particle along an edge ---- */
  const emitParticle = useCallback(
    (edgeId: string, color: string) => {
      particleIdRef.current++;
      const id = `p_${particleIdRef.current}`;
      setEdgeParticles((prev) => [
        ...prev,
        { id, edgeId, progress: 0, sourceColor: color },
      ]);
    },
    []
  );

  /* ---- Bump node activity ---- */
  const bumpNode = useCallback(
    (
      nodeId: string,
      kind: "emit" | "pass" | "reject"
    ) => {
      setNodeActivity((prev) => {
        const existing = prev[nodeId] ?? {
          total: 0,
          rate: 0,
          passed: 0,
          rejected: 0,
          active: false,
          lastEventAt: 0,
        };
        return {
          ...prev,
          [nodeId]: {
            ...existing,
            total: existing.total + 1,
            passed:
              kind === "pass" ? existing.passed + 1 : existing.passed,
            rejected:
              kind === "reject"
                ? existing.rejected + 1
                : existing.rejected,
            active: true,
            lastEventAt: Date.now(),
          },
        };
      });
    },
    []
  );

  /* ---- Process an event through the graph starting at a node ---- */
  const propagateEvent = useCallback(
    (event: SandboxEvent, startNodeId: string) => {
      const visited = new Set<string>();
      const queue = [startNodeId];

      while (queue.length > 0) {
        const nodeId = queue.shift()!;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);

        const node = nodeMap.get(nodeId);
        if (!node) continue;

        const data = node.data as SandboxNodeData;

        if (data.nodeType === "filter") {
          const passes = evaluateFilter(event, data.config.rules);
          bumpNode(nodeId, passes ? "pass" : "reject");
          if (!passes) continue; // Event filtered out
        } else {
          bumpNode(nodeId, "emit");
        }

        // Propagate to children
        const downstream = graph.children[nodeId] ?? [];
        for (const childId of downstream) {
          const edgeKey = `${nodeId}->${childId}`;
          const edgeId = graph.edgeMap[edgeKey];
          if (edgeId) {
            const nodeData = node.data as SandboxNodeData;
            const color =
              nodeData.nodeType === "generator"
                ? "#ffb800"
                : nodeData.nodeType === "event-source"
                ? "#00d4ff"
                : nodeData.nodeType === "filter"
                ? "#00ff88"
                : "#ff3b3b";
            emitParticle(edgeId, color);
            setActiveEdgeIds((prev) => {
              const next = new Set(prev);
              next.add(edgeId);
              return next;
            });
          }
          queue.push(childId);
        }
      }
    },
    [nodeMap, graph, bumpNode, emitParticle]
  );

  /* ---- Main simulation tick (playing/live modes) ---- */
  useEffect(() => {
    if (mode === "paused") return;

    // Determine base interval based on speed
    const baseMs = mode === "live" ? 600 : 400;
    const intervalMs = Math.max(60, baseMs / speed);

    const timer = setInterval(() => {
      const currentNodes = nodesRef.current;
      const g = buildGraph(currentNodes, edgesRef.current);

      for (const rootId of g.roots) {
        const node = currentNodes.find((n) => n.id === rootId);
        if (!node) continue;
        const data = node.data as SandboxNodeData;

        if (data.nodeType === "event-source") {
          const event = generateMockEvent(
            sandboxId,
            data.config.sourceFilter,
            data.config.eventTypeFilter
          );
          setProcessedEvents((prev) => [...prev.slice(-200), event]);
          propagateEvent(event, rootId);
        } else if (data.nodeType === "generator") {
          const event = generateMockEvent(
            sandboxId,
            data.config.sourceTypes,
            data.config.eventTypes,
            data.config.variationLevel
          );
          setProcessedEvents((prev) => [...prev.slice(-200), event]);
          propagateEvent(event, rootId);
        }
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [mode, speed, sandboxId, propagateEvent]);

  /* ---- Advance particles and decay activity ---- */
  useEffect(() => {
    if (mode === "paused" && edgeParticles.length === 0) return;

    const raf = setInterval(() => {
      // Advance particles
      setEdgeParticles((prev) => {
        const next = prev
          .map((p) => ({
            ...p,
            progress: p.progress + 0.04 * Math.max(1, speed * 0.5),
          }))
          .filter((p) => p.progress < 1);
        return next;
      });

      // Decay active state
      const now = Date.now();
      setNodeActivity((prev) => {
        const next: Record<string, NodeActivity> = {};
        let changed = false;
        for (const [id, act] of Object.entries(prev)) {
          const isActive = now - act.lastEventAt < 600;
          if (isActive !== act.active) changed = true;
          next[id] = { ...act, active: isActive };
        }
        return changed ? next : prev;
      });

      // Decay active edges
      setActiveEdgeIds((prev) => {
        if (prev.size === 0) return prev;
        // Keep active if there are particles on it
        return prev;
      });
    }, 30);

    return () => clearInterval(raf);
  }, [mode, speed, edgeParticles.length]);

  /* ---- Decay active edges when no particles ---- */
  useEffect(() => {
    const activeWithParticles = new Set(edgeParticles.map((p) => p.edgeId));
    setActiveEdgeIds(activeWithParticles);
  }, [edgeParticles]);

  return {
    mode,
    setMode,
    speed,
    setSpeed,
    nodeActivity,
    edgeParticles,
    processedEvents,
    activeEdgeIds,
  };
}
