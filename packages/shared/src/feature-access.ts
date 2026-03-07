import type {
  EntitlementKey,
  EntitlementSnapshot,
  FeatureAccessSnapshot,
  FeatureFlagKey,
  FeatureFlagSnapshot,
} from "./generated";

export const FEATURE_FLAG_KEYS: FeatureFlagKey[] = [
  "sandbox",
  "auditLog",
  "agentEndpointConfig",
  "workflowFilters",
];

export const ENTITLEMENT_KEYS: EntitlementKey[] = [
  "runs",
  "connections",
  "auditLog",
  "agentEndpointConfig",
  "sandbox",
  "workflowFilters",
];

export function getFeatureFlag(
  access: FeatureAccessSnapshot,
  key: FeatureFlagKey
): FeatureFlagSnapshot | undefined {
  return access.flags.find((flag) => flag.key === key);
}

export function getEntitlement(
  access: FeatureAccessSnapshot,
  key: EntitlementKey
): EntitlementSnapshot | undefined {
  return access.entitlements.find((entitlement) => entitlement.key === key);
}

export function isFeatureFlagEnabled(
  access: FeatureAccessSnapshot,
  key: FeatureFlagKey
): boolean {
  return getFeatureFlag(access, key)?.enabled ?? false;
}

export function isEntitled(
  access: FeatureAccessSnapshot,
  key: EntitlementKey
): boolean {
  return getEntitlement(access, key)?.enabled ?? false;
}
