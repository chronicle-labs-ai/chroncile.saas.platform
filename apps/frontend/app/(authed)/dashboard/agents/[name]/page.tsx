"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { use } from "react";

import {
  AgentDetailPage,
  DashboardViewportShell,
  EmptyState,
  agentSnapshotsByName,
  resolveLegacyAgentDetailTab,
  useSetSiteBreadcrumb,
  type AgentDetailTab,
} from "ui";

/*
 * /dashboard/agents/[name]
 *
 * Direct deep link to a single agent's detail page. Supports search
 * params for tab + version + diff anchors so links shared in Slack /
 * Linear / docs land on the exact view the author intended:
 *
 *   ?tab=configuration|versions|runs|drift
 *   ?version=<semver>     selects this version on Versions/Drift
 *   ?from=<semver>&to=<semver>  pre-anchors the inline Versions diff
 *   ?run=<runId>          opens the run detail drawer
 *
 * Legacy values (`overview`, `tools` → `configuration`; `diff` →
 * `versions`) are mapped through `resolveLegacyAgentDetailTab` so old
 * links from Slack / Linear / docs continue to land on a sensible
 * surface after the IA rewrite.
 *
 * The page renders independently of `AgentsManager` so the detail
 * surface can be loaded server-side later without restructuring the
 * client.
 */

interface PageProps {
  params: Promise<{ name: string }>;
}

export default function AgentDetailRoute({ params }: PageProps) {
  const { name } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const snapshot = agentSnapshotsByName[name];

  const tabParam = searchParams.get("tab");
  const initialTab: AgentDetailTab =
    resolveLegacyAgentDetailTab(tabParam) ?? "configuration";

  const versionParam = searchParams.get("version") ?? undefined;
  const fromParam = searchParams.get("from") ?? undefined;
  const toParam = searchParams.get("to") ?? undefined;
  const runParam = searchParams.get("run");

  const [tab, setTab] = React.useState<AgentDetailTab>(initialTab);
  const [selectedVersion, setSelectedVersion] = React.useState<
    string | undefined
  >(versionParam ?? toParam);
  const [diffFrom, setDiffFrom] = React.useState<string | undefined>(
    fromParam,
  );
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(
    runParam ?? null,
  );

  useSetSiteBreadcrumb(
    snapshot
      ? [
          { label: "Agents", href: "/dashboard/agents" },
          { label: snapshot.summary.name },
        ]
      : [{ label: "Agents", href: "/dashboard/agents" }],
  );

  if (!snapshot) {
    return (
      <DashboardViewportShell>
        <div className="flex flex-1 items-center justify-center p-8">
          <EmptyState
            title="Agent not found"
            description={`No agent registered for "${name}".`}
          />
        </div>
      </DashboardViewportShell>
    );
  }

  return (
    <DashboardViewportShell>
      <div className="flex flex-1 min-h-0 flex-col rounded-md border border-hairline-strong bg-surface-01">
        <AgentDetailPage
          snapshot={snapshot}
          tab={tab}
          onTabChange={setTab}
          selectedVersion={selectedVersion}
          onSelectVersion={setSelectedVersion}
          diffFromVersion={diffFrom}
          onDiffFromChange={setDiffFrom}
          selectedRunId={selectedRunId}
          onSelectRun={setSelectedRunId}
          onOpenHashSearch={(hint) => {
            const qs = hint
              ? `?q=${encodeURIComponent(hint)}`
              : "";
            router.push(`/dashboard/agents/hashes${qs}`);
          }}
        />
      </div>
    </DashboardViewportShell>
  );
}
