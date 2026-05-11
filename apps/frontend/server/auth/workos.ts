import { WorkOS } from "@workos-inc/node";

export function assertWorkOSEnvironment(): void {
  if (!process.env.WORKOS_API_KEY) {
    throw new Error(
      "WORKOS_API_KEY is not set. Add it to apps/frontend/.env.local",
    );
  }

  if (!process.env.WORKOS_CLIENT_ID) {
    throw new Error(
      "WORKOS_CLIENT_ID is not set. Add it to apps/frontend/.env.local",
    );
  }
}

export const workos = new WorkOS(process.env.WORKOS_API_KEY ?? "sk_missing", {
  clientId: process.env.WORKOS_CLIENT_ID ?? "client_missing",
});

export const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID ?? "";

export const WORKOS_REDIRECT_URI =
  process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ??
  "http://localhost:3000/api/auth/callback";
