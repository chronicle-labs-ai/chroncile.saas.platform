/*
 * `chronicle` agents provider — direct browser → Chronicle backend.
 *
 * Routes assume the Rust side exposes `/api/platform/agents/*`.
 * Until those land the provider raises whatever the backend returns
 * (typically 404). Every response is validated against the
 * generated Zod schemas before being returned.
 */

import { getBackendUrl } from "platform-api";
import {
  AgentSnapshotSchema,
  AgentSummarySchema,
  HashIndexEntrySchema,
} from "chronicle/schemas";
import type {
  AgentSnapshot,
  AgentSummary,
  HashIndexEntry,
} from "ui";
import { z } from "zod";

import { chronicleFetch } from "../shared/fetcher";
import { getBackendToken } from "../shared/auth-token";
import { validate, validateNullable } from "../shared/validate";
import type { Subscription } from "../types";
import type { AgentsEvent, AgentsProvider } from "./types";

const ROOT = "/api/platform/agents";

const AgentSummaryListSchema = z.array(AgentSummarySchema);
const HashIndexEntryListSchema = z.array(HashIndexEntrySchema);

interface SubscribeEnvelope {
  kind: AgentsEvent["kind"];
  agents?: readonly AgentSummary[];
  name?: string;
  snapshot?: AgentSnapshot;
}

export const chronicleAgentsProvider: AgentsProvider = {
  list: () =>
    chronicleFetch<unknown>(`${ROOT}`).then(
      (raw) =>
        validate(
          AgentSummaryListSchema,
          raw,
          "chronicle agents.list",
        ) as readonly AgentSummary[],
    ),

  getSnapshot: (name) =>
    chronicleFetch<unknown>(
      `${ROOT}/${encodeURIComponent(name)}/snapshot`,
    ).then(
      (raw) =>
        validateNullable(
          AgentSnapshotSchema,
          raw,
          `chronicle agents.getSnapshot(${name})`,
        ) as AgentSnapshot | null,
    ),

  searchHashIndex: (query, domains = []) =>
    chronicleFetch<unknown>(`${ROOT}/hash-index`, {
      searchParams: {
        q: query,
        domains: domains.length > 0 ? domains.join(",") : undefined,
      },
    }).then(
      (raw) =>
        validate(
          HashIndexEntryListSchema,
          raw,
          "chronicle agents.searchHashIndex",
        ) as readonly HashIndexEntry[],
    ),

  pinLatest: (name) =>
    chronicleFetch<unknown>(
      `${ROOT}/${encodeURIComponent(name)}/pin-latest`,
      { method: "POST" },
    ).then(
      (raw) =>
        validate(
          AgentSummarySchema,
          raw,
          `chronicle agents.pinLatest(${name})`,
        ) as AgentSummary,
    ),

  subscribe(handler): Subscription {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return { unsubscribe: () => undefined };
    }
    let source: EventSource | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const token = await getBackendToken();
        if (cancelled) return;
        const url = new URL(`${ROOT}/subscribe`, getBackendUrl());
        url.searchParams.set("access_token", token);
        source = new EventSource(url.toString(), { withCredentials: false });
        source.onmessage = (msg) => {
          try {
            const payload = JSON.parse(msg.data) as SubscribeEnvelope;
            if (payload.kind === "list-changed" && payload.agents) {
              const agents = validate(
                AgentSummaryListSchema,
                payload.agents,
                "chronicle agents SSE list-changed",
              ) as readonly AgentSummary[];
              handler({ kind: "list-changed", agents });
            } else if (
              payload.kind === "snapshot-changed" &&
              payload.name &&
              payload.snapshot
            ) {
              const snapshot = validate(
                AgentSnapshotSchema,
                payload.snapshot,
                "chronicle agents SSE snapshot-changed",
              ) as AgentSnapshot;
              handler({
                kind: "snapshot-changed",
                name: payload.name,
                snapshot,
              });
            }
          } catch (err) {
            if (typeof console !== "undefined") {
              console.error("[chronicle-agents] bad SSE payload", err);
            }
          }
        };
      } catch (err) {
        if (typeof console !== "undefined") {
          console.warn("[chronicle-agents] subscribe failed", err);
        }
      }
    })();

    return {
      unsubscribe: () => {
        cancelled = true;
        source?.close();
      },
    };
  },
};
