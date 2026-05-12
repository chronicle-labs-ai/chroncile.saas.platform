/*
 * Timeline domain entrypoint.
 *
 * Exports the registry + a `resolveTimelineSeed(id)` helper used by
 * the data middleware's mock provider and by the `seed:chronicle`
 * CLI.
 */

import { resolveSeed } from "../types";
import { chronicleDemoTimelineSeed } from "./chronicle-demo";
import { defaultTimelineSeed } from "./default";
import { emptyTimelineSeed } from "./empty";
import { supportFlowTimelineSeed } from "./support-flow";
import type { TimelineSeed, TimelineSeedData } from "./types";

export type { TimelineSeed, TimelineSeedData };
export {
  chronicleDemoTimelineSeed,
  defaultTimelineSeed,
  emptyTimelineSeed,
  supportFlowTimelineSeed,
};

export const TIMELINE_SEEDS: readonly TimelineSeed[] = [
  defaultTimelineSeed,
  emptyTimelineSeed,
  supportFlowTimelineSeed,
  chronicleDemoTimelineSeed,
];

export function resolveTimelineSeed(id: string | undefined): TimelineSeed {
  return resolveSeed(TIMELINE_SEEDS, id, "timeline");
}
