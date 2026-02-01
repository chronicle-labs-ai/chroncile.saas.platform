import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import prisma from "./db";
import { authConfig } from "./auth.config";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
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

        const user = await prisma.user.findUnique({
          where: { email },
          include: { tenant: true },
        });

        if (!user) return null;

        const isValidPassword = await compare(password, user.password);
        if (!isValidPassword) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
          tenantSlug: user.tenant.slug,
        };
      },
    }),
  ],
});

// Extended types for NextAuth
declare module "next-auth" {
  interface User {
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
  }
  interface Session {
    user: User & {
      id: string;
      tenantId: string;
      tenantName: string;
      tenantSlug: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
  }
}
