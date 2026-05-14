import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: ["/login", "/callback", "/api/cron", "/api/local-db"],
  },
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icon.svg|fonts|api/auth/sign-out).*)",
  ],
};
