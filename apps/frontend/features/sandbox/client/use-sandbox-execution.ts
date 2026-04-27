"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import { PROVIDER_CATALOG, PROVIDER_IDS } from "@/components/sandbox/constants";
import type {
  GeneratorNodeData,
  SandboxDetailResponse,
  SandboxEdge,
  SandboxEvent,
  SandboxNode,
  SandboxNodeData,
  SandboxRuntimeEvent,
} from "@/components/sandbox/types";
import type { PlaybackState } from "@/components/timeline/types";
import {
  appendRuntimeEvents,
  CONFIG_APPLY_DELAY_MS,
  createGraphSignature,
  DEFAULT_SANDBOX_SPEED,
  deriveExecutionPhase,
  eventMatchesSourceConfig,
  LIVE_IDLE_MS,
  makeRuntimeEventKey,
  SAVE_DEBOUNCE_MS,
  sortSandboxEvents,
} from "@/lib/sandbox/runtime";

const STREAMING_PATCH_THROTTLE_MS = 3000;

const fetcher = async (url: string): Promise<SandboxDetailResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Sandbox request failed with ${response.status}`);
  }
  return response.json();
};

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Request failed";
}

function randomChoice<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

function makeGeneratedPayload(source: string, eventType: string) {
  return {
    generated: true,
    source,
    eventType,
    sample: Math.random().toString(36).slice(2, 10),
  };
}

function makeGeneratedEvent(
  sandboxId: string,
  config: GeneratorNodeData["config"]
): SandboxEvent {
  const availableSources =
    config.sourceTypes.length > 0 ? config.sourceTypes : PROVIDER_IDS;
  const source = randomChoice(availableSources);
  const provider = PROVIDER_CATALOG[source];
  const availableTypes =
    config.eventTypes.length > 0
      ? config.eventTypes
      : (provider?.eventTypes ?? ["generated.event"]);
  const eventType = randomChoice(availableTypes);
  const now = new Date().toISOString();

  return {
    event_id: `generated_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    sandbox_id: sandboxId,
    source,
    source_event_id: `generated_source_${Math.random().toString(36).slice(2, 8)}`,
    event_type: eventType,
    occurred_at: now,
    ingested_at: now,
    subject: {
      conversation_id: `conv_${Math.floor(Math.random() * 1000)}`,
      customer_id: `cust_${Math.floor(Math.random() * 500)}`,
    },
    actor: {
      actor_type: "system",
      actor_id: "generator",
      name: "Sandbox Generator",
    },
    payload: makeGeneratedPayload(source, eventType),
  };
}

export function useSandboxExecution({
  sandboxId,
  nodes,
  edges,
  graphReady,
}: {
  sandboxId: string;
  nodes: SandboxNode[];
  edges: SandboxEdge[];
  graphReady: boolean;
}) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saveError">(
    "idle"
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [runtimeEvents, setRuntimeEvents] = useState<SandboxRuntimeEvent[]>([]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replayCursorRef = useRef(0);
  const liveCursorRef = useRef(0);
  const lastSavedGraphRef = useRef<string | null>(null);
  const lastPlaybackModeRef = useRef<PlaybackState | null>(null);
  const lastStreamingPatchAtRef = useRef(0);
  const sandboxRef = useRef<SandboxDetailResponse["sandbox"] | null>(null);

  const { data, mutate, isLoading, error } = useSWR<SandboxDetailResponse>(
    `/api/sandbox/${sandboxId}`,
    fetcher,
    {
      refreshInterval: (latest) =>
        latest?.sandbox.status === "active" ||
        latest?.sandbox.pendingConfigApply
          ? 1000
          : 0,
      revalidateOnFocus: false,
    }
  );

  const sandbox = data?.sandbox ?? null;
  const storedEvents = useMemo(
    () => sortSandboxEvents(data?.events ?? []),
    [data?.events]
  );
  const actions = data?.actions ?? [];
  const speed = sandbox?.speed ?? DEFAULT_SANDBOX_SPEED;
  const graphSignature = useMemo(
    () => createGraphSignature(nodes, edges),
    [nodes, edges]
  );

  const sourceRoots = useMemo(
    () =>
      nodes.flatMap((node) => {
        const data = node.data as SandboxNodeData;
        if (data.nodeType !== "event-source") {
          return [];
        }
        return [{ id: node.id, config: data.config }];
      }),
    [nodes]
  );

  const generatorRoots = useMemo(
    () =>
      nodes.flatMap((node) => {
        const data = node.data as SandboxNodeData;
        if (data.nodeType !== "generator") {
          return [];
        }
        return [{ id: node.id, config: data.config }];
      }),
    [nodes]
  );

  const resetRuntimeState = useCallback(
    (nextPlayback: PlaybackState) => {
      setRuntimeEvents([]);
      if (nextPlayback === "playing") {
        replayCursorRef.current = 0;
      }
      if (nextPlayback === "live") {
        liveCursorRef.current = storedEvents.length;
      }
    },
    [storedEvents.length]
  );

  useEffect(() => {
    sandboxRef.current = sandbox;
  }, [sandbox]);

  useEffect(() => {
    replayCursorRef.current = 0;
    liveCursorRef.current = 0;
    lastSavedGraphRef.current = null;
    lastPlaybackModeRef.current = null;
    lastStreamingPatchAtRef.current = 0;

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (applyTimerRef.current) {
        clearTimeout(applyTimerRef.current);
      }
      if (liveIdleTimerRef.current) {
        clearTimeout(liveIdleTimerRef.current);
      }
    };
  }, [sandboxId]);

  useEffect(() => {
    if (!graphReady || lastSavedGraphRef.current !== null) {
      return;
    }
    lastSavedGraphRef.current = graphSignature;
  }, [graphReady, graphSignature]);

  const patchSandbox = useCallback(
    async (payload: Record<string, unknown>) => {
      const response = await fetch(`/api/sandbox/${sandboxId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Sandbox update failed with ${response.status}`);
      }

      const result = (await response.json()) as {
        sandbox: SandboxDetailResponse["sandbox"];
      };

      await mutate(
        (current) =>
          current
            ? {
                ...current,
                sandbox: result.sandbox,
              }
            : current,
        { revalidate: false }
      );

      return result.sandbox;
    },
    [mutate, sandboxId]
  );

  const scheduleLiveWaiting = useCallback(() => {
    if (generatorRoots.length > 0) {
      return;
    }
    if (liveIdleTimerRef.current) {
      clearTimeout(liveIdleTimerRef.current);
    }
    liveIdleTimerRef.current = setTimeout(() => {
      const currentSandbox = sandboxRef.current;
      if (
        !currentSandbox ||
        currentSandbox.status !== "active" ||
        currentSandbox.playbackMode !== "live" ||
        currentSandbox.pendingConfigApply
      ) {
        return;
      }

      void patchSandbox({
        runtimePhase: "waitingForEvents",
      }).catch((liveError) => {
        setSaveState("saveError");
        setSaveError(readErrorMessage(liveError));
      });
    }, LIVE_IDLE_MS);
  }, [generatorRoots.length, patchSandbox]);

  const markStreaming = useCallback(
    (lastDeliveryAt: string) => {
      const currentSandbox = sandboxRef.current;
      const now = Date.now();
      if (
        currentSandbox?.runtimePhase === "streaming" &&
        now - lastStreamingPatchAtRef.current < STREAMING_PATCH_THROTTLE_MS
      ) {
        return;
      }

      lastStreamingPatchAtRef.current = now;
      void patchSandbox({
        runtimePhase: "streaming",
        lastDeliveryAt,
        lastError: null,
      }).catch((streamingError) => {
        setSaveState("saveError");
        setSaveError(readErrorMessage(streamingError));
      });
    },
    [patchSandbox]
  );

  const finishReplay = useCallback(
    (lastDeliveryAt?: string | null) => {
      void patchSandbox({
        status: "paused",
        playbackMode: "paused",
        runtimePhase: "replayComplete",
        pendingConfigApply: false,
        lastDeliveryAt:
          lastDeliveryAt ?? sandboxRef.current?.lastDeliveryAt ?? null,
        lastError: null,
      }).catch((replayError) => {
        setSaveState("saveError");
        setSaveError(readErrorMessage(replayError));
      });
    },
    [patchSandbox]
  );

  useEffect(() => {
    if (!sandbox) {
      return;
    }

    const currentPlayback =
      sandbox.status === "active" ? sandbox.playbackMode : "paused";
    if (lastPlaybackModeRef.current === currentPlayback) {
      return;
    }

    if (currentPlayback === "playing") {
      replayCursorRef.current = 0;
    }
    if (currentPlayback === "live") {
      liveCursorRef.current = storedEvents.length;
    }

    lastPlaybackModeRef.current = currentPlayback;
  }, [sandbox, storedEvents.length]);

  useEffect(() => {
    if (!sandbox || !graphReady || lastSavedGraphRef.current === null) {
      return;
    }

    if (graphSignature === lastSavedGraphRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    queueMicrotask(() => {
      setSaveState("saving");
      setSaveError(null);
    });

    saveTimerRef.current = setTimeout(() => {
      void patchSandbox({
        nodes,
        edges,
      })
        .then(() => {
          lastSavedGraphRef.current = graphSignature;
          setSaveState("idle");
        })
        .catch((saveRequestError) => {
          setSaveState("saveError");
          setSaveError(readErrorMessage(saveRequestError));
        });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [edges, graphReady, graphSignature, nodes, patchSandbox, sandbox]);

  useEffect(() => {
    if (
      !sandbox ||
      sandbox.status !== "active" ||
      !sandbox.pendingConfigApply ||
      saveState === "saveError"
    ) {
      return;
    }

    if (applyTimerRef.current) {
      clearTimeout(applyTimerRef.current);
    }

    applyTimerRef.current = setTimeout(() => {
      void patchSandbox({
        appliedConfigVersion: sandbox.configVersion,
        pendingConfigApply: false,
        runtimePhase:
          sandbox.playbackMode === "live" ? "waitingForEvents" : "replaying",
        lastError: null,
      }).catch((applyError) => {
        setSaveState("saveError");
        setSaveError(readErrorMessage(applyError));
      });
    }, CONFIG_APPLY_DELAY_MS);

    return () => {
      if (applyTimerRef.current) {
        clearTimeout(applyTimerRef.current);
      }
    };
  }, [patchSandbox, sandbox, saveState]);

  useEffect(() => {
    if (
      !sandbox ||
      !graphReady ||
      sandbox.status !== "active" ||
      sandbox.playbackMode !== "playing" ||
      sandbox.pendingConfigApply ||
      saveState === "saveError"
    ) {
      return;
    }

    if (sandbox.runtimePhase !== "replaying") {
      void patchSandbox({
        runtimePhase: "replaying",
        lastError: null,
      }).catch((replayError) => {
        setSaveState("saveError");
        setSaveError(readErrorMessage(replayError));
      });
    }

    if (replayCursorRef.current >= storedEvents.length) {
      finishReplay(storedEvents.at(-1)?.occurred_at ?? null);
      return;
    }

    const intervalMs = Math.max(100, 600 / Math.max(1, speed));
    const timer = setInterval(() => {
      const nextEvent = storedEvents[replayCursorRef.current];
      if (!nextEvent) {
        clearInterval(timer);
        finishReplay(storedEvents.at(-1)?.occurred_at ?? null);
        return;
      }

      replayCursorRef.current += 1;
      const batch = sourceRoots.flatMap((root) =>
        eventMatchesSourceConfig(nextEvent, root.config)
          ? [
              {
                key: makeRuntimeEventKey(nextEvent, root.id),
                event: nextEvent,
                startNodeId: root.id,
              },
            ]
          : []
      );

      if (batch.length > 0) {
        setRuntimeEvents((previous) => appendRuntimeEvents(previous, batch));
      }

      if (replayCursorRef.current >= storedEvents.length) {
        clearInterval(timer);
        finishReplay(nextEvent.occurred_at);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [
    finishReplay,
    graphReady,
    patchSandbox,
    sandbox,
    saveState,
    sourceRoots,
    speed,
    storedEvents,
  ]);

  useEffect(() => {
    if (
      !sandbox ||
      !graphReady ||
      sandbox.status !== "active" ||
      sandbox.playbackMode !== "live" ||
      sandbox.pendingConfigApply ||
      saveState === "saveError"
    ) {
      return;
    }

    const newEvents = storedEvents.slice(liveCursorRef.current);
    liveCursorRef.current = storedEvents.length;

    if (newEvents.length === 0) {
      scheduleLiveWaiting();
      return;
    }

    if (liveIdleTimerRef.current) {
      clearTimeout(liveIdleTimerRef.current);
    }

    const batch = newEvents.flatMap((event) =>
      sourceRoots.flatMap((root) =>
        eventMatchesSourceConfig(event, root.config)
          ? [
              {
                key: makeRuntimeEventKey(event, root.id),
                event,
                startNodeId: root.id,
              },
            ]
          : []
      )
    );

    if (batch.length > 0) {
      setRuntimeEvents((previous) => appendRuntimeEvents(previous, batch));
      markStreaming(
        batch.at(-1)?.event.occurred_at ?? newEvents.at(-1)?.occurred_at ?? ""
      );
    } else {
      scheduleLiveWaiting();
    }
  }, [
    graphReady,
    markStreaming,
    sandbox,
    saveState,
    scheduleLiveWaiting,
    sourceRoots,
    storedEvents,
  ]);

  useEffect(() => {
    if (
      !sandbox ||
      !graphReady ||
      sandbox.status !== "active" ||
      sandbox.playbackMode !== "live" ||
      sandbox.pendingConfigApply ||
      saveState === "saveError" ||
      generatorRoots.length === 0
    ) {
      return;
    }

    const intervalMs = Math.max(120, 600 / Math.max(1, speed));
    const timer = setInterval(() => {
      const batch = generatorRoots.map((root) => {
        const event = makeGeneratedEvent(sandboxId, root.config);
        return {
          key: makeRuntimeEventKey(event, root.id),
          event,
          startNodeId: root.id,
        };
      });

      setRuntimeEvents((previous) => appendRuntimeEvents(previous, batch));
      markStreaming(
        batch.at(-1)?.event.occurred_at ?? new Date().toISOString()
      );
    }, intervalMs);

    return () => clearInterval(timer);
  }, [
    generatorRoots,
    graphReady,
    markStreaming,
    sandbox,
    sandboxId,
    saveState,
    speed,
  ]);

  const setPlayback = useCallback(
    async (nextPlayback: PlaybackState) => {
      if (!sandbox) {
        return;
      }

      setSaveError(null);

      if (nextPlayback === "paused") {
        await patchSandbox({
          status: "paused",
          playbackMode: "paused",
          runtimePhase: "paused",
          pendingConfigApply: false,
          lastError: null,
        });
        return;
      }

      resetRuntimeState(nextPlayback);
      await patchSandbox({
        status: "active",
        playbackMode: nextPlayback,
        runtimePhase: "applyingChanges",
        pendingConfigApply: true,
        lastError: null,
      });
    },
    [patchSandbox, resetRuntimeState, sandbox]
  );

  const setSpeed = useCallback(
    async (nextSpeed: number) => {
      if (!sandbox) {
        return;
      }

      setSaveError(null);
      await patchSandbox({
        speed: nextSpeed,
      });
    },
    [patchSandbox, sandbox]
  );

  const retrySave = useCallback(async () => {
    setSaveError(null);
    setSaveState("saving");
    try {
      await patchSandbox({
        nodes,
        edges,
      });
      lastSavedGraphRef.current = graphSignature;
      setSaveState("idle");
    } catch (retryError) {
      setSaveState("saveError");
      setSaveError(readErrorMessage(retryError));
    }
  }, [edges, graphSignature, nodes, patchSandbox]);

  const phase = deriveExecutionPhase(sandbox, {
    isLoading,
    isSaving: saveState === "saving",
    hasSaveError: saveState === "saveError",
  });

  const playback: PlaybackState =
    sandbox?.status === "active" ? sandbox.playbackMode : "paused";

  return {
    sandbox,
    events: storedEvents,
    actions,
    runtimeEvents,
    speed,
    playback,
    phase,
    saveState,
    saveError,
    isLoading,
    error: error ? readErrorMessage(error) : null,
    refresh: mutate,
    retrySave,
    setPlayback,
    setSpeed,
  };
}
