import { createPostHogAnalyticsClient } from "./posthog-client";
import type { AnalyticsClient, AnalyticsDebugInfo } from "./types";

class NoopAnalyticsClient implements AnalyticsClient {
  identify(): void {}

  reset(): void {}

  track(): void {}

  page(): void {}

  getDebugInfo(): AnalyticsDebugInfo {
    return {
      provider: "noop",
      configured: false,
      keyPresent: Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY),
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? null,
      sessionId: null,
      distinctId: null,
    };
  }
}

export const noopAnalyticsClient = new NoopAnalyticsClient();

let analyticsClient: AnalyticsClient | null = null;

export function getAnalyticsClient(): AnalyticsClient {
  if (analyticsClient) {
    return analyticsClient;
  }

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  analyticsClient =
    posthogKey && posthogHost
      ? createPostHogAnalyticsClient()
      : noopAnalyticsClient;

  return analyticsClient ?? noopAnalyticsClient;
}
