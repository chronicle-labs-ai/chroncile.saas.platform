"use client";

import { useRouter } from "next/navigation";

import { AgentsManager, DashboardViewportShell } from "ui";

/*
 * /dashboard/agents
 *
 * Renders the agents manager — a list/grid of every registered agent
 * with search + health filters. Mirrors `/dashboard/connections` and
 * `/dashboard/datasets` in shape: the design-system component owns
 * all interactive state, and this route is a thin wrapper.
 *
 * Detail navigation: when the user opens an agent inside the manager,
 * the manager renders `AgentDetailPage` inline. Deep links
 * (`/dashboard/agents/[name]`, `/dashboard/agents/hashes`) are still
 * available for direct entry.
 *
 * Seed data is sourced from the design system today. When the agent
 * registry exposes an HTTP API (see
 * `agent-versioning-excersize/src/registry-server.ts`), fetch the
 * manifest list here on the server and pass an `agents` prop down.
 */
export default function AgentsManagerPage() {
  const router = useRouter();

  return (
    <DashboardViewportShell>
      <AgentsManager
        onOpenHashSearch={(hint) => {
          const qs = hint
            ? `?q=${encodeURIComponent(hint)}`
            : "";
          router.push(`/dashboard/agents/hashes${qs}`);
        }}
      />
    </DashboardViewportShell>
  );
}
