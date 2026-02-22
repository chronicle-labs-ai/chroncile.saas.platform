import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
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

  // Fetch existing connections for this tenant
  const connections = await prisma.connection.findMany({
    where: {
      tenantId: session.user.tenantId,
    },
    select: {
      id: true,
      provider: true,
      status: true,
      pipedreamAuthId: true,
      metadata: true,
      createdAt: true,
    },
  });

  // Transform to plain objects for client component
  const connectionsData: ConnectionData[] = connections.map((conn) => ({
    id: conn.id,
    provider: conn.provider,
    status: conn.status,
    pipedreamAuthId: conn.pipedreamAuthId,
    metadata: conn.metadata as ConnectionData["metadata"],
    createdAt: conn.createdAt,
  }));

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
