"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { Button, EmptyState } from "ui";

import { humanizeRouteError } from "@/server/auth/route-error-message";

/*
 * Dashboard-level error boundary. Triggers when a server component or
 * route handler under `/dashboard/*` throws unexpectedly — most often
 * a transient WorkOS / backend network error that the request-time
 * graceful redirects in `proxy.ts` and `session.ts` somehow missed.
 *
 * Without this boundary Next.js renders a bare 404, which has bitten
 * us before during DNS outages and laptop-on-a-plane testing. With it
 * the user sees a Chronicle-styled fallback with a `Try again` action
 * (calls `reset()`) and a "Back to login" escape hatch.
 *
 * `humanizeRouteError` recognises the same network-error shape that
 * `proxy.ts` watches for and surfaces a tailored copy.
 */

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { title, description, isOffline } = humanizeRouteError(error);

  React.useEffect(() => {
    // Always log so the dev console keeps the original stack — the
    // banner copy is intentionally redacted.
    console.error("[dashboard] error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-s-6 py-s-12">
      <EmptyState
        icon={<AlertTriangle aria-hidden strokeWidth={1.5} />}
        title={title}
        description={description}
        actions={
          <div className="flex items-center gap-s-2">
            <Button variant="primary" size="sm" onPress={reset}>
              Try again
            </Button>
            {isOffline ? null : (
              <Button
                variant="ghost"
                size="sm"
                onPress={() => {
                  window.location.assign("/login");
                }}
              >
                Back to login
              </Button>
            )}
          </div>
        }
        size="md"
      />
    </div>
  );
}
