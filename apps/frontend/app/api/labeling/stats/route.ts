import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLabelingStore } from "@/lib/labeling/store";

export const dynamic = "force-dynamic";

/** GET /api/labeling/stats — labeling queue statistics */
export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const store = await getLabelingStore();
    const stats = await store.getStats(session.user.tenantId);
    return NextResponse.json(stats);
  } catch (err) {
    console.error("Failed to get stats:", err);
    return NextResponse.json(
      { error: "Failed to get stats" },
      { status: 500 }
    );
  }
}
