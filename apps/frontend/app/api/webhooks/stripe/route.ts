import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "platform-api";

export const dynamic = "force-dynamic";
const BACKEND_URL = getBackendUrl();

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headers: Record<string, string> = {};

  const contentType = request.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;

  const signature = request.headers.get("stripe-signature");
  if (signature) headers["stripe-signature"] = signature;

  const res = await fetch(`${BACKEND_URL}/api/webhooks/stripe`, {
    method: "POST",
    headers,
    body,
  });

  const responseBody = await res.text();
  return new NextResponse(responseBody || null, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
