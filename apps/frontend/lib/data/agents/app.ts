/*
 * `app` agents provider — talks to Next.js routes under
 * `/api/agents/*`. Phase 1 ships only the contract; the actual
 * routes land when a host-app reason exists to mediate this domain.
 *
 * Responses are validated against the same Zod schemas as the
 * `chronicle` impl so a misbehaving Next.js handler can't slip a
 * bad shape past the boundary.
 */

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

import { appFetch } from "../shared/fetcher";
import { validate, validateNullable } from "../shared/validate";
import type { AgentsProvider } from "./types";

const ROOT = "/api/agents";

const AgentSummaryListSchema = z.array(AgentSummarySchema);
const HashIndexEntryListSchema = z.array(HashIndexEntrySchema);

export const appAgentsProvider: AgentsProvider = {
  list: () =>
    appFetch<unknown>(`${ROOT}`).then(
      (raw) =>
        validate(
          AgentSummaryListSchema,
          raw,
          "app agents.list",
        ) as readonly AgentSummary[],
    ),

  getSnapshot: (name) =>
    appFetch<unknown>(
      `${ROOT}/${encodeURIComponent(name)}/snapshot`,
    ).then(
      (raw) =>
        validateNullable(
          AgentSnapshotSchema,
          raw,
          `app agents.getSnapshot(${name})`,
        ) as AgentSnapshot | null,
    ),

  searchHashIndex: (query, domains = []) =>
    appFetch<unknown>(`${ROOT}/hash-index`, {
      searchParams: {
        q: query,
        domains: domains.length > 0 ? domains.join(",") : undefined,
      },
    }).then(
      (raw) =>
        validate(
          HashIndexEntryListSchema,
          raw,
          "app agents.searchHashIndex",
        ) as readonly HashIndexEntry[],
    ),

  pinLatest: (name) =>
    appFetch<unknown>(
      `${ROOT}/${encodeURIComponent(name)}/pin-latest`,
      { method: "POST" },
    ).then(
      (raw) =>
        validate(
          AgentSummarySchema,
          raw,
          `app agents.pinLatest(${name})`,
        ) as AgentSummary,
    ),

  /* Live updates aren't hosted on the Next.js side — those are
     Chronicle's responsibility. The `app` provider intentionally
     returns a no-op subscription so domain consumers don't crash;
     upgrade to `chronicle` mode for SSE. */
  subscribe: () => ({ unsubscribe: () => undefined }),
};
