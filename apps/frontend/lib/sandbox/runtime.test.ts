import { describe, expect, it } from "vitest";

import type { Sandbox, SandboxEvent } from "../../components/sandbox/types";
import {
  appendRuntimeEvents,
  createSandboxDefaults,
  deriveDefaultRuntimePhase,
  deriveExecutionPhase,
  eventMatchesSourceConfig,
  MAX_RUNTIME_EVENTS,
} from "./runtime";

function makeSandbox(overrides: Partial<Sandbox> = {}): Sandbox {
  const status = overrides.status ?? "draft";
  const playbackMode = overrides.playbackMode ?? "paused";

  return {
    id: "sbx_test",
    tenantId: "tenant_test",
    name: "Sandbox Test",
    description: "Sandbox runtime test fixture",
    status,
    playbackMode,
    ...createSandboxDefaults({ status, playbackMode }),
    nodes: [],
    edges: [],
    createdAt: "2026-03-08T00:00:00.000Z",
    updatedAt: "2026-03-08T00:00:00.000Z",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<SandboxEvent> = {}): SandboxEvent {
  return {
    event_id: overrides.event_id ?? "evt_test",
    sandbox_id: overrides.sandbox_id ?? "sbx_test",
    source: overrides.source ?? "intercom",
    source_event_id: overrides.source_event_id ?? "src_evt_test",
    event_type: overrides.event_type ?? "message.received",
    occurred_at: overrides.occurred_at ?? "2026-03-08T12:00:00.000Z",
    ingested_at: overrides.ingested_at ?? "2026-03-08T12:00:01.000Z",
    subject: overrides.subject,
    actor: overrides.actor,
    payload: overrides.payload,
  };
}

describe("sandbox runtime helpers", () => {
  it("derives the default active phase from playback mode", () => {
    expect(deriveDefaultRuntimePhase("active", "playing")).toBe("replaying");
    expect(deriveDefaultRuntimePhase("active", "live")).toBe(
      "waitingForEvents"
    );
    expect(deriveDefaultRuntimePhase("paused", "paused")).toBe("paused");
  });

  it("prioritizes saving and save errors over persisted runtime state", () => {
    const sandbox = makeSandbox({
      status: "active",
      playbackMode: "live",
      runtimePhase: "streaming",
    });

    expect(
      deriveExecutionPhase(sandbox, {
        isSaving: true,
      })
    ).toBe("saving");
    expect(
      deriveExecutionPhase(sandbox, {
        hasSaveError: true,
      })
    ).toBe("saveError");
    expect(
      deriveExecutionPhase({
        ...sandbox,
        pendingConfigApply: true,
      })
    ).toBe("applyingChanges");
  });

  it("matches source events against source, event type, and date filters", () => {
    const matchingEvent = makeEvent({
      source: "stripe",
      event_type: "invoice.paid",
      occurred_at: "2026-03-08T12:00:00.000Z",
    });

    expect(
      eventMatchesSourceConfig(matchingEvent, {
        sourceFilter: ["stripe"],
        eventTypeFilter: ["invoice.paid"],
        dateRange: {
          start: "2026-03-08T00:00:00.000Z",
          end: "2026-03-09T00:00:00.000Z",
        },
      })
    ).toBe(true);

    expect(
      eventMatchesSourceConfig(matchingEvent, {
        sourceFilter: ["intercom"],
        eventTypeFilter: [],
        dateRange: {
          start: "",
          end: "",
        },
      })
    ).toBe(false);

    expect(
      eventMatchesSourceConfig(matchingEvent, {
        sourceFilter: ["stripe"],
        eventTypeFilter: ["invoice.paid"],
        dateRange: {
          start: "2026-03-09T00:00:00.000Z",
          end: "2026-03-10T00:00:00.000Z",
        },
      })
    ).toBe(false);
  });

  it("trims runtime history to the configured cap", () => {
    const runtimeEvents = Array.from(
      { length: MAX_RUNTIME_EVENTS + 10 },
      (_, index) => ({
        key: `evt_${index}:root_1`,
        startNodeId: "root_1",
        event: makeEvent({
          event_id: `evt_${index}`,
        }),
      })
    );

    const trimmed = appendRuntimeEvents([], runtimeEvents);
    expect(trimmed).toHaveLength(MAX_RUNTIME_EVENTS);
    expect(trimmed[0]?.event.event_id).toBe("evt_10");
    expect(trimmed.at(-1)?.event.event_id).toBe(
      `evt_${MAX_RUNTIME_EVENTS + 9}`
    );
  });
});
