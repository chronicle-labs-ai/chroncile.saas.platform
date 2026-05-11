/**
 * POST /api/auth/sign-out
 * GET  /api/auth/sign-out
 *
 * Per the WorkOS Sessions doc, sign-out is three steps:
 *   1. Get the session id (`sid` claim) out of the access token.
 *   2. Delete the user's app session (our cookie).
 *   3. Redirect the user's browser to the WorkOS logout URL.
 *
 * Using the canonical session helper:
 *
 *   const session = await workos.userManagement.loadSealedSession({...});
 *   const logOutUrl = await session.getLogOutUrl();   // extracts sid for us
 *
 * Docs:
 *   https://workos.com/docs/authkit/sessions#signing-out
 *   https://workos.com/docs/reference/authkit/session-helpers#get-log-out-url
 */

import { redirect } from "next/navigation";

import { clearSession, loadSession } from "@/server/auth/session";

async function handleSignOut(): Promise<never> {
  const session = await loadSession();

  // Compute the logout URL BEFORE wiping the cookie — the helper needs
  // the sealed session data to extract the session id.
  let logOutUrl: string | null = null;
  if (session) {
    try {
      logOutUrl = await session.getLogOutUrl();
    } catch (err) {
      console.warn(
        "[auth/sign-out] could not compute WorkOS logout URL",
        err instanceof Error ? err.message : err,
      );
    }
  }

  await clearSession();

  if (!logOutUrl) {
    redirect("/");
  }
  redirect(logOutUrl);
}

export async function POST() {
  return handleSignOut();
}

export async function GET() {
  return handleSignOut();
}
