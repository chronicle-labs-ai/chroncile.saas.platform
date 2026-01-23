import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { redirect } from "next/navigation";
import { ConnectionsClient } from "./connections-client";

interface ConnectionData {
  id: string;
  provider: string;
  status: string;
  metadata: {
    workspace_id?: string;
    workspace_name?: string;
    admin_email?: string;
    region?: string;
    connected_at?: string;
  } | null;
  createdAt: Date;
}

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
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
      metadata: true,
      createdAt: true,
    },
  });

  // Transform to plain objects for client component
  const connectionsData: ConnectionData[] = connections.map((conn) => ({
    id: conn.id,
    provider: conn.provider,
    status: conn.status,
    metadata: conn.metadata as ConnectionData["metadata"],
    createdAt: conn.createdAt,
  }));

  // Check if Intercom is connected
  const intercomConnection = connectionsData.find(
    (c) => c.provider === "intercom" && c.status === "active"
  );

  return (
    <ConnectionsClient
      connections={connectionsData}
      intercomConnection={intercomConnection || null}
      successMessage={params.success}
      errorMessage={params.error}
    />
  );
}
