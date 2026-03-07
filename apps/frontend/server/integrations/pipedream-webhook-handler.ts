import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "platform-api";

const BACKEND_URL = getBackendUrl();

const FORWARDED_HEADERS = [
  "content-type",
  "x-pd-deployment-id",
  "x-pd-emitter-id",
];

export interface PipedreamTriggerEvent {
  id?: string;
  timestamp?: string;
  deployment_id?: string;
  [key: string]: unknown;
}

export interface HandleWebhookOptions {
  tenantIdFromPath?: string;
}

export async function handlePipedreamWebhookPost(
  request: NextRequest,
  options: HandleWebhookOptions = {},
): Promise<NextResponse> {
  const body = await request.text();
  const headers: Record<string, string> = {};

  for (const key of FORWARDED_HEADERS) {
    const val = request.headers.get(key);
    if (val) headers[key] = val;
  }
  if (!headers["content-type"]) {
    headers["content-type"] = "application/json";
  }

  const { tenantIdFromPath } = options;
  const backendPath = tenantIdFromPath
    ? `/api/webhooks/pipedream/${tenantIdFromPath}`
    : "/api/webhooks/pipedream";

  const url = new URL(backendPath, BACKEND_URL);
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers,
      body,
    });

    const responseBody = await res.text();
    return new NextResponse(responseBody || null, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to proxy Pipedream webhook to backend:", error);
    return NextResponse.json(
      { received: true, error: "Failed to proxy to backend" },
      { status: 200 },
    );
  }
}
