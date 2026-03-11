"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  FilterRule,
  SandboxEdge,
  SandboxEvent,
  SandboxNode,
  SandboxNodeData,
  SandboxRuntimeEvent,
} from "@/components/sandbox/types";

export interface NodeActivity {
  total: number;
  rate: number;
  passed: number;
  rejected: number;
  active: boolean;
  lastEventAt: number;
}

export interface EdgeParticle {
  id: string;
  edgeId: string;
  progress: number;
  sourceColor: string;
}

function evaluateFilter(event: SandboxEvent, rules: FilterRule[]): boolean {
  if (rules.length === 0) {
    return true;
  }

  return rules.every((rule) => {
    let value = "";
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
      case "custom":
        value = JSON.stringify(event.payload ?? {});
        break;
    }

    const ruleValues = rule.value.includes(",")
      ? rule.value.split(",").map((entry) => entry.trim())
      : [rule.value];

    switch (rule.operator) {
      case "equals":
        return ruleValues.some((entry) => value === entry);
      case "not_equals":
        return ruleValues.every((entry) => value !== entry);
      case "contains":
        return ruleValues.some((entry) => value.includes(entry));
      case "not_contains":
        return ruleValues.every((entry) => !value.includes(entry));
    }
  });
}

function buildGraph(nodes: SandboxNode[], edges: SandboxEdge[]) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const children: Record<string, string[]> = {};
  const edgeMap: Record<string, string> = {};

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      continue;
    }

    if (!children[edge.source]) {
      children[edge.source] = [];
    }
    children[edge.source].push(edge.target);
    edgeMap[`${edge.source}->${edge.target}`] = edge.id;
  }

  return { children, edgeMap };
}

function colorForNode(data: SandboxNodeData): string {
  switch (data.nodeType) {
    case "generator":
      return "#ffb800";
    case "event-source":
      return "#00d4ff";
    case "filter":
      return "#00ff88";
    case "output":
      return "#ff3b3b";
  }
}

export function useSandboxVisualization({
  nodes,
  edges,
  runtimeEvents,
  speed,
  graphRevisionKey,
  enabled,
}: {
  nodes: SandboxNode[];
  edges: SandboxEdge[];
  runtimeEvents: SandboxRuntimeEvent[];
  speed: number;
  graphRevisionKey: string;
  enabled: boolean;
}) {
  const [nodeActivity, setNodeActivity] = useState<Record<string, NodeActivity>>(
    {}
  );
  const [edgeParticles, setEdgeParticles] = useState<EdgeParticle[]>([]);

  const processedEventKeysRef = useRef<Set<string>>(new Set());
  const particleIdRef = useRef(0);

  const nodeMap = useMemo(() => {
    const map = new Map<string, SandboxNode>();
    for (const node of nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [nodes]);

  const graph = useMemo(() => buildGraph(nodes, edges), [nodes, edges]);

  useEffect(() => {
    processedEventKeysRef.current = new Set();
    queueMicrotask(() => {
      setNodeActivity({});
      setEdgeParticles([]);
    });
  }, [graphRevisionKey]);

  useEffect(() => {
    if (enabled) {
      return;
    }

    queueMicrotask(() => {
      setEdgeParticles([]);
      setNodeActivity((previous) => {
        const next: Record<string, NodeActivity> = {};
        let changed = false;
        for (const [id, activity] of Object.entries(previous)) {
          if (activity.active) {
            changed = true;
          }
          next[id] = { ...activity, active: false };
        }
        return changed ? next : previous;
      });
    });
  }, [enabled]);

  const emitParticle = useCallback((edgeId: string, color: string) => {
    particleIdRef.current += 1;
    setEdgeParticles((previous) => [
      ...previous,
      {
        id: `particle_${particleIdRef.current}`,
        edgeId,
        progress: 0,
        sourceColor: color,
      },
    ]);
  }, []);

  const bumpNode = useCallback((nodeId: string, kind: "emit" | "pass" | "reject") => {
    setNodeActivity((previous) => {
      const existing = previous[nodeId] ?? {
        total: 0,
        rate: 0,
        passed: 0,
        rejected: 0,
        active: false,
        lastEventAt: 0,
      };

      return {
        ...previous,
        [nodeId]: {
          ...existing,
          total: existing.total + 1,
          passed: kind === "pass" ? existing.passed + 1 : existing.passed,
          rejected:
            kind === "reject" ? existing.rejected + 1 : existing.rejected,
          active: true,
          lastEventAt: Date.now(),
        },
      };
    });
  }, []);

  const propagateEvent = useCallback(
    (event: SandboxEvent, startNodeId: string) => {
      const visited = new Set<string>();
      const queue = [startNodeId];

      while (queue.length > 0) {
        const nodeId = queue.shift();
        if (!nodeId || visited.has(nodeId)) {
          continue;
        }
        visited.add(nodeId);

        const node = nodeMap.get(nodeId);
        if (!node) {
          continue;
        }

        const data = node.data as SandboxNodeData;
        if (data.nodeType === "filter") {
          const passes = evaluateFilter(event, data.config.rules);
          bumpNode(nodeId, passes ? "pass" : "reject");
          if (!passes) {
            continue;
          }
        } else {
          bumpNode(nodeId, "emit");
        }

        const downstreamNodes = graph.children[nodeId] ?? [];
        for (const childId of downstreamNodes) {
          const edgeId = graph.edgeMap[`${nodeId}->${childId}`];
          if (edgeId) {
            emitParticle(edgeId, colorForNode(data));
          }
          queue.push(childId);
        }
      }
    },
    [bumpNode, emitParticle, graph.children, graph.edgeMap, nodeMap]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const pendingRuntimeEvents: SandboxRuntimeEvent[] = [];
    for (const runtimeEvent of runtimeEvents) {
      if (processedEventKeysRef.current.has(runtimeEvent.key)) {
        continue;
      }
      processedEventKeysRef.current.add(runtimeEvent.key);
      pendingRuntimeEvents.push(runtimeEvent);
    }

    if (pendingRuntimeEvents.length === 0) {
      return;
    }

    queueMicrotask(() => {
      for (const runtimeEvent of pendingRuntimeEvents) {
        propagateEvent(runtimeEvent.event, runtimeEvent.startNodeId);
      }
    });
  }, [enabled, propagateEvent, runtimeEvents]);

  useEffect(() => {
    if (!enabled && edgeParticles.length === 0) {
      return;
    }

    const timer = setInterval(() => {
      setEdgeParticles((previous) =>
        previous
          .map((particle) => ({
            ...particle,
            progress: particle.progress + 0.04 * Math.max(1, speed * 0.5),
          }))
          .filter((particle) => particle.progress < 1)
      );

      const now = Date.now();
      setNodeActivity((previous) => {
        const next: Record<string, NodeActivity> = {};
        let changed = false;

        for (const [id, activity] of Object.entries(previous)) {
          const isActive = now - activity.lastEventAt < 600;
          if (isActive !== activity.active) {
            changed = true;
          }
          next[id] = { ...activity, active: isActive };
        }

        return changed ? next : previous;
      });
    }, 30);

    return () => clearInterval(timer);
  }, [edgeParticles.length, enabled, speed]);

  const activeEdgeIds = useMemo(
    () => new Set(edgeParticles.map((particle) => particle.edgeId)),
    [edgeParticles]
  );

  return {
    nodeActivity,
    edgeParticles,
    activeEdgeIds,
  };
}
