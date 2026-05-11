/*
 * Backtests seed registry. Calling `resolveBacktestsSeed(id)`
 * returns the matching `Seed` (or the `default` seed with a console
 * warning on miss); `seed.build()` produces a fresh, mutable
 * `BacktestsSeedData`.
 */

import { resolveSeed, type Seed } from "../types";

import { chronicleDemoBacktestsSeed } from "./chronicle-demo";
import { defaultBacktestsSeed } from "./default";
import { emptyBacktestsSeed } from "./empty";
import { supportFlowBacktestsSeed } from "./support-flow";
import type { BacktestsSeed, BacktestsSeedData } from "./types";

export type { BacktestsSeed, BacktestsSeedData };
export {
  chronicleDemoBacktestsSeed,
  defaultBacktestsSeed,
  emptyBacktestsSeed,
  supportFlowBacktestsSeed,
};

export const BACKTESTS_SEEDS: readonly BacktestsSeed[] = [
  defaultBacktestsSeed,
  emptyBacktestsSeed,
  supportFlowBacktestsSeed,
  chronicleDemoBacktestsSeed,
];

export function resolveBacktestsSeed(id: string | undefined): BacktestsSeed {
  return resolveSeed<BacktestsSeedData>(
    BACKTESTS_SEEDS as readonly Seed<BacktestsSeedData>[],
    id,
    "backtests",
  );
}
