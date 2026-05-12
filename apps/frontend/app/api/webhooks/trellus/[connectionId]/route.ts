import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "platform-api";

export const dynamic = "force-dynamic";

const BACKEND_URL = getBackendUrl();
const FORWARDED_HEADERS = ["content-type", "x-chronicle-webhook-secret"];
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-chronicle-webhook-secret",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params;
  const body = await request.text();
  const headers: Record<string, string> = {};

  for (const key of FORWARDED_HEADERS) {
    const value = request.headers.get(key);
    if (value) headers[key] = value;
  }

  if (!headers["content-type"]) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(
    `${BACKEND_URL}/api/webhooks/trellus/${connectionId}`,
    {
      method: "POST",
      headers,
      body,
    }
  );

  const responseBody = await response.text();
  return new NextResponse(responseBody || null, {
    status: response.status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
}
