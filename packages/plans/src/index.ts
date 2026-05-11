import plansJson from "./plans.json";

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

const REMEDY_MEDS_SLUG = "remedy-meds-f2b2gz";
const TEST_SLUG = "remedy-meds-ygo1c4";
const CUSTOM_PLAN_TENANT_SLUGS = [REMEDY_MEDS_SLUG, TEST_SLUG];

export function getPlans(): Plan[] {
  return plans;
}

export function getPlansForTenant(tenantSlug: string | null): Plan[] {
  if (!tenantSlug)
    return plans.filter((plan) => plan.id !== "customEnterprise");
  if (CUSTOM_PLAN_TENANT_SLUGS.includes(tenantSlug)) {
    return plans.filter((plan) => plan.id !== "enterprise");
  }
  return plans.filter((plan) => plan.id !== "customEnterprise");
}

export function getRecommendedPlanId(tenantSlug: string | null): string {
  if (tenantSlug && CUSTOM_PLAN_TENANT_SLUGS.includes(tenantSlug)) {
    return "customEnterprise";
  }
  return "pro";
}

export function getPlanById(id: string): Plan | undefined {
  return plans.find((plan) => plan.id === id);
}

export function getPlanByLookupKey(lookupKey: string): Plan | undefined {
  return plans.find((plan) => plan.lookupKey === lookupKey);
}

export { plans };
