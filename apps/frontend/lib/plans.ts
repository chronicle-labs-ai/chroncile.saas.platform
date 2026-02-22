import plansJson from "@/config/plans.json";

export interface Plan {
  id: string;
  name: string;
  description: string;
  amountCents: number;
  currency: string;
  interval: string;
  lookupKey: string;
  features: string[];
}

const plans = (plansJson as { plans: Plan[] }).plans;

export function getPlans(): Plan[] {
  return plans;
}

export function getPlanById(id: string): Plan | undefined {
  return plans.find((p) => p.id === id);
}

export function getPlanByLookupKey(lookupKey: string): Plan | undefined {
  return plans.find((p) => p.lookupKey === lookupKey);
}
