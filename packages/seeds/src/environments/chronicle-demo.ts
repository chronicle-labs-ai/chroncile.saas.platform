/*
 * Chronicle-demo environments seed.
 *
 * One sandbox — `env_chronicle_demo_billing` — that replicas the
 * SaaS billing stack: sandboxed Stripe writes, a seeded Salesforce
 * org, and a Postgres clone of the product entitlement table. This
 * is the same env the chronicle-demo backtests seed targets, and
 * `backtests/chronicle-demo.ts` re-uses `chronicleDemoBillingEnv`
 * from this module so the env id / shape is defined in exactly
 * one place.
 */

import type { SandboxEnvironment } from "ui";

import { CHRONICLE_DEMO_ANCHOR_MS } from "../_scenarios/chronicle-demo";
import type { EnvironmentsSeed, EnvironmentsSeedData } from "./types";

export const CHRONICLE_DEMO_BILLING_ENV_ID = "env_chronicle_demo_billing";
export const CHRONICLE_DEMO_BILLING_DATASET_ID = "ds_chronicle_demo_replay";

const ANCHOR = CHRONICLE_DEMO_ANCHOR_MS;
const iso = (offsetMin: number) =>
  new Date(ANCHOR - offsetMin * 60_000).toISOString();

const envSnapshot: SandboxEnvironment["currentSnapshot"] = {
  id: "snap_chronicle_demo_billing_2026_05",
  name: "Billing replay · last 7 days",
  sourceDataset: CHRONICLE_DEMO_BILLING_DATASET_ID,
  seededAt: iso(60),
  scenarios: 7,
  entities: 14,
  records: 1_240,
  files: 3,
  traces: 7,
  traceSeeds: [
    {
      id: "ts_chronicle_demo_billing",
      title: "Billing replay traces",
      sources: ["intercom", "stripe", "salesforce", "postgres"],
      events: 67,
      records: 1_240,
      entities: 14,
      files: 3,
    },
  ],
};

const envResources: SandboxEnvironment["resources"] = {
  vCpu: 2,
  memoryGib: 4,
  diskGib: 16,
};

/**
 * Canonical chronicle-demo billing sandbox. Exported so the
 * backtests seed can reference the same env without duplicating
 * the long fixture body.
 */
export const chronicleDemoBillingEnv: SandboxEnvironment = {
  id: CHRONICLE_DEMO_BILLING_ENV_ID,
  name: "Chronicle billing sandbox",
  company: "Chronicle Labs (demo)",
  description:
    "Safe replica of the SaaS billing stack — sandboxed Stripe, seeded Salesforce, and a Postgres copy of the product entitlement table.",
  owner: "billing@chronicle.io",
  status: "ready",
  updatedAt: iso(45),
  eventsPerMin: 32,
  activeAgents: 2,
  currentSnapshot: envSnapshot,
  resources: envResources,
  scenarioSets: [
    {
      id: "ss_billing_replay",
      name: "Billing replay corpus",
      description:
        "Seven production conversations covering cancellations, refunds, and plan changes.",
      count: 7,
      coverage: ["cancellation", "refund", "plan-change", "reconciliation"],
      recommendedTools: ["stripe-sandbox", "salesforce-seeded", "product-db"],
    },
  ],
  tools: [
    {
      id: "tool_stripe_sandbox",
      name: "Stripe (sandbox)",
      kind: "api",
      source: "stripe",
      mode: "sandboxed-writes",
      status: "available",
      latencyMs: 180,
      enabled: true,
      capabilities: ["charges", "refunds", "subscriptions", "invoices"],
      description:
        "Stripe live-mode shape, but every write hits a sandboxed account — no real customers.",
    },
    {
      id: "tool_salesforce_seeded",
      name: "Salesforce (seeded org)",
      kind: "api",
      source: "salesforce",
      mode: "replay-backed",
      status: "available",
      latencyMs: 240,
      enabled: true,
      capabilities: ["accounts", "opportunities", "contacts"],
      description:
        "Pre-seeded company accounts with realistic billing-owner / contractor relationships.",
    },
    {
      id: "tool_product_db",
      name: "Postgres (product DB)",
      kind: "database",
      source: "postgres",
      mode: "sandboxed-writes",
      status: "available",
      latencyMs: 35,
      enabled: true,
      capabilities: ["tenants.read", "tenants.write", "audit_log.read"],
      description:
        "Cloned tenant entitlement table — used for the reconciliation step after billing mutations.",
    },
    {
      id: "tool_intercom_replay",
      name: "Intercom (replay)",
      kind: "api",
      source: "intercom",
      mode: "replay-backed",
      status: "available",
      latencyMs: 90,
      enabled: true,
      capabilities: ["conversations.read", "conversations.write", "users.read"],
      description:
        "Replays the seven captured customer conversations as if they were arriving live.",
    },
  ],
  failures: [],
  agentIdentities: [
    {
      id: "ai_billing_agent",
      label: "billing-agent",
      principal: "billing-agent@chronicle.io",
      scopes: ["billing:read", "billing:write", "tenants:read", "tenants:write"],
    },
  ],
  activity: [
    {
      id: "act_seed",
      kind: "seed",
      title: "Seeded billing replay corpus",
      detail: "Loaded 7 traces · 1,240 records · 14 entities",
      at: iso(45),
      actor: "naomi@chronicle.io",
    },
    {
      id: "act_run",
      kind: "agent",
      title: "Pre-launch backtest",
      detail: "billing-agent@1.0.0 vs billing-agent@1.1.0",
      at: iso(8),
      actor: "naomi@chronicle.io",
    },
  ],
  tags: ["demo", "billing", "replay"],
};

export const chronicleDemoEnvironmentsSeed: EnvironmentsSeed = {
  id: "chronicle-demo",
  label: "Chronicle demo (billing)",
  description:
    "1 sandbox (`Chronicle billing sandbox`) wired to the chronicle-demo replay corpus.",
  build(): EnvironmentsSeedData {
    return {
      environments: [
        structuredClone(chronicleDemoBillingEnv) as SandboxEnvironment,
      ],
    };
  },
};
