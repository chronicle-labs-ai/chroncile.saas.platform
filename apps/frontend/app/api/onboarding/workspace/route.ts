import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "platform-api";

import {
  ADMIN_ROLE_SLUG,
  OWNER_METADATA_KEY,
} from "@/server/auth/org-helpers";
import {
  getCookiePassword,
  getSession,
  loadSession,
  setSealedSession,
} from "@/server/auth/session";
import { assertWorkOSEnvironment, workos } from "@/server/auth/workos";

export const dynamic = "force-dynamic";

const BACKEND_URL = getBackendUrl();

function displayName(firstName?: string | null, lastName?: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ") || null;
}

function normalizeSlug(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export async function POST(request: NextRequest) {
  assertWorkOSEnvironment();

  const session = await getSession();
  if (!session.authenticated) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    orgName?: unknown;
    slug?: unknown;
  } | null;
  const orgName = typeof body?.orgName === "string" ? body.orgName.trim() : "";
  const slug = normalizeSlug(body?.slug);

  if (orgName.length < 2) {
    return NextResponse.json(
      { error: "workspace_name_required" },
      { status: 400 },
    );
  }
  if (slug.length < 2) {
    return NextResponse.json(
      { error: "workspace_slug_required" },
      { status: 400 },
    );
  }

  const serviceSecret = process.env.SERVICE_SECRET;
  if (!serviceSecret) {
    return NextResponse.json(
      { error: "service_secret_not_configured" },
      { status: 500 },
    );
  }

  try {
    let organizationId = session.organizationId ?? null;
    if (!organizationId) {
      const organization = await workos.organizations.createOrganization(
        {
          name: orgName,
          metadata: {
            chronicleSlug: slug,
            [OWNER_METADATA_KEY]: session.user.id,
          },
        },
        { idempotencyKey: `self-serve:${session.user.id}:${slug}` },
      );
      organizationId = organization.id;

      const membership = await workos.userManagement.createOrganizationMembership({
        organizationId,
        userId: session.user.id,
        roleSlug: ADMIN_ROLE_SLUG,
      });

      const assignedSlug = membership.role?.slug;
      if (assignedSlug !== ADMIN_ROLE_SLUG) {
        console.error(
          "[onboarding/workspace] WorkOS assigned role",
          assignedSlug,
          "instead of",
          ADMIN_ROLE_SLUG,
          {
            organizationId,
            userId: session.user.id,
            membershipId: membership.id,
          },
        );
        return NextResponse.json(
          {
            error: "admin_role_not_configured",
            detail:
              "WorkOS assigned a different role than 'admin'. Create the 'admin' role in your WorkOS dashboard and retry.",
          },
          { status: 500 },
        );
      }
    }

    const registerResponse = await fetch(
      `${BACKEND_URL}/api/platform/tenants/register-workos`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceSecret,
          workosUserId: session.user.id,
          workosOrganizationId: organizationId,
          email: session.user.email,
          name: orgName,
          slug,
          firstName: session.user.firstName ?? null,
          lastName: session.user.lastName ?? null,
        }),
      },
    );

    if (!registerResponse.ok) {
      const data = await registerResponse.json().catch(() => null);
      return NextResponse.json(
        { error: data?.error ?? "tenant_registration_failed" },
        { status: registerResponse.status },
      );
    }

    const sealed = await loadSession();
    if (!sealed) {
      return NextResponse.json(
        { error: "session_missing_after_provisioning" },
        { status: 401 },
      );
    }

    if (!session.organizationId) {
      const refresh = await sealed.refresh({
        cookiePassword: getCookiePassword(),
        organizationId,
      });
      if (!refresh.authenticated) {
        return NextResponse.json(
          { error: refresh.reason || "session_refresh_failed" },
          { status: 401 },
        );
      }
      await setSealedSession(refresh.sealedSession);
    }

    return NextResponse.json({
      workspace: {
        name: orgName,
        slug,
        organizationId,
      },
      user: {
        email: session.user.email,
        name: displayName(session.user.firstName, session.user.lastName),
      },
    });
  } catch (error) {
    console.error("[onboarding/workspace] provisioning failed", error);
    return NextResponse.json(
      { error: "workspace_provisioning_failed" },
      { status: 500 },
    );
  }
}
