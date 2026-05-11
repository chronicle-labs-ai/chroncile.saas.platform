import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "platform-api";

export const dynamic = "force-dynamic";

const BACKEND_URL = getBackendUrl();
const FORWARDED_HEADERS = [
  "content-type",
  "klaviyo-webhook-id",
  "klaviyo-signature",
  "klaviyo-timestamp",
];

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headers: Record<string, string> = {};

  for (const key of FORWARDED_HEADERS) {
    const value = request.headers.get(key);
    if (value) headers[key] = value;
  }

  if (!headers["content-type"]) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(`${BACKEND_URL}/api/webhooks/klaviyo`, {
    method: "POST",
    headers,
    body,
  });

  const responseBody = await response.text();
  return new NextResponse(responseBody || null, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
