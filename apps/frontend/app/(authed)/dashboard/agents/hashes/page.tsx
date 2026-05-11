"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { AgentHashIndexPage, DashboardViewportShell, type HashDomain } from "ui";

import { useHashIndex } from "@/lib/data/agents";

/*
 * /dashboard/agents/hashes
 *
 * Standalone hash-index lookup. Accepts two URL parameters:
 *
 *   ?q=<hash | substring>   pre-fills the search box
 *   ?kind=<HashDomain>      pre-selects a hash-domain filter
 *
 * Both are read once on first render. The `AgentHashIndexPage` owns
 * its own state from there — the route does not stay in sync with
 * the URL on subsequent edits, matching the rest of the dashboard.
 *
 * Entries flow through the agents provider middleware. The `mock`
 * impl returns `globalHashIndexSeed` so the surface looks identical
 * to its previous direct-import behaviour; flipping to `chronicle`
 * mode hits the registry's `/hash-index` endpoint when it ships.
 */
export default function AgentsHashIndexPage() {
  const params = useSearchParams();
  const initialQuery = params.get("q") ?? "";
  const kindParam = params.get("kind") ?? "";

  const initialDomains = React.useMemo<HashDomain[]>(() => {
    if (!kindParam) return [];
    if (HASH_DOMAINS.includes(kindParam as HashDomain)) {
      return [kindParam as HashDomain];
    }
    return [];
  }, [kindParam]);

  /* Pull the full registry once; the component does its own
     client-side filtering on top of search + domain chips. */
  const { data: entries } = useHashIndex("", []);

  return (
    <DashboardViewportShell>
      <AgentHashIndexPage
        entries={entries}
        initialQuery={initialQuery}
        initialDomains={initialDomains}
      />
    </DashboardViewportShell>
  );
}

const HASH_DOMAINS: readonly HashDomain[] = [
  "agent.root",
  "prompt",
  "model.contract",
  "provider.options",
  "tool.contract",
  "runtime.policy",
  "dependency",
  "knowledge.contract",
  "workflow.graph",
  "effective.run",
  "provider.observation",
  "operational",
  "output",
];
