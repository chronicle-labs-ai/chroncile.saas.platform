import NextAuth from "next-auth";
import { authConfig } from "@/backend/auth/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/((?!api/auth|api/cron|api/local-db|_next/static|_next/image|icon.svg|fonts).*)",
  ],
};
