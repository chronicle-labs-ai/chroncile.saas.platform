import "server-only";

import { getBackendUrl } from "platform-api";

/*
 * Primary-org lookup against the Chronicle backend.
 *
 * For multi-org users we want WorkOS to land them in their "primary"
 * workspace transparently rather than throwing
 * `organization_selection_required`. The backend tracks each user's
 * primary tenant; this helper resolves the email to a WorkOS
 * organization id we can pre-pass to `authenticateWithPassword` /
 * `authenticateWithOrganizationSelection`.
 *
 * Returns `undefined` when:
 *   - SERVICE_SECRET isn't configured (skip the lookup gracefully),
 *   - the backend returns non-OK,
 *   - the user is unknown to the backend,
 *   - the user has no primary tenant set.
 *
 * Callers should treat `undefined` as "no preference" and let WorkOS
 * pick / surface its own selection error.
 */

interface PrimaryOrgLookupResponse {
  tenantId?: string | null;
  workosOrganizationId?: string | null;
}

export async function lookupPrimaryOrgByEmail(
  email: string,
  context: string = "auth",
): Promise<string | undefined> {
  const serviceSecret = process.env.SERVICE_SECRET;
  if (!serviceSecret) {
    console.warn(
      `[${context}] SERVICE_SECRET not set — skipping primary-org lookup. Add SERVICE_SECRET to apps/frontend/.env.local (must match backend).`,
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
        `[${context}] primary-org lookup non-ok:`,
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
        `[${context}] primary-org resolved for`,
        email,
        "→",
        data.workosOrganizationId,
      );
      return data.workosOrganizationId;
    }
    console.warn(
      `[${context}] primary-org lookup returned empty for`,
      email,
      "(user not in local DB or no primary tenant set) — fallback to WorkOS first-org",
    );
    return undefined;
  } catch (err) {
    console.warn(
      `[${context}] primary-org lookup failed:`,
      err instanceof Error ? err.message : err,
    );
    return undefined;
  }
}
