import { getSession } from "./session";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

export interface AuthSessionOrganization {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  workosOrganizationId: string | null;
  role: string;
}

export interface AuthSessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  backendToken: string;
  workosUserId: string | null;
  workosOrganizationId: string | null;
  primaryTenantId: string;
  organizations: AuthSessionOrganization[];
}

export interface AuthSession {
  user: AuthSessionUser;
  backendToken: string;
}

export type AuthFailureReason =
  | "no_cookie"
  | "invalid_session_cookie"
  | "invalid_jwt"
  | "no_session_cookie_provided"
  | "auth_provider_unreachable"
  | "authenticate_failed";

export function loginErrorCodeFromAuthReason(
  reason: AuthFailureReason | undefined,
): string | undefined {
  switch (reason) {
    case "auth_provider_unreachable":
      return "auth_unreachable";
    case "authenticate_failed":
      return "authenticate_failed";
    default:
      return undefined;
  }
}

interface BackendMeOrganization {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  workosOrganizationId: string | null;
  role: string;
}

interface BackendMeResponse {
  userId: string;
  email: string;
  name: string | null;
  role: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  workosUserId: string | null;
  workosOrganizationId: string | null;
  primaryTenantId?: string;
  organizations?: BackendMeOrganization[];
}

export async function auth(): Promise<AuthSession | null> {
  const result = await authWithReason();
  return result.session;
}

export interface AuthResult {
  session: AuthSession | null;
  /** Populated when `session === null`. */
  reason?: AuthFailureReason;
}

export async function authWithReason(): Promise<AuthResult> {
  const session = await getSession();
  if (!session.authenticated) {
    return {
      session: null,
      reason: session.reason as AuthFailureReason,
    };
  }

  let me: BackendMeResponse | null = null;
  if (BACKEND_URL && session.organizationId) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/saas/me`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        next: { revalidate: 0 },
      });
      if (res.ok) {
        me = (await res.json()) as BackendMeResponse;
      }
    } catch (err) {
      console.warn("[auth] backend /api/saas/me unreachable", err);
    }
  }

  if (BACKEND_URL && !me) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/saas/identity`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        next: { revalidate: 0 },
      });
      if (res.ok) {
        const identity = (await res.json()) as {
          userId: string;
          email: string;
          name: string | null;
          workosUserId: string | null;
          primaryTenantId: string;
          organizations?: BackendMeOrganization[];
        };
        
        me = {
          userId: identity.userId,
          email: identity.email,
          name: identity.name,
          role: "member",
          tenantId: "",
          tenantName: "",
          tenantSlug: "",
          workosUserId: identity.workosUserId,
          workosOrganizationId: null,
          primaryTenantId: identity.primaryTenantId,
          organizations: identity.organizations,
        };
      }
    } catch (err) {
      console.warn("[auth] backend /api/saas/identity unreachable", err);
    }
  }

  const fallbackName =
    [session.user.firstName, session.user.lastName].filter(Boolean).join(" ") ||
    null;

  const user: AuthSessionUser = {
    id: me?.userId ?? session.user.id,
    email: me?.email ?? session.user.email,
    name: me?.name ?? fallbackName,
    image: session.user.profilePictureUrl ?? null,
    role: me?.role ?? session.role ?? "member",
    tenantId: me?.tenantId ?? "",
    tenantName: me?.tenantName ?? "",
    tenantSlug: me?.tenantSlug ?? "",
    backendToken: session.accessToken,
    workosUserId: me?.workosUserId ?? session.user.id,
    workosOrganizationId:
      me?.workosOrganizationId ?? session.organizationId ?? null,
    primaryTenantId: me?.primaryTenantId ?? "",
    organizations: (me?.organizations ?? []).map((o) => ({
      tenantId: o.tenantId,
      tenantName: o.tenantName,
      tenantSlug: o.tenantSlug,
      workosOrganizationId: o.workosOrganizationId,
      role: o.role,
    })),
  };

  return { session: { user, backendToken: session.accessToken } };
}

// ---------------------------------------------------------------------------
// Compatibility stubs for legacy NextAuth imports.
// ---------------------------------------------------------------------------

const STUB_RESPONSE = () =>
  new Response(
    JSON.stringify({
      error:
        "This route is part of the legacy NextAuth flow which has been replaced by /api/auth/oauth/google + /api/auth/callback. Update your client to call those instead.",
    }),
    { status: 410, headers: { "content-type": "application/json" } },
  );

export const handlers = {
  GET: STUB_RESPONSE,
  POST: STUB_RESPONSE,
};

export async function signIn(): Promise<never> {
  throw new Error(
    "signIn() is no longer supported. Redirect to /api/auth/oauth/google instead.",
  );
}

export async function signOut(): Promise<never> {
  throw new Error(
    "signOut() is no longer supported. Redirect to /api/auth/sign-out instead.",
  );
}
