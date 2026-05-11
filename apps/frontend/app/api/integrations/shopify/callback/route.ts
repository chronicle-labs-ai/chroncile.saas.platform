import { NextRequest, NextResponse } from "next/server";
import { fetchFromBackend } from "@/server/backend/fetch-from-backend";

export const dynamic = "force-dynamic";

function appOrigin(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

function redirectToConnections(
  request: NextRequest,
  params: Record<string, string>
) {
  const url = new URL("/dashboard/connections", appOrigin(request));
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

function callbackParamsFromRequest(request: NextRequest) {
  const params = new URLSearchParams();
  for (const key of ["code", "state", "shop", "hmac", "timestamp", "host"]) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) params.set(key, value);
  }
  return params;
}

async function handleCallback(request: NextRequest, params: URLSearchParams) {
  const code = params.get("code");
  const state = params.get("state");
  const shop = params.get("shop");
  const hmac = params.get("hmac");
  const timestamp = params.get("timestamp");

  if (!code || !state || !shop || !hmac || !timestamp) {
    return redirectToConnections(request, {
      error: "Shopify returned an incomplete authorization callback.",
    });
  }

  try {
    await fetchFromBackend(
      `/api/platform/integrations/shopify/callback?${params.toString()}`
    );

    return redirectToConnections(request, {
      success: "Shopify connected successfully.",
    });
  } catch (error) {
    return redirectToConnections(request, {
      error:
        error instanceof Error
          ? error.message
          : "Failed to complete the Shopify connection.",
    });
  }
}

export async function GET(request: NextRequest) {
  return handleCallback(request, callbackParamsFromRequest(request));
}

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const params = new URLSearchParams();

  for (const key of ["code", "state", "shop", "hmac", "timestamp", "host"]) {
    const value = formData?.get(key);
    if (typeof value === "string" && value) params.set(key, value);
  }

  return handleCallback(request, params);
}
