import type { NextAuthConfig } from "next-auth";

const ALLOWED_DOMAIN = "chronicle-labs.com";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email;
      if (!email) return false;
      return email.endsWith(`@${ALLOWED_DOMAIN}`);
    },
    async authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      const isOnLogin = nextUrl.pathname === "/login";
      const isApiAuth = nextUrl.pathname.startsWith("/api/auth");
      const isCron = nextUrl.pathname.startsWith("/api/cron");

      if (isApiAuth || isCron) return true;

      if (isOnDashboard) {
        return isLoggedIn ? true : false;
      }

      if (isOnLogin && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
  },
  providers: [],
};
