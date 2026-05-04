import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { getBackendUrl } from "platform-api";

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
      "[auth/callback] SERVICE_SECRET not set — skipping primary-org lookup",
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
        "[auth/callback] primary-org lookup non-ok:",
        res.status,
        detail,
      );
      return undefined;
    }
    const data = (await res.json()) as PrimaryOrgLookupResponse;
    return typeof data.workosOrganizationId === "string" &&
      data.workosOrganizationId.length > 0
      ? data.workosOrganizationId
      : undefined;
  } catch (err) {
    console.warn(
      "[auth/callback] primary-org lookup failed:",
      err instanceof Error ? err.message : err,
    );
    return undefined;
  }
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

  
  let result;
  try {
    result = await (workos.userManagement as any).authenticateWithCode({
      code,
      clientId: WORKOS_CLIENT_ID,
      ipAddress,
      userAgent,
      ...(stateData.invitationToken
        ? { invitationToken: stateData.invitationToken }
        : {}),
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

    if (
      classified.code === "organization_selection_required" &&
      classified.pendingAuthenticationToken
    ) {
      let chosenOrgId: string | undefined;
      if (classified.email) {
        chosenOrgId = await lookupPrimaryOrgByEmail(classified.email);
      }
      if (!chosenOrgId && classified.organizations?.[0]) {
        chosenOrgId = classified.organizations[0].id;
        console.info(
          "[auth/callback] no primary org resolved; falling back to first WorkOS org:",
          chosenOrgId,
        );
      }
      if (chosenOrgId) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await (workos.userManagement as any).authenticateWithOrganizationSelection({
            pendingAuthenticationToken: classified.pendingAuthenticationToken,
            organizationId: chosenOrgId,
            clientId: WORKOS_CLIENT_ID,
            ipAddress,
            userAgent,
            session: {
              sealSession: true,
              cookiePassword: getCookiePassword(),
            },
          });
          console.info(
            "[auth/callback] resumed auth with org",
            chosenOrgId,
          );
        } catch (retryErr) {
          const retryClassified = classifyAuthError(retryErr);
          console.warn(
            "[auth/callback] authenticateWithOrganizationSelection failed:",
            retryClassified.code,
            retryClassified.message,
          );
          errorRedirect(retryClassified.code);
        }
      } else {
        errorRedirect(classified.code);
      }
    } else {
      errorRedirect(classified.code);
    }
  }

  const { sealedSession, organizationId, user: workosUser } = result as {
    sealedSession?: string;
    organizationId?: string;
    user?: {
      id: string;
      email: string;
      firstName?: string | null;
      lastName?: string | null;
    };
  };

  if (!sealedSession) {
    console.error(
      "[auth/callback] SDK returned no sealedSession despite sealSession=true",
    );
    errorRedirect("sealing_failed");
  }

  await setSealedSession(sealedSession);

  if (organizationId && workosUser?.id) {
    const serviceSecret = process.env.SERVICE_SECRET;
    if (serviceSecret) {
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
            "[auth/callback] backend register-workos returned non-ok",
            registerRes.status,
            detail,
          );
        }
      } catch (err) {
        console.error(
          "[auth/callback] backend register-workos network error:",
          err instanceof Error ? err.message : err,
        );
      }
    } else {
      console.warn(
        "[auth/callback] SERVICE_SECRET missing — skipping backend membership sync",
      );
    }
  }

  if (!organizationId) {
    redirect("/onboarding/workspace");
  }

  redirect(stateData.from ?? "/dashboard");
}
