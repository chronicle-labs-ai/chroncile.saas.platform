import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { deployTrigger, isPipedreamConfigured, getWebhookUrl } from "@/lib/pipedream";

export const dynamic = "force-dynamic";

interface DeployTriggerRequest {
  triggerId: string;        // Pipedream trigger component ID (e.g., "slack-new-message")
  connectionId: string;     // Our Connection record ID
  configuredProps?: Record<string, unknown>;
}

/**
 * POST /api/pipedream/triggers/deploy
 * 
 * Deploys a trigger to listen for events from a connected app.
 * The trigger will send events to our webhook endpoint.
 */
export async function POST(request: NextRequest) {
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

  let body: DeployTriggerRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { triggerId, connectionId, configuredProps } = body;

  if (!triggerId || !connectionId) {
    return NextResponse.json(
      { error: "Missing required fields: triggerId, connectionId" },
      { status: 400 }
    );
  }

  // Verify the connection exists and belongs to this tenant
  const connection = await prisma.connection.findFirst({
    where: {
      id: connectionId,
      tenantId: session.user.tenantId,
    },
  });

  if (!connection) {
    return NextResponse.json(
      { error: "Connection not found" },
      { status: 404 }
    );
  }

  if (!connection.pipedreamAuthId) {
    return NextResponse.json(
      { error: "Connection is not managed by Pipedream" },
      { status: 400 }
    );
  }

  const tenantId = session.user.tenantId;

  // Build configured props with auth and user IDs (Pipedream ignores unknown props)
  const fullConfiguredProps: Record<string, unknown> = {
    ...configuredProps,
    [connection.provider]: {
      authProvisionId: connection.pipedreamAuthId,
    },
    userIds: [tenantId],
    user_id: tenantId,
  };


  // Default polling: 1 min for all triggers (Pipedream ignores timer for non-polling triggers)
  if (!fullConfiguredProps.timer) {
    fullConfiguredProps.timer = { intervalSeconds: 60 };
  }


  const base = getWebhookUrl() || `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/webhooks/pipedream`;
  const webhookUrl = base.endsWith("/") ? `${base}${tenantId}` : `${base}/${tenantId}`;

  try {
    // Deploy the trigger via Pipedream API
    const response = await deployTrigger({
      id: triggerId,
      externalUserId: tenantId,
      configuredProps: fullConfiguredProps,
      webhookUrl,
      emitOnDeploy: false, // Don't emit historical events on deploy
    });

    const deployedTrigger = response.data;

    // Save the trigger deployment to our database
    const savedTrigger = await prisma.pipedreamTrigger.create({
      data: {
        tenantId,
        connectionId: connection.id,
        triggerId,
        deploymentId: deployedTrigger.id,
        configuredProps: (configuredProps || {}) as Prisma.InputJsonValue,
        status: deployedTrigger.active ? "active" : "paused",
      },
    });

    console.log(`Trigger deployed: deploymentId=${deployedTrigger.id}, triggerId=${triggerId}`);

    return NextResponse.json({
      success: true,
      trigger: {
        id: savedTrigger.id,
        deploymentId: deployedTrigger.id,
        triggerId,
        status: savedTrigger.status,
        active: deployedTrigger.active,
      },
    });
  } catch (error) {
    console.error("Failed to deploy Pipedream trigger:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to deploy trigger" },
      { status: 500 }
    );
  }
}
