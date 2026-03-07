"use client";

import { createContext, useContext } from "react";
import type {
  EntitlementKey,
  FeatureAccessSnapshot,
  FeatureFlagKey,
} from "shared/generated";
import {
  getEntitlement,
  getFeatureFlag,
  isEntitled,
  isFeatureFlagEnabled,
} from "shared";

const FeatureAccessContext = createContext<FeatureAccessSnapshot | null>(null);

export function FeatureAccessProvider({
  access,
  children,
}: {
  access: FeatureAccessSnapshot | null;
  children: React.ReactNode;
}) {
  return (
    <FeatureAccessContext.Provider value={access}>
      {children}
    </FeatureAccessContext.Provider>
  );
}

export function useFeatureAccess() {
  return useContext(FeatureAccessContext);
}

export function useFeatureFlag(key: FeatureFlagKey): boolean {
  const access = useFeatureAccess();
  return access ? isFeatureFlagEnabled(access, key) : false;
}

export function useEntitlement(key: EntitlementKey): boolean {
  const access = useFeatureAccess();
  return access ? isEntitled(access, key) : false;
}

export function useFeatureFlagState(key: FeatureFlagKey) {
  const access = useFeatureAccess();
  return access ? getFeatureFlag(access, key) : undefined;
}

export function useEntitlementState(key: EntitlementKey) {
  const access = useFeatureAccess();
  return access ? getEntitlement(access, key) : undefined;
}
