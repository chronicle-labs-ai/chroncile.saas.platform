import "server-only";

import { Daytona } from "@daytonaio/sdk";

/*
 * Lazy Daytona client singleton.
 *
 * The `DAYTONA_API_KEY` env var is read on first use rather than at
 * module load so server-side rendering of pages that don't touch the
 * sandbox doesn't blow up when the secret is missing in local dev.
 */

let daytonaClient: Daytona | null = null;

export function getDaytona(): Daytona {
  if (daytonaClient) return daytonaClient;
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "DAYTONA_API_KEY is not configured. Set it in apps/frontend/.env.local.",
    );
  }
  daytonaClient = new Daytona({
    apiKey,
    apiUrl: process.env.DAYTONA_API_URL,
  });
  return daytonaClient;
}
