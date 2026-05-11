/*
 * Tiny shared helper used by the dashboard error boundary (and any
 * future route-level boundary) to turn an unknown thrown `Error` into
 * a friendly title + description.
 *
 * Detects the same network-failure shape that `proxy.ts` and
 * `session.ts` watch for so the user sees a "we couldn't reach the
 * auth provider" message instead of a generic "Something went wrong".
 */

import { isNetworkError } from "./network-errors";

export interface HumanizedRouteError {
  title: string;
  description: string;
  /** True when the failure is a recoverable network outage. */
  isOffline: boolean;
}

export function humanizeRouteError(error: unknown): HumanizedRouteError {
  if (isNetworkError(error)) {
    return {
      title: "We can't reach our services",
      description:
        "Your session is preserved — try again once your connection is back. If this keeps happening, check your network or VPN.",
      isOffline: true,
    };
  }

  return {
    title: "Something went wrong",
    description:
      "An unexpected error happened while loading this page. Try again, or go back to the login page if it keeps failing.",
    isOffline: false,
  };
}
