import { NextRequest, NextResponse } from "next/server";
import { handlePipedreamWebhookPost } from "@/server/integrations/pipedream-webhook-handler";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handlePipedreamWebhookPost(request);
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function GET(request: NextRequest) {
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
