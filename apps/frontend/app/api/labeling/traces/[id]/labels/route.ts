import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLabelingStore } from "@/lib/labeling/store";
import type { HumanActionAudit } from "@/lib/labeling/types";

export const dynamic = "force-dynamic";

/** POST /api/labeling/traces/[id]/labels — save human action audit */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.tenantId || !session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { audit } = body as { audit: HumanActionAudit };

    if (!audit || typeof audit !== "object") {
      return NextResponse.json(
        { error: "audit object is required" },
        { status: 400 }
      );
    }

    const store = await getLabelingStore();
    const updated = await store.saveAudit(
      id,
      audit,
      session.user.id
    );

    if (!updated) {
      return NextResponse.json({ error: "Trace not found" }, { status: 404 });
    }

    return NextResponse.json({ trace: updated });
  } catch (err) {
    console.error("Failed to save audit:", err);
    return NextResponse.json(
      { error: "Failed to save audit" },
      { status: 500 }
    );
  }
}
