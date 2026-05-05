import { NextResponse, type NextRequest } from "next/server";

import {
  classifyAuthError,
  isEmailAlreadyExistsError,
  isWeakPasswordError,
} from "@/server/auth/auth-errors";
import {
  getClientIp,
  type PasswordAuthSessionResult,
  type PasswordAuthenticator,
} from "@/server/auth/password-auth";
import { provisionInvitedUser } from "@/server/auth/provision-invited-user";
import { getCookiePassword } from "@/server/auth/session";
import { workos, WORKOS_CLIENT_ID } from "@/server/auth/workos";

import { logSdkError } from "./signup-helpers";

/*
 * WorkOS-aware signup steps. Each helper returns either an `ok`
 * outcome the route can continue with, or a fully-formed `response`
 * the route can return as-is.
 */

const CONTEXT = "auth/signup";

interface AcquireUserIdInput {
  email: string;
  password: string;
  firstName: string | null;
  lastName: string | null;
  invitationToken?: string;
}

export type AcquireUserIdOutcome =
  | { kind: "ok"; userId: string }
  | { kind: "response"; response: NextResponse };

/**
 * Resolve the WorkOS user record signup will authenticate against.
 *
 *   - With `invitationToken`: validate the invitation, then update the
 *     pre-allocated user (set password + name). If WorkOS pending
 *     invitation has no pre-allocated user we transparently fall
 *     through to the fresh-signup path.
 *   - Without: create a brand new user.
 */
export async function acquireUserId(
  input: AcquireUserIdInput,
): Promise<AcquireUserIdOutcome> {
  if (input.invitationToken) {
    const invited = await acquireInvitedUserId(input);
    if (invited) return invited;
  }
  return acquireFreshUserId(input);
}

async function acquireInvitedUserId(
  input: AcquireUserIdInput,
): Promise<AcquireUserIdOutcome | null> {
  const { invitationToken, email, password, firstName, lastName } = input;
  if (!invitationToken) return null;

  let invitation;
  try {
    invitation = await workos.userManagement.findInvitationByToken(
      invitationToken,
    );
  } catch (error) {
    console.error(
      `[${CONTEXT}] findInvitationByToken failed:`,
      error instanceof Error ? error.message : error,
    );
    return {
      kind: "response",
      response: NextResponse.json(
        { error: "invitation_not_found" },
        { status: 404 },
      ),
    };
  }

  if (invitation.state !== "pending") {
    return {
      kind: "response",
      response: NextResponse.json(
        {
          error:
            invitation.state === "expired"
              ? "invitation_expired"
              : "invitation_not_pending",
        },
        { status: 410 },
      ),
    };
  }

  if (invitation.email.toLowerCase() !== email.toLowerCase()) {
    return {
      kind: "response",
      response: NextResponse.json(
        { error: "invitation_email_mismatch" },
        { status: 400 },
      ),
    };
  }

  const list = await workos.userManagement.listUsers({ email, limit: 1 });
  const preAllocated = list.data[0];
  if (!preAllocated) {
    // Invitation says pending but no user record exists — fall through
    // to createUser. If WorkOS surfaces `email_not_available` the fresh
    // path will catch it.
    console.warn(
      `[${CONTEXT}] invitation pending but no pre-allocated user found; falling through to createUser`,
    );
    return null;
  }

  try {
    await workos.userManagement.updateUser({
      userId: preAllocated.id,
      password,
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    });
    return { kind: "ok", userId: preAllocated.id };
  } catch (error) {
    if (isWeakPasswordError(error)) {
      const classified = classifyAuthError(error);
      return {
        kind: "response",
        response: NextResponse.json(
          { error: "weak_password", message: classified.message },
          { status: 422 },
        ),
      };
    }
    logSdkError(CONTEXT, "updateUser on pre-allocated invitee failed", error);
    return {
      kind: "response",
      response: NextResponse.json(
        { error: "user_creation_failed" },
        { status: 500 },
      ),
    };
  }
}

async function acquireFreshUserId(
  input: AcquireUserIdInput,
): Promise<AcquireUserIdOutcome> {
  const { email, password, firstName, lastName } = input;
  try {
    const created = await workos.userManagement.createUser({
      email,
      password,
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    });
    return { kind: "ok", userId: created.id };
  } catch (error) {
    if (isEmailAlreadyExistsError(error)) {
      return {
        kind: "response",
        response: NextResponse.json(
          { error: "email_already_exists", email },
          { status: 409 },
        ),
      };
    }
    if (isWeakPasswordError(error)) {
      const classified = classifyAuthError(error);
      return {
        kind: "response",
        response: NextResponse.json(
          { error: "weak_password", message: classified.message },
          { status: 422 },
        ),
      };
    }
    logSdkError(CONTEXT, "createUser failed", error);
    return {
      kind: "response",
      response: NextResponse.json(
        { error: "user_creation_failed" },
        { status: 500 },
      ),
    };
  }
}

interface AuthenticateSignupInput {
  request: NextRequest;
  email: string;
  password: string;
  invitationToken?: string;
}

export interface SignupVerifyPayload {
  email: string;
  pendingAuthenticationToken?: string;
}

export type SignupAuthOutcome =
  | { kind: "verify"; payload: SignupVerifyPayload }
  | { kind: "ok"; sealedSession: string; organizationId?: string }
  | { kind: "response"; response: NextResponse };

/**
 * Authenticate the freshly-acquired user, then optionally provision
 * them into the invited org. Returns either:
 *   - `verify`: WorkOS requires email verification first
 *   - `ok`: a sealed session ready to set on the response cookie
 *   - `response`: a hard error the route should return as-is
 */
export async function signupAuthenticate(
  input: AuthenticateSignupInput,
): Promise<SignupAuthOutcome> {
  const { request, email, password, invitationToken } = input;
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const userManagement = workos.userManagement as typeof workos.userManagement &
    PasswordAuthenticator;

  let authResult: PasswordAuthSessionResult;
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
    const classified = classifyAuthError(error);
    if (classified.code === "email_verification_required") {
      return {
        kind: "verify",
        payload: {
          email: classified.email ?? email,
          pendingAuthenticationToken: classified.pendingAuthenticationToken,
        },
      };
    }
    console.error(
      `[${CONTEXT}] unexpected authenticateWithPassword failure:`,
      classified.code,
      classified.message,
    );
    return {
      kind: "response",
      response: NextResponse.json(
        { error: classified.code || "authentication_failed" },
        { status: 500 },
      ),
    };
  }

  let { sealedSession, organizationId } = authResult;
  if (!sealedSession) {
    console.error(
      `[${CONTEXT}] SDK returned no sealedSession in path-B (verification off)`,
    );
    return {
      kind: "response",
      response: NextResponse.json({ error: "sealing_failed" }, { status: 500 }),
    };
  }

  if (invitationToken) {
    const outcome = await provisionInvitedUser(
      authResult,
      invitationToken,
      CONTEXT,
    );
    if (outcome.kind === "response") {
      return { kind: "response", response: outcome.response };
    }
    sealedSession = outcome.result.sealedSession;
    organizationId = outcome.result.organizationId;
  }

  return { kind: "ok", sealedSession, organizationId };
}
