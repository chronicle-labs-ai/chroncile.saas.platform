import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { listDeployedTriggers, isPipedreamConfigured } from "@/lib/pipedream";

export const dynamic = "force-dynamic";

/**
 * GET /api/pipedream/triggers/deployed
 * 
 * Lists all deployed triggers for the current tenant.
 * Combines data from our database with Pipedream's API.
 */
export async function GET(request: NextRequest) {
  // Verify user is authenticated
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPipedreamConfigured()) {
    return NextResponse.json(
      { error: "Pipedream is not configured" },
      { status: 500 }
    );
  }

  try {
    // Get triggers from our database
    const dbTriggers = await prisma.pipedreamTrigger.findMany({
      where: {
        tenantId: session.user.tenantId,
      },
      include: {
        connection: {
          select: {
            id: true,
            provider: true,
            metadata: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Optionally fetch status from Pipedream to ensure sync
    // (This can be expensive for many triggers, so we mainly rely on our DB)
    const pipedreamTriggers = await listDeployedTriggers(session.user.tenantId)
      .catch(() => ({ data: [] }));

    // Create a map of Pipedream trigger status by deployment ID
    const pipedreamStatusMap = new Map(
      pipedreamTriggers.data.map(t => [t.id, t.active])
    );

    // Merge data
    const triggers = dbTriggers.map(trigger => ({
      id: trigger.id,
      deploymentId: trigger.deploymentId,
      triggerId: trigger.triggerId,
      connectionId: trigger.connectionId,
      provider: trigger.connection.provider,
      configuredProps: trigger.configuredProps,
      status: trigger.status,
      active: pipedreamStatusMap.get(trigger.deploymentId) ?? trigger.status === "active",
      createdAt: trigger.createdAt,
      updatedAt: trigger.updatedAt,
    }));

    return NextResponse.json({ data: triggers });
  } catch (error) {
    console.error("Failed to list deployed triggers:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list triggers" },
      { status: 500 }
    );
  }
}
