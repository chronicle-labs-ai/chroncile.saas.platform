import { NextRequest, NextResponse } from "next/server";
import { handlePipedreamWebhookPost } from "@/lib/pipedream-webhook-handler";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/pipedream
 *
 * Legacy webhook endpoint (tenant from query or deployment_id).
 * New deploys use /api/webhooks/pipedream/[tenantId] so tenant is in the path.
 */
export async function POST(request: NextRequest) {
  return handlePipedreamWebhookPost(request, {});
}

/**
 * HEAD /api/webhooks/pipedream
 * 
 * Health check endpoint for webhook verification
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

/**
 * GET /api/webhooks/pipedream
 * 
 * Verification endpoint - some services send GET requests to verify webhooks
 */
export async function GET(request: NextRequest) {
  // Handle any verification challenges
  const challenge = request.nextUrl.searchParams.get("challenge");
  if (challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({
    status: "ok",
    endpoint: "Pipedream webhook receiver",
    timestamp: new Date().toISOString(),
  });
}
