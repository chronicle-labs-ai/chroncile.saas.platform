"use client";

import * as React from "react";
import { use } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  CONNECTION_DETAIL_TABS,
  ConnectionDetailPage,
  EmptyState,
  connectionBackfillsSeed,
  connectionDeliveriesSeed,
  connectionEventSubsSeed,
  connectionsSeed,
  type ConnectionDetailTab,
} from "ui";

/*
 * /dashboard/connections/[id]
 *
 * Full-page detail view for a single connection. Hosts all six tabs
 * (Overview, Scopes, Secret, Backfills, Activity, Event types) which
 * are too cramped for the drawer's 720px width. Customers land here
 * via:
 *
 *   1. cmd-click on a row in the manager (browser opens in new tab)
 *   2. "View full details" link in the drawer header
 *   3. "Configure on detail page" links from the drawer's hidden-tab
 *      hint strip (which preserves the chosen tab via `?tab=`)
 *
 * Wires `?tab=...` so deep-links from email / Slack land on the right
 * tab without manual interaction.
 */

const KNOWN_TABS = new Set<string>(CONNECTION_DETAIL_TABS.map((t) => t.id));

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ConnectionDetailRoute({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: ConnectionDetailTab =
    tabParam && KNOWN_TABS.has(tabParam)
      ? (tabParam as ConnectionDetailTab)
      : "overview";

  const [tab, setTab] = React.useState<ConnectionDetailTab>(initialTab);
  const connection = React.useMemo(
    () => connectionsSeed.find((c) => c.id === id) ?? null,
    [id],
  );

  if (!connection) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <EmptyState
          title="Connection not found"
          description={`No connection registered for "${id}".`}
        />
      </div>
    );
  }

  return (
    <ConnectionDetailPage
      connection={connection}
      tab={tab}
      onTabChange={(next) => {
        setTab(next);
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", next);
        router.replace(`?${params.toString()}`, { scroll: false });
      }}
      backfills={connectionBackfillsSeed[id] ?? []}
      deliveries={connectionDeliveriesSeed[id] ?? []}
      events={connectionEventSubsSeed[id] ?? []}
      workspace="Chronicle"
      onBack={() => router.push("/dashboard/connections")}
    />
  );
}
