"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { getStripe, getStripePriceIdsByLookupKeys } from "@/lib/stripe-server";
import { getPlanById } from "@/lib/plans";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function createCheckoutSession(planId: string): Promise<{ url?: string; error?: string }> {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return { error: "Unauthorized" };
  }

  const plan = getPlanById(planId);
  if (!plan?.lookupKey) {
    return { error: "Invalid plan" };
  }

  const stripe = getStripe();
  if (!stripe) {
    return { error: "Billing is not configured" };
  }

  const priceIds = await getStripePriceIdsByLookupKeys();
  const priceId = priceIds[plan.lookupKey];
  if (!priceId) {
    return { error: "Plan not found in Stripe. Run scripts/stripe-sync-plans.mjs first." };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { stripeCustomerId: true },
  });
  if (!tenant) return { error: "Tenant not found" };

  let customerId = tenant.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      name: session.user.tenantName ?? undefined,
      metadata: { tenantId: session.user.tenantId },
    });
    customerId = customer.id;
    await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: { stripeCustomerId: customerId },
    });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard/settings?success=billing`,
    cancel_url: `${baseUrl}/dashboard/settings?cancel=billing`,
    metadata: { tenantId: session.user.tenantId },
    client_reference_id: session.user.tenantId,
  });

  const url = checkoutSession.url ?? undefined;
  return url ? { url } : { error: "Failed to create checkout session" };
}

export async function createPortalSession(): Promise<{ url?: string; error?: string }> {
  const session = await auth();
  if (!session?.user?.tenantId) return { error: "Unauthorized" };

  const stripe = getStripe();
  if (!stripe) return { error: "Billing is not configured" };

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { stripeCustomerId: true },
  });
  if (!tenant?.stripeCustomerId) return { error: "No billing account found" };

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: `${baseUrl}/dashboard/settings`,
  });

  return { url: portalSession.url ?? undefined };
}
