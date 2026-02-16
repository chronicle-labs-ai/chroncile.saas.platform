/* ------------------------------------------------------------------ */
/*  In-memory labeling store                                           */
/*  Swap for Prisma / Events Manager later — same interface            */
/* ------------------------------------------------------------------ */

import type { Trace, TraceSummary, TraceFilters, TraceStats, HumanActionAudit } from "./types";

class InMemoryLabelingStore {
  private traces = new Map<string, Trace>();

  /* ---------- seed ---------- */

  seed(traces: Trace[]) {
    for (const t of traces) this.traces.set(t.id, t);
  }

  /** Clone all traces for a specific tenant (lazy-per-tenant) */
  private ensureTenant(tenantId: string) {
    const has = Array.from(this.traces.values()).some(
      (t) => t.tenantId === tenantId
    );
    if (!has) {
      // Clone demo data for this tenant
      const demos = Array.from(this.traces.values()).filter(
        (t) => t.tenantId === "demo-tenant"
      );
      for (const d of demos) {
        const clone: Trace = { ...d, tenantId };
        this.traces.set(clone.id, clone);
      }
    }
  }

  /* ---------- list (returns summaries — no events payload) ---------- */

  async list(tenantId: string, filters: TraceFilters = {}): Promise<{ traces: TraceSummary[]; total: number }> {
    this.ensureTenant(tenantId);

    let arr = Array.from(this.traces.values()).filter(
      (t) => t.tenantId === tenantId
    );

    // --- filters ---
    if (filters.status) {
      arr = arr.filter((t) => t.status === filters.status);
    }
    if (filters.source) {
      arr = arr.filter((t) => t.sources.includes(filters.source!));
    }
    if (filters.minConfidence !== undefined) {
      arr = arr.filter((t) => (t.confidence ?? 0) >= filters.minConfidence!);
    }
    if (filters.maxConfidence !== undefined) {
      arr = arr.filter((t) => (t.confidence ?? 0) <= filters.maxConfidence!);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      arr = arr.filter(
        (t) =>
          t.conversationId.toLowerCase().includes(q) ||
          (t.autoAudit?.summary ?? "").toLowerCase().includes(q) ||
          (t.autoAudit?.correction_summary ?? "").toLowerCase().includes(q)
      );
    }

    // --- sort ---
    const dir = filters.sortDir === "desc" ? -1 : 1;
    const sortBy = filters.sortBy ?? "confidence";

    arr.sort((a, b) => {
      switch (sortBy) {
        case "confidence":
          return ((a.confidence ?? 0) - (b.confidence ?? 0)) * dir;
        case "date":
          return (
            (new Date(a.firstEventAt).getTime() -
              new Date(b.firstEventAt).getTime()) *
            dir
          );
        case "events":
          return (a.eventCount - b.eventCount) * dir;
        default:
          return 0;
      }
    });

    const total = arr.length;

    // --- pagination ---
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 50;
    arr = arr.slice(offset, offset + limit);

    // Strip events from the summary
    const summaries: TraceSummary[] = arr.map(({ events: _events, ...rest }) => rest);

    return { traces: summaries, total };
  }

  /* ---------- single trace with events ---------- */

  async getById(tenantId: string, traceId: string): Promise<Trace | null> {
    this.ensureTenant(tenantId);
    const t = this.traces.get(traceId);
    if (!t || t.tenantId !== tenantId) return null;
    return t;
  }

  /* ---------- save human audit ---------- */

  async saveAudit(
    traceId: string,
    audit: HumanActionAudit,
    userId: string
  ): Promise<Trace | null> {
    const t = this.traces.get(traceId);
    if (!t) return null;

    const updated: Trace = {
      ...t,
      humanAudit: audit,
      status: "labeled",
      reviewedBy: userId,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.traces.set(traceId, updated);
    return updated;
  }

  /* ---------- skip ---------- */

  async skip(traceId: string, userId: string): Promise<Trace | null> {
    const t = this.traces.get(traceId);
    if (!t) return null;

    const updated: Trace = {
      ...t,
      status: "skipped",
      reviewedBy: userId,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.traces.set(traceId, updated);
    return updated;
  }

  /* ---------- stats ---------- */

  async getStats(tenantId: string): Promise<TraceStats> {
    this.ensureTenant(tenantId);

    const arr = Array.from(this.traces.values()).filter(
      (t) => t.tenantId === tenantId
    );

    const today = new Date().toISOString().slice(0, 10);

    const labeled = arr.filter((t) => t.status === "labeled");
    const confidences = arr
      .filter((t) => t.confidence !== null)
      .map((t) => t.confidence!);

    return {
      total: arr.length,
      pending: arr.filter((t) => t.status === "pending").length,
      autoLabeled: arr.filter((t) => t.status === "auto_labeled").length,
      inReview: arr.filter((t) => t.status === "in_review").length,
      labeled: labeled.length,
      skipped: arr.filter((t) => t.status === "skipped").length,
      avgConfidence:
        confidences.length > 0
          ? Math.round(
              (confidences.reduce((s, c) => s + c, 0) / confidences.length) *
                100
            ) / 100
          : 0,
      labeledToday: labeled.filter(
        (t) => t.reviewedAt && t.reviewedAt.slice(0, 10) === today
      ).length,
    };
  }

  /* ---------- adjacent trace IDs (for prev/next navigation) ---------- */

  async getAdjacentIds(
    tenantId: string,
    currentId: string,
    filters: TraceFilters = {}
  ): Promise<{ prevId: string | null; nextId: string | null }> {
    const { traces } = await this.list(tenantId, { ...filters, limit: 1000 });
    const idx = traces.findIndex((t) => t.id === currentId);
    return {
      prevId: idx > 0 ? traces[idx - 1].id : null,
      nextId: idx >= 0 && idx < traces.length - 1 ? traces[idx + 1].id : null,
    };
  }

  /* ---------- get all labeled traces (for export) ---------- */

  async getLabeledTraces(tenantId: string): Promise<Trace[]> {
    this.ensureTenant(tenantId);
    return Array.from(this.traces.values()).filter(
      (t) => t.tenantId === tenantId && t.status === "labeled"
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Singleton + lazy seed                                              */
/* ------------------------------------------------------------------ */

export const labelingStore = new InMemoryLabelingStore();

let seeded = false;

export async function getLabelingStore(): Promise<InMemoryLabelingStore> {
  if (!seeded) {
    seeded = true;
    const { MOCK_TRACES } = await import("./mock-traces");
    labelingStore.seed(MOCK_TRACES);
  }
  return labelingStore;
}
