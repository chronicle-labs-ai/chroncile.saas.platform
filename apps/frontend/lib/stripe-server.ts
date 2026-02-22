import Stripe from "stripe";
import { getPlans } from "./plans";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey && typeof window === "undefined") {
  console.warn("STRIPE_SECRET_KEY is not set; billing features will be disabled.");
}

export function getStripe(): Stripe | null {
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

/**
 * Fetch Stripe Price IDs by lookup_keys from config/plans.json.
 * Used when creating Checkout sessions so we never store price IDs in env.
 */
export async function getStripePriceIdsByLookupKeys(): Promise<Record<string, string>> {
  const stripe = getStripe();
  if (!stripe) return {};
  const plans = getPlans();
  const lookupKeys = plans.map((p) => p.lookupKey).filter(Boolean);
  if (lookupKeys.length === 0) return {};
  const list = await stripe.prices.list({ lookup_keys: lookupKeys, limit: 100 });
  const out: Record<string, string> = {};
  for (const price of list.data) {
    if (price.lookup_key) out[price.lookup_key] = price.id;
  }
  return out;
}
