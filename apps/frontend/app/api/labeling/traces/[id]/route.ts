import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLabelingStore } from "@/lib/labeling/store";

export const dynamic = "force-dynamic";

/** GET /api/labeling/traces/[id] — single trace with events */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const store = await getLabelingStore();
    const trace = await store.getById(session.user.tenantId, id);

    if (!trace) {
      return NextResponse.json({ error: "Trace not found" }, { status: 404 });
    }

    // Also get adjacent IDs for prev/next navigation
    const adjacent = await store.getAdjacentIds(
      session.user.tenantId,
      id,
    );

    return NextResponse.json({ trace, ...adjacent });
  } catch (err) {
    console.error("Failed to get trace:", err);
    return NextResponse.json({ error: "Failed to get trace" }, { status: 500 });
  }
}
