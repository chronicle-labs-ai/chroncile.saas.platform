import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { LEAD_GEN_MOCK_LEADS } from "@/lib/lead-gen-mock-data";

export const dynamic = "force-dynamic";

/**
 * GET /api/lead-gen/clay-search
 * Returns mock leads (CPG/D2C + call center + AI exploration). No external API calls.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20;
  const leads = LEAD_GEN_MOCK_LEADS.slice(0, limit);

  return NextResponse.json({ leads });
}
