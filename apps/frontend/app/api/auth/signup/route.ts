import { NextResponse, type NextRequest } from "next/server";

import { setSealedSession } from "@/server/auth/session";
import { assertWorkOSEnvironment } from "@/server/auth/workos";

import { acquireUserId, signupAuthenticate } from "./signup-flow";
import { parseSignupBody } from "./signup-helpers";

export const dynamic = "force-dynamic";

/*
 * POST /api/auth/signup
 *
 * Pipeline:
 *   1. parseSignupBody     — validate the request body
 *   2. acquireUserId       — invitation pre-allocation OR fresh createUser
 *   3. signupAuthenticate  — authenticateWithPassword + invitation provisioning
 *   4. setSealedSession    — persist the sealed cookie
 *
 * Each step short-circuits with a `response` outcome on failure, so
 * the handler stays linear with no nested try/catch.
 */
export async function POST(request: NextRequest) {
  assertWorkOSEnvironment();

  const parsed = await parseSignupBody(request);
  if (parsed.kind === "response") return parsed.response;
  const { email, password, firstName, lastName, invitationToken } = parsed.body;

  const user = await acquireUserId({
    email,
    password,
    firstName,
    lastName,
    invitationToken,
  });
  if (user.kind === "response") return user.response;

  const auth = await signupAuthenticate({
    request,
    email,
    password,
    invitationToken,
  });
  if (auth.kind === "response") return auth.response;

  if (auth.kind === "verify") {
    return NextResponse.json(
      {
        ok: true,
        requiresVerify: true,
        userId: user.userId,
        email: auth.payload.email,
        pendingAuthenticationToken: auth.payload.pendingAuthenticationToken,
      },
      { status: 201 },
    );
  }

  await setSealedSession(auth.sealedSession);

  return NextResponse.json(
    {
      ok: true,
      skipVerify: true,
      userId: user.userId,
      redirect: auth.organizationId ? "/dashboard" : "/onboarding/workspace",
    },
    { status: 201 },
  );
}
