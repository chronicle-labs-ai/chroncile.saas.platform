import { NextRequest } from "next/server";
import { handlePipedreamWebhookPost } from "@/server/integrations/pipedream-webhook-handler";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  return handlePipedreamWebhookPost(request, {
    tenantIdFromPath: tenantId,
  });
}
