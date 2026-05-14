import { handleAuth } from "@workos-inc/authkit-nextjs";

const ALLOWED_DOMAIN = "chronicle-labs.com";

export const GET = handleAuth({
  returnPathname: "/dashboard",
  onSuccess: async ({ user }) => {
    const email = user.email ?? "";
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      throw new Error(`Email domain not allowed: ${email}`);
    }
  },
});
