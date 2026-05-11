/*
 * Environments seed registry. Calling `resolveEnvironmentsSeed(id)`
 * returns the matching `Seed` (or the `default` seed with a console
 * warning on miss); `seed.build()` produces a fresh, mutable
 * `EnvironmentsSeedData`.
 */

import { resolveSeed, type Seed } from "../types";

import {
  CHRONICLE_DEMO_BILLING_ENV_ID,
  chronicleDemoBillingEnv,
  chronicleDemoEnvironmentsSeed,
} from "./chronicle-demo";
import { defaultEnvironmentsSeed } from "./default";
import { emptyEnvironmentsSeed } from "./empty";
import { supportFlowEnvironmentsSeed } from "./support-flow";
import type { EnvironmentsSeed, EnvironmentsSeedData } from "./types";

export type { EnvironmentsSeed, EnvironmentsSeedData };
export {
  chronicleDemoBillingEnv,
  chronicleDemoEnvironmentsSeed,
  CHRONICLE_DEMO_BILLING_ENV_ID,
  defaultEnvironmentsSeed,
  emptyEnvironmentsSeed,
  supportFlowEnvironmentsSeed,
};

export const ENVIRONMENTS_SEEDS: readonly EnvironmentsSeed[] = [
  defaultEnvironmentsSeed,
  emptyEnvironmentsSeed,
  supportFlowEnvironmentsSeed,
  chronicleDemoEnvironmentsSeed,
];

export function resolveEnvironmentsSeed(
  id: string | undefined,
): EnvironmentsSeed {
  return resolveSeed<EnvironmentsSeedData>(
    ENVIRONMENTS_SEEDS as readonly Seed<EnvironmentsSeedData>[],
    id,
    "environments",
  );
}
