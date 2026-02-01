import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * @deprecated This endpoint is deprecated. Intercom connections are now managed through Pipedream.
 * Redirects to the connections page with a deprecation notice.
 */
export async function GET(request: NextRequest) {
  console.warn("[DEPRECATED] Direct Intercom OAuth callback endpoint called. Use Pipedream instead.");
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  
  // Redirect to connections page - Intercom is now connected via Pipedream
  return NextResponse.redirect(
    new URL("/dashboard/connections?error=intercom_oauth_deprecated", appUrl)
  );
}
