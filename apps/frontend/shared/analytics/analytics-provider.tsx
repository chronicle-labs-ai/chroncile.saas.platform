"use client";

import type { Session } from "next-auth";
import { useSession } from "next-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { getAnalyticsClient, noopAnalyticsClient } from "./client";
import type { AnalyticsClient, AnalyticsProperties } from "./types";

const AnalyticsContext = createContext<AnalyticsClient>(noopAnalyticsClient);

function getIdentity(user?: Session["user"]) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    role: user.role,
    tenantId: user.tenantId,
    tenantName: user.tenantName,
    tenantSlug: user.tenantSlug,
  };
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const analytics = useMemo(() => getAnalyticsClient(), []);
  const { data: session } = useSession();
  const lastIdentityRef = useRef<string | null>(null);

  useEffect(() => {
    const identity = getIdentity(session?.user);
    const identityKey = identity ? JSON.stringify(identity) : null;

    if (!identity) {
      if (lastIdentityRef.current !== null) {
        analytics.reset();
        lastIdentityRef.current = null;
      }
      return;
    }

    if (lastIdentityRef.current === identityKey) {
      return;
    }

    analytics.identify(identity.id, identity);
    lastIdentityRef.current = identityKey;
  }, [analytics, session?.user]);

  return (
    <AnalyticsContext.Provider value={analytics}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics(): AnalyticsClient {
  return useContext(AnalyticsContext);
}

export function useTrack() {
  const analytics = useAnalytics();

  return useCallback(
    (event: string, properties?: AnalyticsProperties) => {
      analytics.track(event, properties);
    },
    [analytics]
  );
}
