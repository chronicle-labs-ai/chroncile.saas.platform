import * as Sentry from "@sentry/browser";
import { getReplay } from "@sentry/browser";

export interface SentryIdentity {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  tenantId?: string | null;
  tenantName?: string | null;
  tenantSlug?: string | null;
}

export interface SentryDebugInfo {
  configured: boolean;
  dsnPresent: boolean;
  dsnHost: string | null;
  environment: string;
  lastEventId: string | null;
  org: string | null;
  project: string | null;
  replayEnabled: boolean;
  replayId: string | null;
  userId: string | null;
}

function formatUserId(
  userId: number | string | null | undefined
): string | null {
  if (userId === null || userId === undefined) {
    return null;
  }

  return String(userId);
}

export interface SessionMonitoringClient {
  getDebugInfo(): SentryDebugInfo;
  init(): boolean;
  syncIdentity(identity: SentryIdentity | null): void;
}

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? null;
const sentryHost = sentryDsn ? new URL(sentryDsn).host : null;
const sentryOrg = process.env.NEXT_PUBLIC_SENTRY_ORG ?? null;
const sentryProject = process.env.NEXT_PUBLIC_SENTRY_PROJECT ?? null;
const sentryEnvironment = process.env.NODE_ENV ?? "development";

function buildTracePropagationTargets(): Array<string | RegExp> {
  const targets: Array<string | RegExp> = ["localhost", /^\//];

  if (process.env.NEXT_PUBLIC_APP_URL) {
    targets.push(process.env.NEXT_PUBLIC_APP_URL);
  }

  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    targets.push(process.env.NEXT_PUBLIC_BACKEND_URL);
  }

  return targets;
}

function shouldCreateSpanForRequest(url: string): boolean {
  return (
    !url.includes("ingest.us.sentry.io") &&
    !url.includes("us.i.posthog.com") &&
    !url.includes("us-assets.i.posthog.com")
  );
}

class NoopSessionMonitoringClient implements SessionMonitoringClient {
  getDebugInfo(): SentryDebugInfo {
    return {
      configured: false,
      dsnPresent: Boolean(sentryDsn),
      dsnHost: sentryHost,
      environment: sentryEnvironment,
      lastEventId: null,
      org: sentryOrg,
      project: sentryProject,
      replayEnabled: false,
      replayId: null,
      userId: null,
    };
  }

  init(): boolean {
    return false;
  }

  syncIdentity(): void {}
}

class BrowserSentryMonitoringClient implements SessionMonitoringClient {
  private initialized = false;

  getDebugInfo(): SentryDebugInfo {
    const replay = getReplay();
    const currentUser = Sentry.getCurrentScope().getUser();

    return {
      configured: Boolean(Sentry.getClient()),
      dsnPresent: Boolean(sentryDsn),
      dsnHost: sentryHost,
      environment: sentryEnvironment,
      lastEventId: Sentry.lastEventId() || null,
      org: sentryOrg,
      project: sentryProject,
      replayEnabled: Boolean(replay),
      replayId: replay?.getReplayId() ?? null,
      userId: formatUserId(currentUser?.id),
    };
  }

  init(): boolean {
    if (this.initialized || !sentryDsn) {
      return this.initialized;
    }

    Sentry.init({
      dsn: sentryDsn,
      environment: sentryEnvironment,
      integrations: [
        Sentry.browserTracingIntegration({
          shouldCreateSpanForRequest,
        }),
        Sentry.replayIntegration(),
      ],
      replaysOnErrorSampleRate: 1.0,
      replaysSessionSampleRate: sentryEnvironment === "development" ? 1.0 : 0.1,
      tracePropagationTargets: buildTracePropagationTargets(),
      tracesSampleRate: sentryEnvironment === "development" ? 1.0 : 0.1,
    });

    this.initialized = true;
    return true;
  }

  syncIdentity(identity: SentryIdentity | null): void {
    if (!sentryDsn) {
      return;
    }

    if (!identity) {
      Sentry.setUser(null);
      Sentry.setContext("tenant", null);
      Sentry.setTag("auth_state", "anonymous");
      return;
    }

    Sentry.setUser({
      email: identity.email ?? undefined,
      id: identity.id,
      username: identity.name ?? undefined,
    });
    Sentry.setContext("tenant", {
      id: identity.tenantId ?? undefined,
      name: identity.tenantName ?? undefined,
      slug: identity.tenantSlug ?? undefined,
    });
    Sentry.setTag("auth_state", "authenticated");
    if (identity.role) {
      Sentry.setTag("role", identity.role);
    }
  }
}

const noopSessionMonitoringClient = new NoopSessionMonitoringClient();

let sessionMonitoringClient: SessionMonitoringClient | null = null;

export function getSessionMonitoringClient(): SessionMonitoringClient {
  if (sessionMonitoringClient) {
    return sessionMonitoringClient;
  }

  sessionMonitoringClient = sentryDsn
    ? new BrowserSentryMonitoringClient()
    : noopSessionMonitoringClient;

  return sessionMonitoringClient;
}

export function getSentryDebugInfo(): SentryDebugInfo {
  return getSessionMonitoringClient().getDebugInfo();
}

export function initializeSentry(): boolean {
  return getSessionMonitoringClient().init();
}

export function syncSentryIdentity(identity: SentryIdentity | null): void {
  getSessionMonitoringClient().syncIdentity(identity);
}
