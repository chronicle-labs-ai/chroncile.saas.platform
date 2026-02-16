import type {
  Sandbox,
  SandboxNode,
  SandboxEdge,
  SandboxEvent,
  AgentAction,
  CreateSandboxPayload,
  UpdateSandboxPayload,
} from "@/components/sandbox/types";

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

class InMemorySandboxStore implements SandboxRepository {
  private sandboxes = new Map<string, Sandbox>();
  private events = new Map<string, SandboxEvent[]>(); // sandboxId -> events
  private actions = new Map<string, AgentAction[]>(); // sandboxId -> actions

  /* ---------- Sandbox CRUD ---------- */

  async list(tenantId: string): Promise<Sandbox[]> {
    // On first access per-tenant, clone demo data for this tenant
    const hasTenant = Array.from(this.sandboxes.values()).some(
      (s) => s.tenantId === tenantId
    );
    if (!hasTenant) {
      // Clone demo sandboxes for this tenant
      const demos = Array.from(this.sandboxes.values()).filter(
        (s) => s.tenantId === "demo-tenant"
      );
      for (const demo of demos) {
        const cloned: Sandbox = { ...demo, tenantId };
        this.sandboxes.set(cloned.id, cloned);
      }
    }

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

  async create(
    tenantId: string,
    data: CreateSandboxPayload
  ): Promise<Sandbox> {
    const now = new Date().toISOString();
    const sandbox: Sandbox = {
      id: uid("sbx"),
      tenantId,
      name: data.name,
      description: data.description,
      status: "draft",
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

    const updated: Sandbox = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
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
    const { seedStore } = await import("@/components/sandbox/mock-data");
    seedStore(sandboxStore);
  }
  return sandboxStore;
}
