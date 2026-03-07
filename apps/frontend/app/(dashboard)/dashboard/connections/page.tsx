import { auth } from "@/server/auth/auth";
import { fetchFromBackend } from "@/server/backend/fetch-from-backend";
import { redirect } from "next/navigation";
import { ConnectionsClient } from "./connections-client";

interface ConnectionData {
  id: string;
  provider: string;
  status: string;
  pipedreamAuthId?: string | null;
  metadata: {
    workspace_id?: string;
    workspace_name?: string;
    account_name?: string;
    admin_email?: string;
    region?: string;
    connected_at?: string;
    connected_via?: string;
  } | null;
  createdAt: Date;
}

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    error?: string;
    error_description?: string;
    pipedream_success?: string;
    pipedream_error?: string;
    app?: string;
  }>;
}) {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const params = await searchParams;

  let connectionsData: ConnectionData[] = [];
  try {
    const data = await fetchFromBackend<{ connections: ConnectionData[] }>(
      "/api/platform/connections",
    );
    connectionsData = data.connections;
  } catch {
    // Backend unavailable -- render empty state
  }

  return (
    <ConnectionsClient
      connections={connectionsData}
      successMessage={params.success}
      errorMessage={params.error}
      pipedreamSuccess={params.pipedream_success === "true"}
      pipedreamError={params.pipedream_error === "true"}
      pipedreamErrorDetail={params.error_description || params.error}
      pipedreamApp={params.app}
    />
  );
}
