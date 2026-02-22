import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { appendAuditLog } from "@/lib/audit-log";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/runs
 * List runs for tenant. Query: status, workflowId, limit, cursor (createdAt).
 */
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  let status = searchParams.get("status") ?? undefined;
  const needsReview = searchParams.get("needsReview") === "true";
  if (needsReview || status === "needs_review") status = "pending_review";
  const workflowId = searchParams.get("workflowId") ?? undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);
  const cursor = searchParams.get("cursor") ?? undefined;

  try {
    const runs = await prisma.run.findMany({
      where: {
        tenantId,
        ...(status && { status }),
        ...(workflowId && { workflowId }),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: {
        id: true,
        eventId: true,
        invocationId: true,
        workflowId: true,
        mode: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const hasMore = runs.length > limit;
    const items = hasMore ? runs.slice(0, limit) : runs;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    return NextResponse.json({
      runs: items,
      nextCursor,
      hasMore,
    });
  } catch (err) {
    console.error("List runs error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list runs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/runs
 * Create a run (tenant-scoped). Used to validate Run Store and for future Job Runner.
 * Body: eventId, invocationId, mode, optional eventSnapshot, optional workflowId.
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  let body: {
    eventId: string;
    invocationId: string;
    mode?: string;
    eventSnapshot?: Record<string, unknown>;
    workflowId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { eventId, invocationId, mode = "shadow", eventSnapshot, workflowId } = body;

  if (!eventId || !invocationId) {
    return NextResponse.json(
      { error: "Missing required fields: eventId, invocationId" },
      { status: 400 }
    );
  }

  try {
    const run = await prisma.run.create({
      data: {
        tenantId,
        eventId,
        invocationId,
        mode,
        status: "pending",
        ...(eventSnapshot !== undefined && {
          eventSnapshot: eventSnapshot as Prisma.InputJsonValue,
        }),
        ...(workflowId !== undefined && { workflowId }),
      },
    });

    await appendAuditLog({
      tenantId,
      runId: run.id,
      eventId,
      invocationId,
      action: "run_created",
      payload: { mode, workflowId: workflowId ?? null },
    });

    return NextResponse.json(run);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create run";
    if (message.includes("Unique constraint") || message.includes("invocationId")) {
      return NextResponse.json(
        { error: "Run with this invocationId already exists" },
        { status: 409 }
      );
    }
    console.error("Create run error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
