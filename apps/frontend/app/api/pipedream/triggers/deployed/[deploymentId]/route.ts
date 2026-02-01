import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  getDeployedTrigger,
  deleteDeployedTrigger,
  updateDeployedTrigger,
  isPipedreamConfigured,
} from "@/lib/pipedream";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ deploymentId: string }>;
}

/**
 * GET /api/pipedream/triggers/deployed/[deploymentId]
 * 
 * Get details for a specific deployed trigger.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deploymentId } = await params;

  // Verify the trigger belongs to this tenant
  const trigger = await prisma.pipedreamTrigger.findFirst({
    where: {
      deploymentId,
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
  });

  if (!trigger) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  try {
    // Get live status from Pipedream
    const pipedreamTrigger = await getDeployedTrigger(deploymentId);

    return NextResponse.json({
      id: trigger.id,
      deploymentId: trigger.deploymentId,
      triggerId: trigger.triggerId,
      connectionId: trigger.connectionId,
      provider: trigger.connection.provider,
      configuredProps: trigger.configuredProps,
      status: trigger.status,
      active: pipedreamTrigger.data.active,
      name: pipedreamTrigger.data.name,
      createdAt: trigger.createdAt,
      updatedAt: trigger.updatedAt,
    });
  } catch (error) {
    // Return database record if Pipedream API fails
    return NextResponse.json({
      id: trigger.id,
      deploymentId: trigger.deploymentId,
      triggerId: trigger.triggerId,
      connectionId: trigger.connectionId,
      provider: trigger.connection.provider,
      configuredProps: trigger.configuredProps,
      status: trigger.status,
      active: trigger.status === "active",
      createdAt: trigger.createdAt,
      updatedAt: trigger.updatedAt,
    });
  }
}

/**
 * DELETE /api/pipedream/triggers/deployed/[deploymentId]
 * 
 * Delete a deployed trigger.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

  const { deploymentId } = await params;

  // Verify the trigger belongs to this tenant
  const trigger = await prisma.pipedreamTrigger.findFirst({
    where: {
      deploymentId,
      tenantId: session.user.tenantId,
    },
  });

  if (!trigger) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  try {
    // Delete from Pipedream
    await deleteDeployedTrigger(deploymentId);

    // Delete from our database
    await prisma.pipedreamTrigger.delete({
      where: { id: trigger.id },
    });

    console.log(`Trigger deleted: deploymentId=${deploymentId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete trigger:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete trigger" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/pipedream/triggers/deployed/[deploymentId]
 * 
 * Update a deployed trigger (e.g., pause/resume).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

  const { deploymentId } = await params;

  let body: { active?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Verify the trigger belongs to this tenant
  const trigger = await prisma.pipedreamTrigger.findFirst({
    where: {
      deploymentId,
      tenantId: session.user.tenantId,
    },
  });

  if (!trigger) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  try {
    // Update in Pipedream
    const updated = await updateDeployedTrigger(deploymentId, {
      active: body.active,
    });

    // Update in our database
    await prisma.pipedreamTrigger.update({
      where: { id: trigger.id },
      data: {
        status: updated.data.active ? "active" : "paused",
        updatedAt: new Date(),
      },
    });

    console.log(`Trigger updated: deploymentId=${deploymentId}, active=${updated.data.active}`);

    return NextResponse.json({
      success: true,
      active: updated.data.active,
    });
  } catch (error) {
    console.error("Failed to update trigger:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update trigger" },
      { status: 500 }
    );
  }
}
