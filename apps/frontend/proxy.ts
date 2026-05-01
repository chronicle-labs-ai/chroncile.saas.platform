import { NextResponse, type NextRequest } from "next/server";

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
]);

const PUBLIC_PREFIXES = [
  "/api/auth/",
  "/api/webhooks/",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function redirectToLogin(request: NextRequest, clearCookie: boolean): NextResponse {
  const loginUrl = new URL("/login", request.url);
  const { pathname } = request.nextUrl;
  if (pathname !== "/") {
    loginUrl.searchParams.set("from", pathname);
  }
  const response = NextResponse.redirect(loginUrl);
  if (clearCookie) {
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
    return redirectToLogin(request, false);
  }

  const session = (workos.userManagement as unknown as {
    loadSealedSession: (args: { sessionData: string; cookiePassword: string }) => {
      authenticate: () => Promise<{ authenticated: boolean; reason?: string }>;
      refresh: () => Promise<{ authenticated: boolean; sealedSession?: string; reason?: string }>;
    };
  }).loadSealedSession({
    sessionData,
    cookiePassword: getCookiePassword(),
  });

  const authResult = await session.authenticate();
  if (authResult.authenticated) {
    return NextResponse.next();
  }

  if (authResult.reason === "no_session_cookie_provided") {
    return redirectToLogin(request, false);
  }

  try {
    const refreshResult = await session.refresh();
    if (!refreshResult.authenticated || !refreshResult.sealedSession) {
      return redirectToLogin(request, true);
    }

    const response = NextResponse.redirect(request.url);
    response.cookies.set(
      SESSION_COOKIE_NAME,
      refreshResult.sealedSession,
      getSessionCookieAttributes(),
    );
    return response;
  } catch (error) {
    console.warn(
      "[proxy] session.refresh failed:",
      error instanceof Error ? error.message : error,
    );
    return redirectToLogin(request, true);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon.ico|.*\\..*$).*)",
  ],
};
