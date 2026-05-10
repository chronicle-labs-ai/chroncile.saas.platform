/*
 * Environments seed shape.
 *
 * The mock provider boots its `MockStore` from `EnvironmentsSeedData`;
 * the dashboard route reads through `useEnvironments()` and feeds
 * `EnvironmentsManager`. Storybook decorators may render the manager
 * against non-default scenarios.
 *
 * `SandboxEnvironment` is a UI-only type (it carries Daytona-derived
 * runtime status enums and the per-environment tool / scenario / agent
 * shapes the manager renders). There is no Chronicle Zod schema for
 * it today — TypeScript is the only validator.
 */

import type { SandboxEnvironment } from "ui";

import type { Seed } from "../types";

export interface EnvironmentsSeedData {
  /** Manager-list rows. Order is preserved when rendered. */
  environments: readonly SandboxEnvironment[];
}

export type EnvironmentsSeed = Seed<EnvironmentsSeedData>;
