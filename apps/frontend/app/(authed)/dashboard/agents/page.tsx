"use client";

import { useRouter } from "next/navigation";

import { AgentsManager, DashboardViewportShell } from "ui";

import {
  useAgents,
  usePinLatestAgentAction,
} from "@/lib/data/agents";

/*
 * /dashboard/agents
 *
 * Renders the agents manager — list/grid of every registered agent
 * with search + health filters. Data flows through the
 * `AgentsProvider` middleware so flipping
 * `NEXT_PUBLIC_DATA_AGENTS=mock|app|chronicle` swaps the data source
 * without touching this file.
 *
 * The manager renders against the live list when it arrives; while
 * the first request is in flight it defaults to its built-in seed
 * so the page never flashes empty (seed defaults are kept in
 * `packages/ui` for exactly this reason).
 */
export default function AgentsManagerPage() {
  const router = useRouter();
  const { data: agents } = useAgents();
  const pinLatest = usePinLatestAgentAction();

  return (
    <DashboardViewportShell>
      <AgentsManager
        agents={agents}
        onPinLatest={pinLatest}
        onOpenHashSearch={(hint) => {
          const qs = hint ? `?q=${encodeURIComponent(hint)}` : "";
          router.push(`/dashboard/agents/hashes${qs}`);
        }}
      />
    </DashboardViewportShell>
  );
}
