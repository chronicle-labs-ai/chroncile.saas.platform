import { NextRequest } from "next/server";
import { handlePipedreamWebhookPost } from "@/lib/pipedream-webhook-handler";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/pipedream/[tenantId]
 *
 * Webhook endpoint with tenant in the path. Use this URL when deploying
 * Pipedream triggers so the tenant is always present (query string is not
 * sent by Pipedream on POST).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  return handlePipedreamWebhookPost(request, { tenantIdFromPath: tenantId });
}
