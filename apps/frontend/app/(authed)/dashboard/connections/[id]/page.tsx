"use client";

import * as React from "react";
import { use } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  CONNECTION_DETAIL_TABS,
  ConnectionDetailPage,
  EmptyState,
  type ConnectionDetailTab,
} from "ui";

import {
  useConnectionBackfills,
  useConnectionDeliveries,
  useConnectionEventSubs,
  useConnections,
} from "@/lib/data/connections";

/*
 * /dashboard/connections/[id]
 *
 * Full-page detail view for a single connection. Hosts all six tabs
 * (Overview, Scopes, Secret, Backfills, Activity, Event types).
 * Wires `?tab=...` so deep-links from email / Slack land on the right
 * tab without manual interaction.
 *
 * Connection + auxiliary data (backfills / deliveries / event subs)
 * flow through the connections provider hooks. Flipping
 * `NEXT_PUBLIC_DATA_CONNECTIONS=chronicle` swaps to live data without
 * touching this file.
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

  const { data: connections, isPending } = useConnections();
  const { data: backfillsByConnection } = useConnectionBackfills();
  const { data: deliveriesByConnection } = useConnectionDeliveries();
  const { data: eventSubsByConnection } = useConnectionEventSubs();

  const connection = React.useMemo(
    () => connections?.find((c) => c.id === id) ?? null,
    [connections, id],
  );

  if (!connection && isPending) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Loading connection…
      </div>
    );
  }

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
      backfills={backfillsByConnection?.[id] ?? []}
      deliveries={deliveriesByConnection?.[id] ?? []}
      events={eventSubsByConnection?.[id] ?? []}
      workspace="Chronicle"
      onBack={() => router.push("/dashboard/connections")}
    />
  );
}
