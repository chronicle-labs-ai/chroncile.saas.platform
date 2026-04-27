import type {
  EventSourceConfig,
  Sandbox,
  SandboxEdge,
  SandboxEvent,
  SandboxNode,
  SandboxPlaybackMode,
  SandboxRuntimeEvent,
  SandboxRuntimePhase,
  SandboxStatus,
} from "@/components/sandbox/types";

export const DEFAULT_SANDBOX_SPEED = 1;
export const SAVE_DEBOUNCE_MS = 800;
export const CONFIG_APPLY_DELAY_MS = 350;
export const LIVE_IDLE_MS = 1500;
export const MAX_RUNTIME_EVENTS = 200;

export type SandboxExecutionPhase =
  | "loading"
  | "draft"
  | "saving"
  | "saveError"
  | "applyingChanges"
  | "replaying"
  | "streaming"
  | "waitingForEvents"
  | "replayComplete"
  | "paused"
  | "error"
  | "archived";

export function deriveDefaultRuntimePhase(
  status: SandboxStatus,
  playbackMode: SandboxPlaybackMode
): SandboxRuntimePhase {
  switch (status) {
    case "draft":
      return "draft";
    case "active":
      if (playbackMode === "playing") {
        return "replaying";
      }
      if (playbackMode === "live") {
        return "waitingForEvents";
      }
      return "paused";
    case "paused":
      return "paused";
    case "error":
      return "error";
    case "archived":
      return "archived";
  }
}

export function createGraphSignature(
  nodes: SandboxNode[],
  edges: SandboxEdge[]
): string {
  const normalizedNodes = [...nodes]
    .map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const normalizedEdges = [...edges]
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return JSON.stringify({
    nodes: normalizedNodes,
    edges: normalizedEdges,
  });
}

export function sortSandboxEvents(events: SandboxEvent[]): SandboxEvent[] {
  return [...events].sort(
    (left, right) =>
      new Date(left.occurred_at).getTime() -
      new Date(right.occurred_at).getTime()
  );
}

export function eventMatchesSourceConfig(
  event: SandboxEvent,
  config: EventSourceConfig
): boolean {
  if (
    config.sourceFilter.length > 0 &&
    !config.sourceFilter.includes(event.source)
  ) {
    return false;
  }

  if (
    config.eventTypeFilter.length > 0 &&
    !config.eventTypeFilter.includes(event.event_type)
  ) {
    return false;
  }

  const occurredAtMs = new Date(event.occurred_at).getTime();
  if (config.dateRange.start) {
    const startMs = new Date(config.dateRange.start).getTime();
    if (occurredAtMs < startMs) {
      return false;
    }
  }

  if (config.dateRange.end) {
    const endMs = new Date(config.dateRange.end).getTime();
    if (occurredAtMs > endMs) {
      return false;
    }
  }

  return true;
}

export function makeRuntimeEventKey(
  event: SandboxEvent,
  startNodeId: string
): string {
  return `${event.event_id}:${startNodeId}`;
}

export function appendRuntimeEvents(
  previous: SandboxRuntimeEvent[],
  next: SandboxRuntimeEvent[]
): SandboxRuntimeEvent[] {
  if (next.length === 0) {
    return previous;
  }

  const combined = [...previous, ...next];
  if (combined.length <= MAX_RUNTIME_EVENTS) {
    return combined;
  }

  return combined.slice(-MAX_RUNTIME_EVENTS);
}

export function createSandboxDefaults(
  sandbox: Pick<Sandbox, "status" | "playbackMode">
): Pick<
  Sandbox,
  | "runtimePhase"
  | "speed"
  | "configVersion"
  | "appliedConfigVersion"
  | "pendingConfigApply"
  | "lastDeliveryAt"
  | "lastError"
> {
  return {
    runtimePhase: deriveDefaultRuntimePhase(
      sandbox.status,
      sandbox.playbackMode
    ),
    speed: DEFAULT_SANDBOX_SPEED,
    configVersion: 1,
    appliedConfigVersion: 1,
    pendingConfigApply: false,
    lastDeliveryAt: null,
    lastError: null,
  };
}

export function deriveExecutionPhase(
  sandbox: Sandbox | null,
  options?: {
    isLoading?: boolean;
    isSaving?: boolean;
    hasSaveError?: boolean;
  }
): SandboxExecutionPhase {
  if (options?.isLoading) {
    return "loading";
  }

  if (options?.hasSaveError) {
    return "saveError";
  }

  if (options?.isSaving) {
    return "saving";
  }

  if (!sandbox) {
    return "loading";
  }

  if (
    sandbox.pendingConfigApply ||
    sandbox.runtimePhase === "applyingChanges"
  ) {
    return "applyingChanges";
  }

  switch (sandbox.runtimePhase) {
    case "draft":
      return "draft";
    case "replaying":
      return "replaying";
    case "streaming":
      return "streaming";
    case "waitingForEvents":
      return "waitingForEvents";
    case "replayComplete":
      return "replayComplete";
    case "paused":
      return "paused";
    case "error":
      return "error";
    case "archived":
      return "archived";
  }
}
