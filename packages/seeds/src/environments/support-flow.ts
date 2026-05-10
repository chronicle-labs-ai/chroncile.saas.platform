/*
 * Support-flow environments seed.
 *
 * The `support-agent` narrative (see `_scenarios/support-flow.ts`)
 * runs against the existing `env_acme_refunds` sandbox from the
 * canonical `ui` fixtures — it's already shaped for a refund /
 * support agent (Stripe sandboxed-writes, replay-backed Intercom,
 * etc.). We expose just that one row here so the environments
 * picker mirrors the support-flow story without conjuring a
 * brand-new env.
 */

import { environmentsSeed, type SandboxEnvironment } from "ui";

import type { EnvironmentsSeed, EnvironmentsSeedData } from "./types";

const SUPPORT_FLOW_ENV_ID = "env_acme_refunds";

export const supportFlowEnvironmentsSeed: EnvironmentsSeed = {
  id: "support-flow",
  label: "Support flow",
  description:
    "1 sandbox (`Acme Support Sandbox`) — the env the support-agent runs against.",
  build(): EnvironmentsSeedData {
    const base = environmentsSeed.find((e) => e.id === SUPPORT_FLOW_ENV_ID);
    return {
      environments: base
        ? ([structuredClone(base) as SandboxEnvironment] as readonly SandboxEnvironment[])
        : ([] as readonly SandboxEnvironment[]),
    };
  },
};
