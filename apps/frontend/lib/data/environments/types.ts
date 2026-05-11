/*
 * Environments provider interface + event shape.
 *
 * Every impl (`mock`, `app`, `chronicle`) satisfies the same
 * contract. Mutations (start/stop/exec/stats) already proxy through
 * `/api/sandbox/*` directly from the page — those don't go through
 * this provider. This domain only governs the catalog of
 * environments shown in the manager list.
 */

import type { SandboxEnvironment } from "ui";

import type { Subscription } from "../types";

export type EnvironmentsEvent = {
  kind: "list-changed";
  environments: readonly SandboxEnvironment[];
};

export interface EnvironmentsProvider {
  list(): Promise<readonly SandboxEnvironment[]>;
  subscribe(handler: (event: EnvironmentsEvent) => void): Subscription;
}

export interface ResettableEnvironmentsProvider extends EnvironmentsProvider {
  /** Mock-only: swap to a different scenario seed without re-mount. */
  reset?: (seedId?: string) => void;
}
