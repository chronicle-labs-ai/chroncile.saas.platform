import { NextResponse, type NextRequest } from "next/server";
import { getBackendUrl } from "platform-api";

import {
  classifyAuthError,
  isEmailAlreadyExistsError,
  isWeakPasswordError,
} from "@/server/auth/auth-errors";
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

interface SignupBody {
  email?: unknown;
  password?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  invitationToken?: unknown;
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
    ipAddress?: string;
    userAgent?: string;
    session: {
      sealSession: boolean;
      cookiePassword: string;
    };
  }): Promise<PasswordAuthSessionResult>;
}

function getClientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || undefined;
  return request.headers.get("x-real-ip") ?? undefined;
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: NextRequest) {
  assertWorkOSEnvironment();

  const body = (await request.json().catch(() => null)) as SignupBody | null;
  const email = trimOrNull(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  const firstName = trimOrNull(body?.firstName);
  const lastName = trimOrNull(body?.lastName);
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

  let userId: string | undefined;

  if (invitationToken) {
    let invitation;
    try {
      invitation = await workos.userManagement.findInvitationByToken(
        invitationToken,
      );
    } catch (error) {
      console.error(
        "[auth/signup] findInvitationByToken failed:",
        error instanceof Error ? error.message : error,
      );
      return NextResponse.json(
        { error: "invitation_not_found" },
        { status: 404 },
      );
    }
    if (invitation.state !== "pending") {
      return NextResponse.json(
        {
          error:
            invitation.state === "expired"
              ? "invitation_expired"
              : "invitation_not_pending",
        },
        { status: 410 },
      );
    }
    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: "invitation_email_mismatch" },
        { status: 400 },
      );
    }

    const list = await workos.userManagement.listUsers({ email, limit: 1 });
    const preAllocated = list.data[0];
    if (!preAllocated) {
      // Fallback: invitation says pending but no user record was found.
      // Treat as a fresh signup (will most likely succeed; if WorkOS
      // returns `email_not_available` the catch below surfaces it).
      console.warn(
        "[auth/signup] invitation pending but no pre-allocated user found; falling through to createUser",
      );
    } else {
      try {
        await workos.userManagement.updateUser({
          userId: preAllocated.id,
          password,
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
        });
        userId = preAllocated.id;
      } catch (error) {
        if (isWeakPasswordError(error)) {
          const classified = classifyAuthError(error);
          return NextResponse.json(
            { error: "weak_password", message: classified.message },
            { status: 422 },
          );
        }
        const detail =
          error && typeof error === "object" && "errors" in error
            ? (error as { errors: unknown }).errors
            : undefined;
        console.error(
          "[auth/signup] updateUser on pre-allocated invitee failed:",
          error,
          "errors:",
          JSON.stringify(detail, null, 2),
        );
        return NextResponse.json(
          { error: "user_creation_failed" },
          { status: 500 },
        );
      }
    }
  }

  if (!userId) {
    try {
      const created = await workos.userManagement.createUser({
        email,
        password,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      });
      userId = created.id;
    } catch (error) {
      if (isEmailAlreadyExistsError(error)) {
        return NextResponse.json(
          { error: "email_already_exists", email },
          { status: 409 },
        );
      }
      if (isWeakPasswordError(error)) {
        const classified = classifyAuthError(error);
        return NextResponse.json(
          { error: "weak_password", message: classified.message },
          { status: 422 },
        );
      }
      // WorkOS often wraps the actual cause in `errors[]`. Dump that array
      // explicitly so it's not truncated to "[Array]" in the dev console.
      const detail =
        error && typeof error === "object" && "errors" in error
          ? (error as { errors: unknown }).errors
          : undefined;
      console.error(
        "[auth/signup] createUser failed:",
        error,
        "errors:",
        JSON.stringify(detail, null, 2),
      );
      return NextResponse.json(
        { error: "user_creation_failed" },
        { status: 500 },
      );
    }
  }

  if (!userId) {
    console.error(
      "[auth/signup] reached auth phase without a userId — invariant broken",
    );
    return NextResponse.json({ error: "user_creation_failed" }, { status: 500 });
  }

  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const userManagement = workos.userManagement as typeof workos.userManagement &
    PasswordAuthenticator;

  let authResult: PasswordAuthSessionResult | null = null;
  let authError: unknown = null;
  try {
    authResult = await userManagement.authenticateWithPassword({
      clientId: WORKOS_CLIENT_ID,
      email,
      password,
      invitationToken,
      ipAddress,
      userAgent,
      session: {
        sealSession: true,
        cookiePassword: getCookiePassword(),
      },
    });
  } catch (error) {
    authError = error;
  }

  if (authError) {
    const classified = classifyAuthError(authError);
    if (classified.code === "email_verification_required") {
      return NextResponse.json(
        {
          ok: true,
          requiresVerify: true,
          userId,
          email: classified.email ?? email,
          pendingAuthenticationToken: classified.pendingAuthenticationToken,
        },
        { status: 201 },
      );
    }

    console.error(
      "[auth/signup] unexpected authenticateWithPassword failure:",
      classified.code,
      classified.message,
    );
    return NextResponse.json(
      { error: classified.code || "authentication_failed" },
      { status: 500 },
    );
  }

  let { sealedSession, organizationId } = authResult ?? {};
  if (!sealedSession) {
    console.error(
      "[auth/signup] SDK returned no sealedSession in path-B (verification off)",
    );
    return NextResponse.json(
      { error: "sealing_failed" },
      { status: 500 },
    );
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
            "[auth/signup] could not rebind session to invitation org; falling through with original session",
          );
        }
      }

      if (invitation.organizationId && authResult?.user?.id) {
        const serviceSecret = process.env.SERVICE_SECRET;
        if (!serviceSecret) {
          console.error(
            "[auth/signup] SERVICE_SECRET missing — cannot provision invited user in backend",
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
                workosUserId: authResult.user.id,
                workosOrganizationId: invitation.organizationId,
                email: authResult.user.email,
                name: "",
                slug: "",
                firstName: authResult.user.firstName ?? null,
                lastName: authResult.user.lastName ?? null,
              }),
            },
          );
        } catch (error) {
          console.error(
            "[auth/signup] backend register-workos network error:",
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
            "[auth/signup] backend register-workos returned non-ok",
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
        "[auth/signup] post-auth invitation lookup failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  await setSealedSession(sealedSession);

  return NextResponse.json(
    {
      ok: true,
      skipVerify: true,
      userId,
      redirect: organizationId ? "/dashboard" : "/onboarding/workspace",
    },
    { status: 201 },
  );
}
