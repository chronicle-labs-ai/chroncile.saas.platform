import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { appendAuditLog } from "@/lib/audit-log";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/runs/[id]
 * Get one run by id (tenant-scoped). Returns full run including eventSnapshot, agentResponse, humanDecision.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const { id } = await params;

  try {
    const run = await prisma.run.findFirst({
      where: { id, tenantId },
    });

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    return NextResponse.json(run);
  } catch (err) {
    console.error("Get run error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get run" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/runs/[id]
 * Update run status and/or humanDecision (for review flow). Tenant-scoped.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const { id } = await params;

  let body: { status?: string; humanDecision?: Record<string, unknown> };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { status, humanDecision } = body;

  if (!status && humanDecision === undefined) {
    return NextResponse.json(
      { error: "Provide at least one of: status, humanDecision" },
      { status: 400 }
    );
  }

  try {
    const run = await prisma.run.findFirst({
      where: { id, tenantId },
    });

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const updated = await prisma.run.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(humanDecision !== undefined && {
          humanDecision: humanDecision as Prisma.InputJsonValue,
        }),
      },
    });

    await appendAuditLog({
      tenantId,
      runId: id,
      eventId: run.eventId,
      invocationId: run.invocationId,
      action: "run_updated",
      payload: {
        status: status ?? undefined,
        humanDecision: humanDecision !== undefined ? true : undefined,
      },
    });

    if (humanDecision !== undefined) {
      await appendAuditLog({
        tenantId,
        runId: id,
        eventId: run.eventId,
        invocationId: run.invocationId,
        action: "review_submitted",
        payload: { decision: (humanDecision as { decision?: string })?.decision },
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Update run error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update run" },
      { status: 500 }
    );
  }
}
