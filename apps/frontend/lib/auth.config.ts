import type { NextAuthConfig } from "next-auth";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
const SERVICE_SECRET = process.env.SERVICE_SECRET || "";

const BACKEND_TOKEN_LIFETIME_MS = 23 * 60 * 60 * 1000;

async function refreshBackendToken(token: {
  id: string;
  email?: string | null;
  name?: string | null;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
}): Promise<{ backendToken: string; backendTokenExpiresAt: number } | null> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/platform/auth/token-exchange`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_secret: SERVICE_SECRET,
          user_id: token.id,
          email: token.email,
          name: token.name,
          tenant_id: token.tenantId,
          tenant_name: token.tenantName,
          tenant_slug: token.tenantSlug,
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      backendToken: data.token,
      backendTokenExpiresAt: Date.now() + BACKEND_TOKEN_LIFETIME_MS,
    };
  } catch {
    return null;
  }
}

export const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    newUser: "/signup",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        try {
          const res = await fetch(
            `${BACKEND_URL}/api/platform/auth/oauth-signup`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: profile?.email ?? user.email,
                name: profile?.name ?? user.name,
                orgName: null,
                provider: "google",
                service_secret: SERVICE_SECRET,
              }),
            },
          );
          if (!res.ok) return false;

          const data = await res.json();
          const backendUser = data.user;

          user.id = backendUser.id;
          user.tenantId = backendUser.tenantId;
          user.tenantName = backendUser.tenantName;
          user.tenantSlug = backendUser.tenantSlug;
          user.backendToken = data.token;
        } catch {
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user && user.id) {
        token.id = user.id;
        token.tenantId = user.tenantId;
        token.tenantName = user.tenantName;
        token.tenantSlug = user.tenantSlug;
        token.backendToken = user.backendToken;
        token.backendTokenExpiresAt = Date.now() + BACKEND_TOKEN_LIFETIME_MS;
      }

      const bufferMs = 5 * 60 * 1000;
      if (
        token.backendTokenExpiresAt &&
        Date.now() > token.backendTokenExpiresAt - bufferMs
      ) {
        const refreshed = await refreshBackendToken(token);
        if (refreshed) {
          token.backendToken = refreshed.backendToken;
          token.backendTokenExpiresAt = refreshed.backendTokenExpiresAt;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.tenantId = token.tenantId;
        session.user.tenantName = token.tenantName;
        session.user.tenantSlug = token.tenantSlug;
        session.backendToken = token.backendToken;
      }
      return session;
    },
    async authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      const isOnAuth = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/signup");
      
      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false;
      } else if (isOnAuth) {
        if (isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
  },
  providers: [],
};
