import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLabelingStore } from "@/lib/labeling/store";

export const dynamic = "force-dynamic";

/** POST /api/labeling/traces/[id]/skip — mark trace as skipped */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.tenantId || !session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const store = await getLabelingStore();
    const updated = await store.skip(id, session.user.id);

    if (!updated) {
      return NextResponse.json({ error: "Trace not found" }, { status: 404 });
    }

    return NextResponse.json({ trace: updated });
  } catch (err) {
    console.error("Failed to skip trace:", err);
    return NextResponse.json(
      { error: "Failed to skip trace" },
      { status: 500 }
    );
  }
}
