import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listAccounts, isPipedreamConfigured } from "@/lib/pipedream";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!isPipedreamConfigured()) {
    return NextResponse.json(
      { error: "Pipedream is not configured" },
      { status: 500 }
    );
  }

  try {
    const tenantId = session.user.tenantId;
    
    const { data: accounts } = await listAccounts(tenantId);
    
    if (!accounts || accounts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No connected accounts found",
        synced: 0,
      });
    }

    const syncedConnections = [];
    
    for (const account of accounts) {
      if (account.dead) {
        console.log(`Skipping dead account: ${account.id} (${account.app.name_slug})`);
        continue;
      }

      try {
        const connection = await prisma.connection.upsert({
          where: {
            tenantId_provider: {
              tenantId,
              provider: account.app.name_slug,
            },
          },
          create: {
            tenantId,
            provider: account.app.name_slug,
            pipedreamAuthId: account.id,
            metadata: {
              account_name: account.name,
              connected_via: "pipedream",
              connected_at: new Date(account.created_at).toISOString(),
              app_name: account.app.name,
            },
            status: account.healthy ? "active" : "inactive",
          },
          update: {
            pipedreamAuthId: account.id,
            metadata: {
              account_name: account.name,
              connected_via: "pipedream",
              connected_at: new Date(account.created_at).toISOString(),
              app_name: account.app.name,
            },
            status: account.healthy ? "active" : "inactive",
            updatedAt: new Date(),
          },
        });

        syncedConnections.push({
          id: connection.id,
          provider: account.app.name_slug,
          accountId: account.id,
        });
      } catch (error) {
        console.error(`Failed to sync account ${account.id} (${account.app.name_slug}):`, error);
      }
    }

    console.log(`Synced ${syncedConnections.length} connections for tenant ${tenantId}`);

    return NextResponse.json({
      success: true,
      synced: syncedConnections.length,
      connections: syncedConnections,
    });
  } catch (error) {
    console.error("Failed to sync Pipedream accounts:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync accounts" },
      { status: 500 }
    );
  }
}
