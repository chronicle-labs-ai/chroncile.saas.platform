import { NextResponse, type NextRequest } from "next/server";

import { classifyAuthError } from "@/server/auth/auth-errors";
import {
  getClientIp,
  type PasswordAuthSessionResult,
  type PasswordAuthenticator,
} from "@/server/auth/password-auth";
import { lookupPrimaryOrgByEmail } from "@/server/auth/primary-org";
import { provisionInvitedUser } from "@/server/auth/provision-invited-user";
import {
  getCookiePassword,
  setSealedSession,
} from "@/server/auth/session";
import {
  assertWorkOSEnvironment,
  workos,
  WORKOS_CLIENT_ID,
} from "@/server/auth/workos";

export const dynamic = "force-dynamic";

interface LoginBody {
  email?: unknown;
  password?: unknown;
  invitationToken?: unknown;
  organizationId?: unknown;
}

function safeRedirect(value: unknown): string {
  if (typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export async function POST(request: NextRequest) {
  assertWorkOSEnvironment();

  const body = (await request.json().catch(() => null)) as LoginBody | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const invitationToken =
    typeof body?.invitationToken === "string" && body.invitationToken.length > 0
      ? body.invitationToken
      : undefined;

  if (!email || !password) {
    return NextResponse.json(
      { error: "missing_credentials" },
      { status: 400 },
    );
  }

  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const fromHeader = request.headers.get("x-auth-from");
  const userManagement = workos.userManagement as typeof workos.userManagement &
    PasswordAuthenticator;

  const explicitOrganizationId =
    typeof body?.organizationId === "string" && body.organizationId.length > 0
      ? body.organizationId
      : undefined;
  let primaryOrgId = explicitOrganizationId;
  if (!primaryOrgId) {
    primaryOrgId = await lookupPrimaryOrgByEmail(email, "auth/login");
  }

  let result: PasswordAuthSessionResult;
  try {
    result = await userManagement.authenticateWithPassword({
      clientId: WORKOS_CLIENT_ID,
      email,
      password,
      invitationToken,
      ipAddress,
      userAgent,
      ...(primaryOrgId ? { organizationId: primaryOrgId } : {}),
      session: {
        sealSession: true,
        cookiePassword: getCookiePassword(),
      },
    });
  } catch (error) {
    const classified = classifyAuthError(error);

    switch (classified.code) {
      case "email_verification_required":
        return NextResponse.json(
          {
            ok: false,
            code: classified.code,
            pendingAuthenticationToken: classified.pendingAuthenticationToken,
            email: classified.email ?? email,
          },
          { status: 200 },
        );

      case "sso_required":
        return NextResponse.json(
          {
            ok: false,
            code: classified.code,
            connectionIds: classified.connectionIds ?? [],
            email: classified.email ?? email,
          },
          { status: 200 },
        );

      case "organization_authentication_methods_required":
        return NextResponse.json(
          {
            ok: false,
            code: classified.code,
            authMethods: classified.authMethods ?? {},
            connectionIds: classified.connectionIds ?? [],
          },
          { status: 200 },
        );

      case "organization_selection_required": {
        // Fallback: we already tried to pre-select the user's primary org
        // before calling WorkOS. If we still hit this error, it means the
        // backend didn't know the user yet (no primary recorded) or the
        // lookup was unavailable. Pick the first org WorkOS reported and
        // retry transparently — the user will land somewhere reasonable
        // and can use the switcher to move.
        const fallbackOrgId = classified.organizations?.[0]?.id;
        if (fallbackOrgId && !explicitOrganizationId) {
          try {
            result = await userManagement.authenticateWithPassword({
              clientId: WORKOS_CLIENT_ID,
              email,
              password,
              invitationToken,
              organizationId: fallbackOrgId,
              ipAddress,
              userAgent,
              session: {
                sealSession: true,
                cookiePassword: getCookiePassword(),
              },
            });
            break;
          } catch (retryErr) {
            console.warn(
              "[auth/login] retry with fallback org failed:",
              retryErr instanceof Error ? retryErr.message : retryErr,
            );
          }
        }
        return NextResponse.json(
          { error: classified.code, message: classified.message },
          { status: 501 },
        );
      }

      case "mfa_enrollment":
      case "mfa_challenge":
        return NextResponse.json(
          { error: classified.code, message: classified.message },
          { status: 501 },
        );

      default:
        console.warn(
          "[auth/login] authenticateWithPassword failed:",
          classified.code,
          classified.message,
        );
        return NextResponse.json(
          { error: "invalid_credentials" },
          { status: 401 },
        );
    }
  }

  let { sealedSession, organizationId } = result;

  if (!sealedSession) {
    console.error(
      "[auth/login] SDK returned no sealedSession despite sealSession=true",
    );
    return NextResponse.json({ error: "sealing_failed" }, { status: 500 });
  }

  if (invitationToken) {
    const outcome = await provisionInvitedUser(
      result,
      invitationToken,
      "auth/login",
    );
    if (outcome.kind === "response") return outcome.response;
    sealedSession = outcome.result.sealedSession;
    organizationId = outcome.result.organizationId;
  }

  await setSealedSession(sealedSession);

  const fallback = !organizationId ? "/onboarding/workspace" : "/dashboard";
  const redirect = !organizationId ? fallback : safeRedirect(fromHeader);

  return NextResponse.json({ ok: true, redirect });
}
