import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/audit
 * Tenant-wide audit log for admin/compliance. Query: runId, eventId, action, start, end, limit.
 */
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId") ?? undefined;
  const eventId = searchParams.get("eventId") ?? undefined;
  const action = searchParams.get("action") ?? undefined;
  const start = searchParams.get("start") ?? undefined;
  const end = searchParams.get("end") ?? undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 500);

  try {
    const startDate = start ? new Date(start) : undefined;
    const endDate = end ? new Date(end) : undefined;

    const entries = await prisma.auditLog.findMany({
      where: {
        tenantId,
        ...(runId && { runId }),
        ...(eventId && { eventId }),
        ...(action && { action }),
        ...((startDate || endDate) && {
          createdAt: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ entries });
  } catch (err) {
    console.error("Get audit error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get audit" },
      { status: 500 }
    );
  }
}
