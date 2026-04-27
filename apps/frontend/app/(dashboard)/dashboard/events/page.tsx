import { auth } from "@/server/auth/auth";
import { redirect } from "next/navigation";
import { getBackendUrl } from "platform-api";
import { fetchFromBackend } from "@/server/backend/fetch-from-backend";
import { EventsClient } from "@/features/events/client/events-client";

interface ConnectionSummary {
  provider: string;
  status: string;
}

export default async function EventsPage() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  let hasActiveIntercom = false;
  try {
    const data = await fetchFromBackend<{ connections: ConnectionSummary[] }>(
      "/api/platform/connections"
    );
    hasActiveIntercom = data.connections.some(
      (c) => c.provider === "intercom" && c.status === "active"
    );
  } catch {
    // Backend unavailable
  }

  return (
    <EventsClient
      tenantId={session.user.tenantId}
      eventsManagerUrl={getBackendUrl()}
      hasActiveIntercom={hasActiveIntercom}
    />
  );
}
