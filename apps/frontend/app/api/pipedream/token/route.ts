import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createConnectToken, isPipedreamConfigured } from "@/lib/pipedream";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!isPipedreamConfigured()) {
    return NextResponse.json(
      { error: "Pipedream is not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { app } = body as { app?: string };

    const externalUserId = session.user.tenantId;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    
    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;
    
    const requestUrlOrigin = request.nextUrl.origin;
    
    const allowedOrigins = new Set<string>();
    
    if (appUrl) {
      allowedOrigins.add(appUrl);
      if (appUrl.includes("ngrok")) {
        const urlWithoutProtocol = appUrl.replace(/^https?:\/\//, "");
        allowedOrigins.add(`https://${urlWithoutProtocol}`);
        allowedOrigins.add(`http://${urlWithoutProtocol}`);
      }
    }
    
    if (requestOrigin) {
      allowedOrigins.add(requestOrigin);
    }
    
    if (requestUrlOrigin) {
      allowedOrigins.add(requestUrlOrigin);
      if (requestUrlOrigin.includes("localhost")) {
        allowedOrigins.add("http://localhost:3000");
        allowedOrigins.add("https://localhost:3000");
        allowedOrigins.add("http://127.0.0.1:3000");
        allowedOrigins.add("https://127.0.0.1:3000");
      }
    }
    
    if (appUrl.includes("localhost") || requestOrigin.includes("localhost") || requestUrlOrigin.includes("localhost")) {
      allowedOrigins.add("http://localhost:3000");
      allowedOrigins.add("https://localhost:3000");
      allowedOrigins.add("http://127.0.0.1:3000");
      allowedOrigins.add("https://127.0.0.1:3000");
    }
    
    const allowedOriginsArray = Array.from(allowedOrigins);

    console.log("[Pipedream Token] Creating token with:", {
      externalUserId,
      allowedOrigins: allowedOriginsArray,
      appUrl,
      requestOrigin,
      app,
    });

    const tokenResponse = await createConnectToken({
      externalUserId,
      app,
      allowedOrigins: allowedOriginsArray,
      successRedirectUri: `${appUrl}/dashboard/connections?pipedream_success=true${app ? `&app=${app}` : ""}`,
      errorRedirectUri: `${appUrl}/dashboard/connections?pipedream_error=true`,
      webhookUri: `${appUrl}/api/pipedream/auth-webhook`,
    });
    
    console.log("[Pipedream Token] Success! Connect URL:", tokenResponse.connect_link_url);

    return NextResponse.json({
      token: tokenResponse.token,
      connectLinkUrl: tokenResponse.connect_link_url,
      expiresAt: tokenResponse.expires_at,
    });
  } catch (error) {
    console.error("Failed to create Pipedream connect token:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create token" },
      { status: 500 }
    );
  }
}
