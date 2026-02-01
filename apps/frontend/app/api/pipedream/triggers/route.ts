import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listTriggers, listApps, isPipedreamConfigured } from "@/lib/pipedream";

export const dynamic = "force-dynamic";

/**
 * GET /api/pipedream/triggers
 * 
 * Lists available triggers from Pipedream.
 * Query params:
 * - app: Filter by app slug (e.g., "slack", "intercom")
 * - limit: Max results (default 50)
 * - q: Search query
 */
export async function GET(request: NextRequest) {
  // Verify user is authenticated
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

  const searchParams = request.nextUrl.searchParams;
  const app = searchParams.get("app") || undefined;
  const limit = parseInt(searchParams.get("limit") || "50");
  const query = searchParams.get("q") || undefined;

  try {
    const response = await listTriggers({ app, limit, query });
    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to list Pipedream triggers:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list triggers" },
      { status: 500 }
    );
  }
}
