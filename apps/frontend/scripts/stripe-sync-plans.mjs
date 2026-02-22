#!/usr/bin/env node
/**
 * Sync subscription plans from config/plans.json to Stripe.
 * Creates Products and Prices via Stripe API (no Dashboard needed).
 * Run once per environment: node scripts/stripe-sync-plans.mjs
 * Requires: STRIPE_SECRET_KEY in env (use test key for dev).
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Stripe from "stripe";

const __dirname = dirname(fileURLToPath(import.meta.url));
const plansPath = join(__dirname, "..", "config", "plans.json");

const plansJson = JSON.parse(readFileSync(plansPath, "utf-8"));
const plans = plansJson.plans;

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error("STRIPE_SECRET_KEY is required. Set it in .env or .env.local.");
  process.exit(1);
}

const stripe = new Stripe(secretKey);

async function main() {
  console.log("Syncing plans from config/plans.json to Stripe...\n");

  const lookupKeys = plans.map((p) => p.lookupKey).filter(Boolean);
  let existingPrices = [];
  if (lookupKeys.length > 0) {
    const list = await stripe.prices.list({ lookup_keys: lookupKeys, limit: 100 });
    existingPrices = list.data;
  }

  for (const plan of plans) {
    const existing = existingPrices.find((p) => p.lookup_key === plan.lookupKey);
    if (existing) {
      console.log(`  ${plan.id}: price already exists ${existing.id} (${plan.lookupKey}), skipping.`);
      continue;
    }

    try {
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description ?? undefined,
        metadata: { planId: plan.id },
      });

      const price = await stripe.prices.create({
        product: product.id,
        currency: (plan.currency ?? "usd").toLowerCase(),
        unit_amount: plan.amountCents,
        recurring: {
          interval: plan.interval ?? "month",
          interval_count: plan.intervalCount ?? 1,
        },
        lookup_key: plan.lookupKey ?? undefined,
        metadata: { planId: plan.id },
      });

      console.log(`  ${plan.id}: product ${product.id}, price ${price.id} (${plan.lookupKey ?? "no lookup_key"})`);
    } catch (err) {
      console.error(`  ${plan.id}: error`, err.message);
    }
  }

  console.log("\nDone. The app fetches Price IDs by lookup_key from Stripe; no env vars for price IDs needed.");
}

main();
