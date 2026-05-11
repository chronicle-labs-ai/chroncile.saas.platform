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

async function handleCallback(
  request: NextRequest,
  code: string | null,
  state: string | null
) {
  if (!code || !state) {
    return redirectToConnections(request, {
      error: "Klaviyo returned an incomplete authorization callback.",
    });
  }

  const params = new URLSearchParams({ code, state });

  try {
    await fetchFromBackend(
      `/api/platform/integrations/klaviyo/callback?${params.toString()}`
    );

    return redirectToConnections(request, {
      success: "Klaviyo connected successfully.",
    });
  } catch (error) {
    return redirectToConnections(request, {
      error:
        error instanceof Error
          ? error.message
          : "Failed to complete the Klaviyo connection.",
    });
  }
}

export async function GET(request: NextRequest) {
  return handleCallback(
    request,
    request.nextUrl.searchParams.get("code"),
    request.nextUrl.searchParams.get("state")
  );
}

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const code = formData?.get("code");
  const state = formData?.get("state");

  return handleCallback(
    request,
    typeof code === "string" ? code : null,
    typeof state === "string" ? state : null
  );
}
