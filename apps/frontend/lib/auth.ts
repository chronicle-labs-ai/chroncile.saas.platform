import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { authConfig } from "./auth.config";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const res = await fetch(`${BACKEND_URL}/api/platform/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) return null;

        const data = await res.json();
        const user = data.user;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          tenantName: user.tenantName,
          tenantSlug: user.tenantSlug,
          backendToken: data.token,
        };
      },
    }),
  ],
});

declare module "next-auth" {
  interface User {
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    backendToken?: string;
  }
  interface Session {
    user: User & {
      id: string;
      tenantId: string;
      tenantName: string;
      tenantSlug: string;
    };
    backendToken?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    backendToken?: string;
    backendTokenExpiresAt?: number;
  }
}
