import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const clientId = process.env.INTERCOM_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  if (!clientId) {
    console.error("INTERCOM_CLIENT_ID is not configured");
    return NextResponse.redirect(
      new URL("/dashboard/connections?error=configuration_error", request.url)
    );
  }

  const stateData = {
    tenantId: session.user.tenantId,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  };
  const state = Buffer.from(JSON.stringify(stateData)).toString("base64url");

  const redirectUri = `${appUrl}/api/connections/intercom/callback`;
  const intercomAuthUrl = new URL("https://app.intercom.com/oauth");
  intercomAuthUrl.searchParams.set("client_id", clientId);
  intercomAuthUrl.searchParams.set("state", state);
  intercomAuthUrl.searchParams.set("redirect_uri", redirectUri);

  const response = NextResponse.redirect(intercomAuthUrl.toString());

  response.cookies.set("intercom_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  return response;
}
