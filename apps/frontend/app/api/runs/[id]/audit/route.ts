import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/runs/[id]/audit
 * List audit entries for run id (tenant-scoped), ordered by createdAt.
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

    const entries = await prisma.auditLog.findMany({
      where: { runId: id, tenantId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ entries });
  } catch (err) {
    console.error("Get run audit error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get audit" },
      { status: 500 }
    );
  }
}
