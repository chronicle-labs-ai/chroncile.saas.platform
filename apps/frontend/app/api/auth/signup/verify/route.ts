import { NextResponse, type NextRequest } from "next/server";

import { getBackendUrl } from "platform-api";

import { classifyAuthError } from "@/server/auth/auth-errors";
import { getCookiePassword, setSealedSession } from "@/server/auth/session";
import {
  assertWorkOSEnvironment,
  workos,
  WORKOS_CLIENT_ID,
} from "@/server/auth/workos";

export const dynamic = "force-dynamic";

interface VerifyBody {
  pendingAuthenticationToken?: unknown;
  code?: unknown;
}

interface EmailVerificationSessionResult {
  sealedSession?: string;
  organizationId?: string;
  user?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
}

interface EmailVerificationAuthenticator {
  authenticateWithEmailVerification(args: {
    clientId: string;
    pendingAuthenticationToken: string;
    code: string;
    ipAddress?: string;
    userAgent?: string;
    session: {
      sealSession: boolean;
      cookiePassword: string;
    };
  }): Promise<EmailVerificationSessionResult>;
}

function getClientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || undefined;
  return request.headers.get("x-real-ip") ?? undefined;
}

export async function POST(request: NextRequest) {
  assertWorkOSEnvironment();

  const body = (await request.json().catch(() => null)) as VerifyBody | null;
  const pendingAuthenticationToken =
    typeof body?.pendingAuthenticationToken === "string"
      ? body.pendingAuthenticationToken.trim()
      : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!pendingAuthenticationToken) {
    return NextResponse.json(
      { error: "missing_pending_token" },
      { status: 400 },
    );
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "invalid_code_format" },
      { status: 400 },
    );
  }

  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const userManagement = workos.userManagement as typeof workos.userManagement &
    EmailVerificationAuthenticator;

  let result: EmailVerificationSessionResult;
  try {
    result = await userManagement.authenticateWithEmailVerification({
      clientId: WORKOS_CLIENT_ID,
      code,
      pendingAuthenticationToken,
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
      "[auth/signup/verify] authenticateWithEmailVerification failed:",
      classified.code,
      classified.message,
    );

    if (
      classified.code === "invalid_one_time_code" ||
      classified.code === "invalid_code" ||
      /code/i.test(classified.message)
    ) {
      return NextResponse.json(
        { error: "invalid_code", message: classified.message },
        { status: 400 },
      );
    }
    if (
      classified.code.startsWith("pending_authentication_token") ||
      /token/i.test(classified.message)
    ) {
      return NextResponse.json(
        { error: "token_invalid", message: classified.message },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: classified.code || "verify_failed" },
      { status: 400 },
    );
  }

  const { sealedSession, organizationId, user: workosUser } = result;

  if (!sealedSession) {
    console.error(
      "[auth/signup/verify] SDK returned no sealedSession despite sealSession=true",
    );
    return NextResponse.json({ error: "sealing_failed" }, { status: 500 });
  }

  if (organizationId && workosUser?.id) {
    const serviceSecret = process.env.SERVICE_SECRET;
    if (!serviceSecret) {
      console.error(
        "[auth/signup/verify] SERVICE_SECRET missing — cannot mirror invited membership in backend",
      );
      return NextResponse.json(
        {
          error: "service_secret_not_configured",
          detail:
            "SERVICE_SECRET env var is not set in apps/frontend. Add it and restart.",
        },
        { status: 500 },
      );
    }

    try {
      const registerRes = await fetch(
        `${getBackendUrl()}/api/platform/tenants/register-workos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceSecret,
            workosUserId: workosUser.id,
            workosOrganizationId: organizationId,
            email: workosUser.email,
            // Empty name/slug → backend takes the "tenant already exists"
            // attach-membership branch instead of creating a new tenant.
            name: "",
            slug: "",
            firstName: workosUser.firstName ?? null,
            lastName: workosUser.lastName ?? null,
          }),
        },
      );
      if (!registerRes.ok) {
        const detail = await registerRes.text().catch(() => "");
        console.error(
          "[auth/signup/verify] backend register-workos returned non-ok",
          registerRes.status,
          detail,
        );
        return NextResponse.json(
          {
            error: "invitation_provision_failed",
            backendStatus: registerRes.status,
            detail,
          },
          { status: 500 },
        );
      }
    } catch (error) {
      console.error(
        "[auth/signup/verify] backend register-workos network error:",
        error instanceof Error ? error.message : error,
      );
      return NextResponse.json(
        {
          error: "backend_unreachable",
          detail: error instanceof Error ? error.message : String(error),
        },
        { status: 502 },
      );
    }
  }

  await setSealedSession(sealedSession);

  return NextResponse.json({
    ok: true,
    redirect: organizationId ? "/dashboard" : "/onboarding/workspace",
  });
}
