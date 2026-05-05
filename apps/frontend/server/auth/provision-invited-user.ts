import "server-only";

import { NextResponse } from "next/server";
import { getBackendUrl } from "platform-api";

import { rebindSealedSessionToOrganization } from "@/server/auth/session";
import { workos } from "@/server/auth/workos";

import type { PasswordAuthSessionResult } from "./password-auth";

/*
 * Post-auth invitation provisioning.
 *
 * Both `signup/route.ts` and `login/route.ts` need to:
 *
 *   1. Look up the invitation again (token-by-token) to read the org
 *      WorkOS finally bound the user to.
 *   2. If the sealed session's `organizationId` doesn't match the
 *      invitation's, rebind the session to the invitation's org so
 *      the user lands inside the correct workspace.
 *   3. Call the Chronicle backend's `register-workos` endpoint to
 *      create the local membership row keyed off the WorkOS user +
 *      organization.
 *
 * Returns the (possibly rebound) `sealedSession` + `organizationId`
 * to use, or a `NextResponse` to return early on a hard failure
 * (`SERVICE_SECRET` missing, backend unreachable, backend returned
 * non-OK).
 */

export interface ProvisionResult {
  sealedSession: string;
  organizationId?: string;
}

export type ProvisionOutcome =
  | { kind: "ok"; result: ProvisionResult }
  | { kind: "response"; response: NextResponse };

export async function provisionInvitedUser(
  authResult: PasswordAuthSessionResult,
  invitationToken: string,
  context: string,
): Promise<ProvisionOutcome> {
  let sealedSession = authResult.sealedSession ?? "";
  let organizationId = authResult.organizationId;

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
          `[${context}] could not rebind session to invitation org; falling through with original session`,
        );
      }
    }

    if (invitation.organizationId && authResult.user?.id) {
      const serviceSecret = process.env.SERVICE_SECRET;
      if (!serviceSecret) {
        console.error(
          `[${context}] SERVICE_SECRET missing — cannot provision invited user in backend`,
        );
        return {
          kind: "response",
          response: NextResponse.json(
            {
              error: "service_secret_not_configured",
              detail:
                "SERVICE_SECRET env var is not set in apps/frontend. Add it and restart.",
            },
            { status: 500 },
          ),
        };
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
          `[${context}] backend register-workos network error:`,
          error instanceof Error ? error.message : error,
        );
        return {
          kind: "response",
          response: NextResponse.json(
            {
              error: "backend_unreachable",
              detail: error instanceof Error ? error.message : String(error),
            },
            { status: 502 },
          ),
        };
      }

      if (!registerRes.ok) {
        const detail = await registerRes.text().catch(() => "");
        console.error(
          `[${context}] backend register-workos returned non-ok`,
          registerRes.status,
          detail,
        );
        return {
          kind: "response",
          response: NextResponse.json(
            {
              error: "invitation_provision_failed",
              backendStatus: registerRes.status,
              detail,
            },
            { status: 500 },
          ),
        };
      }
    }
  } catch (error) {
    console.warn(
      `[${context}] post-auth invitation lookup failed:`,
      error instanceof Error ? error.message : error,
    );
  }

  return {
    kind: "ok",
    result: { sealedSession, organizationId },
  };
}
