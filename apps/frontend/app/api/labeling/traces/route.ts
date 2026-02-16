import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLabelingStore } from "@/lib/labeling/store";
import type { TraceFilters } from "@/lib/labeling/types";

export const dynamic = "force-dynamic";

/** GET /api/labeling/traces — list traces with filters */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const filters: TraceFilters = {};
  if (searchParams.get("status")) filters.status = searchParams.get("status") as TraceFilters["status"];
  if (searchParams.get("source")) filters.source = searchParams.get("source")!;
  if (searchParams.get("minConfidence")) filters.minConfidence = parseFloat(searchParams.get("minConfidence")!);
  if (searchParams.get("maxConfidence")) filters.maxConfidence = parseFloat(searchParams.get("maxConfidence")!);
  if (searchParams.get("search")) filters.search = searchParams.get("search")!;
  if (searchParams.get("sortBy")) filters.sortBy = searchParams.get("sortBy") as TraceFilters["sortBy"];
  if (searchParams.get("sortDir")) filters.sortDir = searchParams.get("sortDir") as TraceFilters["sortDir"];
  if (searchParams.get("limit")) filters.limit = parseInt(searchParams.get("limit")!, 10);
  if (searchParams.get("offset")) filters.offset = parseInt(searchParams.get("offset")!, 10);

  try {
    const store = await getLabelingStore();
    const result = await store.list(session.user.tenantId, filters);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to list traces:", err);
    return NextResponse.json({ error: "Failed to list traces" }, { status: 500 });
  }
}
