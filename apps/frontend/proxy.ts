import { NextResponse, type NextRequest } from "next/server";

import {
  isNetworkError,
  summarizeNetworkError,
} from "@/server/auth/network-errors";
import {
  getCookiePassword,
  getSessionCookieAttributes,
  SESSION_COOKIE_NAME,
} from "@/server/auth/session";
import { workos } from "@/server/auth/workos";

export const runtime = "nodejs";

const PUBLIC_PATHS = new Set<string>([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth-test",
  "/accept-invite",
]);

const PUBLIC_PREFIXES = [
  "/api/auth/",
  "/api/webhooks/",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

interface RedirectOptions {
  /** Drop the session cookie when the failure is "this session is no longer valid". */
  clearCookie?: boolean;
  /** Surfaced on the login page via the `humanizeError` map. */
  errorCode?: string;
}

function redirectToLogin(
  request: NextRequest,
  options: RedirectOptions = {},
): NextResponse {
  const loginUrl = new URL("/login", request.url);
  const { pathname } = request.nextUrl;
  if (pathname !== "/") {
    loginUrl.searchParams.set("from", pathname);
  }
  if (options.errorCode) {
    loginUrl.searchParams.set("error", options.errorCode);
  }
  const response = NextResponse.redirect(loginUrl);
  if (options.clearCookie) {
    response.cookies.delete(SESSION_COOKIE_NAME);
  }
  return response;
}

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const sessionData = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionData) {
    return redirectToLogin(request);
  }

  // Loading the sealed session is a synchronous local operation — it
  // can throw on a malformed cookie but never on the network.
  let session: {
    authenticate: () => Promise<{ authenticated: boolean; reason?: string }>;
    refresh: () => Promise<{
      authenticated: boolean;
      sealedSession?: string;
      reason?: string;
    }>;
  };
  try {
    session = (
      workos.userManagement as unknown as {
        loadSealedSession: (args: {
          sessionData: string;
          cookiePassword: string;
        }) => typeof session;
      }
    ).loadSealedSession({
      sessionData,
      cookiePassword: getCookiePassword(),
    });
  } catch (error) {
    console.warn(
      "[proxy] loadSealedSession failed:",
      error instanceof Error ? error.message : error,
    );
    return redirectToLogin(request, { clearCookie: true });
  }

  // `authenticate()` verifies the JWT signature against the WorkOS
  // JWKS endpoint. If the network is unreachable (laptop offline, VPN
  // dropped, DNS outage) this throws `TypeError: fetch failed` with a
  // `cause.code = "ENOTFOUND"`. Treat that as a transient outage:
  // bounce the user to the login page with a friendly banner and
  // *keep* the cookie so they're auto-signed-in when the network is
  // back.
  let authResult: { authenticated: boolean; reason?: string };
  try {
    authResult = await session.authenticate();
  } catch (error) {
    if (isNetworkError(error)) {
      console.warn(
        "[proxy] auth provider unreachable (authenticate):",
        summarizeNetworkError(error),
      );
      return redirectToLogin(request, { errorCode: "auth_unreachable" });
    }
    console.warn(
      "[proxy] session.authenticate failed:",
      error instanceof Error ? error.message : error,
    );
    return redirectToLogin(request, { clearCookie: true });
  }

  if (authResult.authenticated) {
    return NextResponse.next();
  }

  if (authResult.reason === "no_session_cookie_provided") {
    return redirectToLogin(request);
  }

  try {
    const refreshResult = await session.refresh();
    if (!refreshResult.authenticated || !refreshResult.sealedSession) {
      return redirectToLogin(request, { clearCookie: true });
    }

    const response = NextResponse.redirect(request.url);
    response.cookies.set(
      SESSION_COOKIE_NAME,
      refreshResult.sealedSession,
      getSessionCookieAttributes(),
    );
    return response;
  } catch (error) {
    if (isNetworkError(error)) {
      console.warn(
        "[proxy] auth provider unreachable (refresh):",
        summarizeNetworkError(error),
      );
      return redirectToLogin(request, { errorCode: "auth_unreachable" });
    }
    console.warn(
      "[proxy] session.refresh failed:",
      error instanceof Error ? error.message : error,
    );
    return redirectToLogin(request, { clearCookie: true });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon.ico|.*\\..*$).*)",
  ],
};
