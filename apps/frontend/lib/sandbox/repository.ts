import type {
  Sandbox,
  SandboxEvent,
  AgentAction,
  CreateSandboxPayload,
  UpdateSandboxPayload,
} from "@/components/sandbox/types";
import {
  createGraphSignature,
  createSandboxDefaults,
  deriveDefaultRuntimePhase,
} from "@/lib/sandbox/runtime";

/* ------------------------------------------------------------------ */
/*  Repository interface — swap InMemory for Prisma / external later   */
/* ------------------------------------------------------------------ */

export interface SandboxRepository {
  list(tenantId: string): Promise<Sandbox[]>;
  getById(id: string): Promise<Sandbox | null>;
  create(tenantId: string, data: CreateSandboxPayload): Promise<Sandbox>;
  update(id: string, data: UpdateSandboxPayload): Promise<Sandbox | null>;
  delete(id: string): Promise<boolean>;

  getEvents(
    sandboxId: string,
    timeRange?: { start: string; end: string }
  ): Promise<SandboxEvent[]>;
  ingestAgentEvent(sandboxId: string, event: SandboxEvent): Promise<void>;

  getAgentActions(sandboxId: string): Promise<AgentAction[]>;
  recordAgentAction(
    sandboxId: string,
    action: Omit<AgentAction, "id">
  ): Promise<AgentAction>;
}

/* ------------------------------------------------------------------ */
/*  In-memory implementation                                           */
/* ------------------------------------------------------------------ */

let counter = 0;
function uid(prefix = "sbx"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

const DEMO_TENANT_ID = "demo-tenant";

function cloneSandboxEventForSandbox(
  sandboxId: string,
  event: SandboxEvent
): SandboxEvent {
  return {
    ...structuredClone(event),
    event_id: uid("evt"),
    sandbox_id: sandboxId,
  };
}

function cloneAgentActionForSandbox(
  sandboxId: string,
  action: AgentAction
): AgentAction {
  return {
    ...structuredClone(action),
    id: uid("act"),
    sandbox_id: sandboxId,
  };
}

function buildUpdatedSandbox(
  existing: Sandbox,
  data: UpdateSandboxPayload
): Sandbox {
  const nextStatus = data.status ?? existing.status;
  const nextPlaybackMode = data.playbackMode ?? existing.playbackMode;
  const nextNodes = data.nodes ?? existing.nodes;
  const nextEdges = data.edges ?? existing.edges;
  const nextSpeed = data.speed ?? existing.speed;
  const graphChanged =
    createGraphSignature(existing.nodes, existing.edges) !==
    createGraphSignature(nextNodes, nextEdges);
  const speedChanged = nextSpeed !== existing.speed;
  const statusChanged = nextStatus !== existing.status;
  const playbackChanged = nextPlaybackMode !== existing.playbackMode;

  let configVersion = existing.configVersion;
  let appliedConfigVersion = existing.appliedConfigVersion;
  let pendingConfigApply = existing.pendingConfigApply;
  let runtimePhase = existing.runtimePhase;
  let lastDeliveryAt = existing.lastDeliveryAt;
  const lastError =
    data.lastError !== undefined ? data.lastError : existing.lastError;

  if (graphChanged || speedChanged) {
    configVersion = existing.configVersion + 1;
    if (nextStatus === "active") {
      pendingConfigApply = true;
      runtimePhase = "applyingChanges";
    } else {
      appliedConfigVersion = configVersion;
      pendingConfigApply = false;
      runtimePhase = deriveDefaultRuntimePhase(nextStatus, nextPlaybackMode);
    }
  }

  if (statusChanged || playbackChanged) {
    if (nextStatus === "active" && nextPlaybackMode !== "paused") {
      if (!graphChanged && !speedChanged) {
        pendingConfigApply = true;
        runtimePhase = "applyingChanges";
      }
    } else {
      pendingConfigApply = false;
      runtimePhase = deriveDefaultRuntimePhase(nextStatus, nextPlaybackMode);
    }
  }

  if (data.configVersion !== undefined) {
    configVersion = data.configVersion;
  }
  if (data.appliedConfigVersion !== undefined) {
    appliedConfigVersion = data.appliedConfigVersion;
  }
  if (data.pendingConfigApply !== undefined) {
    pendingConfigApply = data.pendingConfigApply;
  }
  if (data.runtimePhase !== undefined) {
    runtimePhase = data.runtimePhase;
  }
  if (data.lastDeliveryAt !== undefined) {
    lastDeliveryAt = data.lastDeliveryAt;
  }

  if (
    !pendingConfigApply &&
    nextStatus !== "active" &&
    data.appliedConfigVersion === undefined
  ) {
    appliedConfigVersion = configVersion;
  }

  return {
    ...existing,
    ...data,
    status: nextStatus,
    playbackMode: nextPlaybackMode,
    runtimePhase,
    speed: nextSpeed,
    configVersion,
    appliedConfigVersion,
    pendingConfigApply,
    lastDeliveryAt,
    lastError,
    nodes: nextNodes,
    edges: nextEdges,
    updatedAt: new Date().toISOString(),
  };
}

class InMemorySandboxStore implements SandboxRepository {
  private sandboxes = new Map<string, Sandbox>();
  private events = new Map<string, SandboxEvent[]>(); // sandboxId -> events
  private actions = new Map<string, AgentAction[]>(); // sandboxId -> actions
  private seededTenants = new Set<string>();

  private ensureTenantSeeded(tenantId: string) {
    if (this.seededTenants.has(tenantId)) {
      return;
    }

    this.seededTenants.add(tenantId);
    if (tenantId === DEMO_TENANT_ID) {
      return;
    }

    const demos = Array.from(this.sandboxes.values()).filter(
      (sandbox) => sandbox.tenantId === DEMO_TENANT_ID
    );

    for (const demo of demos) {
      const clonedId = uid("sbx");
      const clonedSandbox: Sandbox = {
        ...structuredClone(demo),
        id: clonedId,
        tenantId,
      };
      this.sandboxes.set(clonedId, clonedSandbox);

      const demoEvents = this.events.get(demo.id) ?? [];
      const demoActions = this.actions.get(demo.id) ?? [];

      this.events.set(
        clonedId,
        demoEvents.map((event) => cloneSandboxEventForSandbox(clonedId, event))
      );
      this.actions.set(
        clonedId,
        demoActions.map((action) =>
          cloneAgentActionForSandbox(clonedId, action)
        )
      );
    }
  }

  /* ---------- Sandbox CRUD ---------- */

  async list(tenantId: string): Promise<Sandbox[]> {
    this.ensureTenantSeeded(tenantId);

    return Array.from(this.sandboxes.values())
      .filter((s) => s.tenantId === tenantId)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }

  async getById(id: string): Promise<Sandbox | null> {
    return this.sandboxes.get(id) ?? null;
  }

  async create(tenantId: string, data: CreateSandboxPayload): Promise<Sandbox> {
    const now = new Date().toISOString();
    const status = "draft";
    const playbackMode = "paused";
    const sandbox: Sandbox = {
      id: uid("sbx"),
      tenantId,
      name: data.name,
      description: data.description,
      status,
      playbackMode,
      ...createSandboxDefaults({ status, playbackMode }),
      nodes: [],
      edges: [],
      createdAt: now,
      updatedAt: now,
    };
    this.sandboxes.set(sandbox.id, sandbox);
    this.events.set(sandbox.id, []);
    this.actions.set(sandbox.id, []);
    return sandbox;
  }

  async update(
    id: string,
    data: UpdateSandboxPayload
  ): Promise<Sandbox | null> {
    const existing = this.sandboxes.get(id);
    if (!existing) return null;

    const updated = buildUpdatedSandbox(existing, data);
    this.sandboxes.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const existed = this.sandboxes.has(id);
    this.sandboxes.delete(id);
    this.events.delete(id);
    this.actions.delete(id);
    return existed;
  }

  /* ---------- Events ---------- */

  async getEvents(
    sandboxId: string,
    timeRange?: { start: string; end: string }
  ): Promise<SandboxEvent[]> {
    const all = this.events.get(sandboxId) ?? [];
    if (!timeRange) return all;

    const start = new Date(timeRange.start).getTime();
    const end = new Date(timeRange.end).getTime();
    return all.filter((e) => {
      const t = new Date(e.occurred_at).getTime();
      return t >= start && t <= end;
    });
  }

  async ingestAgentEvent(
    sandboxId: string,
    event: SandboxEvent
  ): Promise<void> {
    const list = this.events.get(sandboxId) ?? [];
    list.push(event);
    this.events.set(sandboxId, list);
  }

  /* ---------- Agent Actions ---------- */

  async getAgentActions(sandboxId: string): Promise<AgentAction[]> {
    return this.actions.get(sandboxId) ?? [];
  }

  async recordAgentAction(
    sandboxId: string,
    action: Omit<AgentAction, "id">
  ): Promise<AgentAction> {
    const full: AgentAction = { ...action, id: uid("act") };
    const list = this.actions.get(sandboxId) ?? [];
    list.push(full);
    this.actions.set(sandboxId, list);
    return full;
  }

  /* ---------- Seed helper (used by mock-data) ---------- */

  seed(
    sandboxes: Sandbox[],
    events: Record<string, SandboxEvent[]>,
    actions: Record<string, AgentAction[]>
  ) {
    for (const s of sandboxes) {
      this.sandboxes.set(s.id, s);
      this.seededTenants.add(s.tenantId);
    }
    for (const [k, v] of Object.entries(events)) {
      this.events.set(k, v);
    }
    for (const [k, v] of Object.entries(actions)) {
      this.actions.set(k, v);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Singleton — import this everywhere                                 */
/* ------------------------------------------------------------------ */

export const sandboxStore = new InMemorySandboxStore();

// Lazy-seed flag
let seeded = false;

export async function getSandboxStore(): Promise<SandboxRepository> {
  if (!seeded) {
    seeded = true;
    // Dynamic import to avoid circular deps
    const { seedStore } =
      await import("@/shared/testing/fixtures/sandbox/mock-data");
    seedStore(sandboxStore);
  }
  return sandboxStore;
}
