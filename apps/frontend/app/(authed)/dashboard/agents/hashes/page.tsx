"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { AgentHashIndexPage, DashboardViewportShell, type HashDomain } from "ui";

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

  return (
    <DashboardViewportShell>
      <AgentHashIndexPage
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
