/*
 * Agents seed registry. Consumers should call `resolveAgentsSeed(id)`
 * and then `seed.build()` rather than reaching into individual
 * modules — keeps the lookup + warning-on-missing behaviour
 * consistent with every other domain.
 */

import { resolveSeed, type Seed } from "../types";

import { defaultAgentsSeed } from "./default";
import { emptyAgentsSeed } from "./empty";
import { supportFlowAgentsSeed } from "./support-flow";
import type { AgentsSeed, AgentsSeedData } from "./types";

export type { AgentsSeed, AgentsSeedData };
export { defaultAgentsSeed, emptyAgentsSeed, supportFlowAgentsSeed };

export const AGENTS_SEEDS: readonly AgentsSeed[] = [
  defaultAgentsSeed,
  emptyAgentsSeed,
  supportFlowAgentsSeed,
];

export function resolveAgentsSeed(id: string | undefined): AgentsSeed {
  return resolveSeed<AgentsSeedData>(
    AGENTS_SEEDS as readonly Seed<AgentsSeedData>[],
    id,
    "agents",
  );
}
