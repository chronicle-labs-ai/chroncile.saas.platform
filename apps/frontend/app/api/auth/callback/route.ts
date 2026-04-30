import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { classifyAuthError } from "@/server/auth/auth-errors";
import {
  getCookiePassword,
  setSealedSession,
} from "@/server/auth/session";
import { verifyOAuthState } from "@/server/auth/state-token";
import {
  assertWorkOSEnvironment,
  workos,
  WORKOS_CLIENT_ID,
} from "@/server/auth/workos";

function errorRedirect(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

function getClientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || undefined;
  }
  return request.headers.get("x-real-ip") ?? undefined;
}

export async function GET(request: NextRequest) {
  assertWorkOSEnvironment();

  // 1. Provider-level error came back (user hit "Cancel" on Google, etc.).
  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) {
    const desc = request.nextUrl.searchParams.get("error_description") ?? "";
    console.warn("[auth/callback] provider returned error:", providerError, desc);
    errorRedirect(providerError);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code) errorRedirect("missing_code");
  if (!state) errorRedirect("missing_state");

  const stateData = verifyOAuthState(state);
  if (!stateData) errorRedirect("oauth_state_invalid");

  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? undefined;

  // 2. Exchange the code for a sealed session.
  let result;
  try {
    // SDK 9.1.1 ships `sealSession` at runtime; .d.ts lags.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result = await (workos.userManagement as any).authenticateWithCode({
      code,
      clientId: WORKOS_CLIENT_ID,
      ipAddress,
      userAgent,
      session: {
        sealSession: true,
        cookiePassword: getCookiePassword(),
      },
    });
  } catch (error) {
    const classified = classifyAuthError(error);
    console.warn(
      "[auth/callback] authenticateWithCode failed:",
      classified.code,
      classified.message,
    );

    if (
      classified.code === "email_verification_required" &&
      classified.pendingAuthenticationToken
    ) {
      const params = new URLSearchParams({ step: "verify" });
      if (classified.email) params.set("email", classified.email);
      params.set("token", classified.pendingAuthenticationToken);
      redirect(`/signup?${params.toString()}`);
    }

    errorRedirect(classified.code);
  }

  const { sealedSession, organizationId } = result as {
    sealedSession?: string;
    organizationId?: string;
  };

  if (!sealedSession) {
    console.error(
      "[auth/callback] SDK returned no sealedSession despite sealSession=true",
    );
    errorRedirect("sealing_failed");
  }

  await setSealedSession(sealedSession);

  if (!organizationId) {
    redirect("/onboarding/workspace");
  }

  redirect(stateData.from ?? "/dashboard");
}
