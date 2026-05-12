/**
 * POST /api/auth/identify
 *
 * Body: { email: string }
 *
 * Returns the linked auth methods for an account so the login UI can tell
 * the user "this account is registered with Google" instead of a generic
 * "invalid credentials" error when they try email/password on an OAuth-only
 * account.
 *
 * Implementation (per WorkOS docs + SDK):
 *   1. workos.userManagement.listUsers({ email })  → at most one match.
 *   2. workos.userManagement.getUserIdentities(userId)  → Identity[].
 *      Each Identity has a `provider` field:
 *        "AppleOAuth" | "GitHubOAuth" | "GoogleOAuth" | "MicrosoftOAuth"
 *   3. workos.userManagement.listSessions(userId)  → Session[].
 *      Each Session has an `authMethod` whose values are lowercase per the
 *      SDK type:
 *        'cross_app_auth' | 'external_auth' | 'impersonation' |
 *        'magic_code' | 'migrated_session' | 'oauth' | 'passkey' |
 *        'password' | 'sso' | 'unknown'
 *      If ANY session has `authMethod === "password"`, we know the user has
 *      a password set. WorkOS does NOT expose `has_password` directly on
 *      the User object (anti-enumeration), so this is the most accurate
 *      signal available.
 *
 * Why both: providers (from identities) tells us which OAuth methods are
 * linked; hasPassword (from sessions) tells us whether the user has ever
 * succeeded a password sign-in / created a password. Together the client
 * can correctly distinguish:
 *   - OAuth-only user → "this account is registered with Google, click here
 *     to set a password"
 *   - Both methods, wrong pw typed → "Email or password is incorrect"
 *   - Both methods, OAuth hint as side-info
 *
 * Edge case: a user that just completed `resetPassword` but never signed
 * in with the new password yet would have hasPassword=false here. To handle
 * that we'd need to mirror a flag in our own DB on the resetPassword
 * webhook — out of scope for this endpoint. Practically, this is rare:
 * after resetting the password, the user has to sign in (their previous
 * sessions were revoked), and that sign-in creates a Password session.
 *
 * The response is the same shape (with empty values) whether the email
 * is found or not, to minimize user-enumeration surface. This endpoint
 * is intentionally only called by the client AFTER a failed login attempt.
 *
 * Response (always 200):
 *   { exists: boolean; providers: string[]; hasPassword: boolean }
 *
 * Docs:
 *   https://workos.com/docs/reference/authkit/user#list-users
 *   https://workos.com/docs/reference/authkit/identity
 *   https://workos.com/docs/reference/authkit/session
 *   https://workos.com/docs/authkit/identity-linking
 */

import { NextResponse, type NextRequest } from "next/server";

import { assertWorkOSEnvironment, workos } from "@/server/auth/workos";

export const dynamic = "force-dynamic";

interface IdentifyBody {
  email?: unknown;
}

interface IdentifyResponse {
  exists: boolean;
  providers: string[];
  hasPassword: boolean;
}

const EMPTY: IdentifyResponse = {
  exists: false,
  providers: [],
  hasPassword: false,
};

export async function POST(request: NextRequest) {
  assertWorkOSEnvironment();

  const body = (await request.json().catch(() => null)) as IdentifyBody | null;
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  // Always 200 with the empty shape on bad input — don't help an attacker
  // distinguish "email doesn't exist" from "email is malformed".
  if (!email || !email.includes("@")) {
    return NextResponse.json(EMPTY);
  }

  try {
    const list = await workos.userManagement.listUsers({ email, limit: 1 });
    const user = list?.data?.[0];
    if (!user) {
      return NextResponse.json(EMPTY);
    }

    // Run identities + sessions lookups in parallel — they're independent
    // and we want to keep this endpoint snappy for the post-login-failure
    // path that calls it.
    const [identities, sessions] = await Promise.all([
      workos.userManagement.getUserIdentities(user.id),
      workos.userManagement
        .listSessions(user.id, { limit: 100 })
        .catch((err: unknown) => {
          // Sessions lookup is "nice to have" for the password-detection
          // signal — if it fails for any reason we still return the
          // identities. Log for diagnosis.
          console.warn(
            "[auth/identify] listSessions failed (degrading to providers-only):",
            err instanceof Error ? err.message : err,
          );
          return null;
        }),
    ]);

    const providers: string[] = Array.isArray(identities)
      ? identities.flatMap((i) =>
          typeof i.provider === "string" && i.provider.length > 0
            ? [i.provider]
            : [],
        )
      : [];

    const hasPassword = sessions?.data?.some(
      (session) => session.authMethod === "password",
    ) ?? false;

    return NextResponse.json<IdentifyResponse>({
      exists: true,
      providers,
      hasPassword,
    });
  } catch (error) {
    // Swallow errors and respond with the empty shape — same anti-enumeration
    // posture as the happy path. Log for server-side diagnosis.
    console.warn(
      "[auth/identify] WorkOS lookup failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(EMPTY);
  }
}
