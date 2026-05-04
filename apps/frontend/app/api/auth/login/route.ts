import { NextResponse, type NextRequest } from "next/server";

import { getBackendUrl } from "platform-api";

import { classifyAuthError } from "@/server/auth/auth-errors";
import {
  getCookiePassword,
  rebindSealedSessionToOrganization,
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

interface PasswordAuthSessionResult {
  sealedSession?: string;
  organizationId?: string;
  user?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
}

interface PasswordAuthenticator {
  authenticateWithPassword(args: {
    clientId: string;
    email: string;
    password: string;
    invitationToken?: string;
    /**
     * Optional WorkOS organization id. When provided, the auth attempt is
     * scoped to that org and WorkOS will not raise
     * `organization_selection_required`. Used to land multi-org users in
     * their primary workspace transparently.
     */
    organizationId?: string;
    ipAddress?: string;
    userAgent?: string;
    session: {
      sealSession: boolean;
      cookiePassword: string;
    };
  }): Promise<PasswordAuthSessionResult>;
}

interface PrimaryOrgLookupResponse {
  tenantId?: string | null;
  workosOrganizationId?: string | null;
}

async function lookupPrimaryOrgByEmail(
  email: string,
): Promise<string | undefined> {
  const serviceSecret = process.env.SERVICE_SECRET;
  if (!serviceSecret) {
    console.warn(
      "[auth/login] SERVICE_SECRET not set — skipping primary-org lookup. Add SERVICE_SECRET to apps/frontend/.env.local (must match backend).",
    );
    return undefined;
  }
  try {
    const res = await fetch(
      `${getBackendUrl()}/api/platform/users/primary-org`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceSecret, email }),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(
        "[auth/login] primary-org lookup non-ok:",
        res.status,
        detail,
      );
      return undefined;
    }
    const data = (await res.json()) as PrimaryOrgLookupResponse;
    if (
      typeof data.workosOrganizationId === "string" &&
      data.workosOrganizationId.length > 0
    ) {
      console.info(
        "[auth/login] primary-org resolved for",
        email,
        "→",
        data.workosOrganizationId,
      );
      return data.workosOrganizationId;
    }
    console.warn(
      "[auth/login] primary-org lookup returned empty for",
      email,
      "(user not in local DB or no primary tenant set) — fallback to WorkOS first-org",
    );
    return undefined;
  } catch (err) {
    console.warn(
      "[auth/login] primary-org lookup failed:",
      err instanceof Error ? err.message : err,
    );
    return undefined;
  }
}

function getClientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || undefined;
  return request.headers.get("x-real-ip") ?? undefined;
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
    primaryOrgId = await lookupPrimaryOrgByEmail(email);
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
    try {
      const invitation = await workos.userManagement.findInvitationByToken(
        invitationToken,
      );
      if (
        invitation.organizationId &&
        invitation.organizationId !== organizationId
      ) {
        const rebound = await rebindSealedSessionToOrganization(
          sealedSession,
          invitation.organizationId,
        );
        if (rebound) {
          sealedSession = rebound;
          organizationId = invitation.organizationId;
        } else {
          console.warn(
            "[auth/login] could not rebind session to invitation org; falling through with original session",
          );
        }
      }

      if (invitation.organizationId && result.user?.id) {
        const serviceSecret = process.env.SERVICE_SECRET;
        if (!serviceSecret) {
          console.error(
            "[auth/login] SERVICE_SECRET missing — cannot provision invited user in backend",
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

        let registerRes: Response;
        try {
          registerRes = await fetch(
            `${getBackendUrl()}/api/platform/tenants/register-workos`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                serviceSecret,
                workosUserId: result.user.id,
                workosOrganizationId: invitation.organizationId,
                email: result.user.email,
                name: "",
                slug: "",
                firstName: result.user.firstName ?? null,
                lastName: result.user.lastName ?? null,
              }),
            },
          );
        } catch (error) {
          console.error(
            "[auth/login] backend register-workos network error:",
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

        if (!registerRes.ok) {
          const detail = await registerRes.text().catch(() => "");
          console.error(
            "[auth/login] backend register-workos returned non-ok",
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
      }
    } catch (error) {
      console.warn(
        "[auth/login] post-auth invitation lookup failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  await setSealedSession(sealedSession);

  const fallback = !organizationId ? "/onboarding/workspace" : "/dashboard";
  const redirect = !organizationId ? fallback : safeRedirect(fromHeader);

  return NextResponse.json({ ok: true, redirect });
}
