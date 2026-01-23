import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { encrypt } from "@/lib/encryption";

export const dynamic = "force-dynamic";

interface IntercomTokenResponse {
  token_type: string;
  token: string;
  access_token?: string;
}

interface IntercomMeResponse {
  type: string;
  id: string;
  email: string;
  name: string;
  app: {
    type: string;
    id_code: string;
    name: string;
    created_at: number;
    region: string;
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  if (error) {
    console.error("Intercom OAuth error:", error);
    return NextResponse.redirect(
      new URL(`/dashboard/connections?error=${error}`, appUrl)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/connections?error=missing_params", appUrl)
    );
  }

  const storedState = request.cookies.get("intercom_oauth_state")?.value;
  if (!state || state !== storedState) {
    console.error("State mismatch - possible CSRF attack");
    return NextResponse.redirect(
      new URL("/dashboard/connections?error=invalid_state", appUrl)
    );
  }

  let tenantId: string;
  try {
    const stateData = JSON.parse(Buffer.from(state, "base64url").toString());
    tenantId = stateData.tenantId;

    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      return NextResponse.redirect(
        new URL("/dashboard/connections?error=state_expired", appUrl)
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard/connections?error=invalid_state_format", appUrl)
    );
  }

  const clientId = process.env.INTERCOM_CLIENT_ID;
  const clientSecret = process.env.INTERCOM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Intercom credentials not configured");
    return NextResponse.redirect(
      new URL("/dashboard/connections?error=configuration_error", appUrl)
    );
  }

  let accessToken: string;
  try {
    const tokenResponse = await fetch("https://api.intercom.io/auth/eagle/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        code,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return NextResponse.redirect(
        new URL("/dashboard/connections?error=token_exchange_failed", appUrl)
      );
    }

    const tokenData: IntercomTokenResponse = await tokenResponse.json();
    accessToken = tokenData.access_token || tokenData.token;

    if (!accessToken) {
      console.error("No access token in response");
      return NextResponse.redirect(
        new URL("/dashboard/connections?error=no_token", appUrl)
      );
    }
  } catch (err) {
    console.error("Token exchange error:", err);
    return NextResponse.redirect(
      new URL("/dashboard/connections?error=token_exchange_error", appUrl)
    );
  }

  let workspaceId: string;
  let workspaceName: string;
  let adminEmail: string;
  let region: string;

  try {
    const meResponse = await fetch("https://api.intercom.io/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!meResponse.ok) {
      const errorText = await meResponse.text();
      console.error("Failed to get workspace info:", errorText);
      return NextResponse.redirect(
        new URL("/dashboard/connections?error=workspace_info_failed", appUrl)
      );
    }

    const meData: IntercomMeResponse = await meResponse.json();
    workspaceId = meData.app?.id_code || "unknown";
    workspaceName = meData.app?.name || "Unknown Workspace";
    adminEmail = meData.email || "";
    region = meData.app?.region || "US";
  } catch (err) {
    console.error("Workspace info error:", err);
    return NextResponse.redirect(
      new URL("/dashboard/connections?error=workspace_info_error", appUrl)
    );
  }

  if (!process.env.ENCRYPTION_KEY) {
    console.error("ENCRYPTION_KEY not set - cannot encrypt token");
    return NextResponse.redirect(
      new URL("/dashboard/connections?error=encryption_not_configured", appUrl)
    );
  }

  try {
    await prisma.connection.upsert({
      where: {
        tenantId_provider: {
          tenantId,
          provider: "intercom",
        },
      },
      create: {
        tenantId,
        provider: "intercom",
        accessToken: encrypt(accessToken),
        metadata: {
          workspace_id: workspaceId,
          workspace_name: workspaceName,
          admin_email: adminEmail,
          region: region,
          connected_at: new Date().toISOString(),
        },
        status: "active",
      },
      update: {
        accessToken: encrypt(accessToken),
        metadata: {
          workspace_id: workspaceId,
          workspace_name: workspaceName,
          admin_email: adminEmail,
          region: region,
          connected_at: new Date().toISOString(),
        },
        status: "active",
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("Database error saving connection:", err);
    return NextResponse.redirect(
      new URL("/dashboard/connections?error=database_error", appUrl)
    );
  }

  const response = NextResponse.redirect(
    new URL("/dashboard/connections?success=intercom", appUrl)
  );
  response.cookies.delete("intercom_oauth_state");

  return response;
}
