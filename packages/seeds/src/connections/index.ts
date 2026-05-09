/*
 * Connections seed registry. Calling `resolveConnectionsSeed(id)`
 * returns the matching `Seed` (or the `default` seed with a console
 * warning on miss); `seed.build()` produces a fresh, mutable
 * `ConnectionsSeedData`.
 */

import { resolveSeed, type Seed } from "../types";

import { defaultConnectionsSeed } from "./default";
import { emptyConnectionsSeed } from "./empty";
import { supportFlowConnectionsSeed } from "./support-flow";
import type { ConnectionsSeed, ConnectionsSeedData } from "./types";

export type { ConnectionsSeed, ConnectionsSeedData };
export {
  defaultConnectionsSeed,
  emptyConnectionsSeed,
  supportFlowConnectionsSeed,
};

export const CONNECTIONS_SEEDS: readonly ConnectionsSeed[] = [
  defaultConnectionsSeed,
  emptyConnectionsSeed,
  supportFlowConnectionsSeed,
];

export function resolveConnectionsSeed(id: string | undefined): ConnectionsSeed {
  return resolveSeed<ConnectionsSeedData>(
    CONNECTIONS_SEEDS as readonly Seed<ConnectionsSeedData>[],
    id,
    "connections",
  );
}
