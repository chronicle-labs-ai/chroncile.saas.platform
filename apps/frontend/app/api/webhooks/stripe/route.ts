import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

const secretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function stripe(): Stripe {
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(secretKey);
}

export async function POST(request: NextRequest) {
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.subscription || !session.customer) break;
      const tenantId = (session.metadata?.tenantId ?? session.client_reference_id) as string | null;
      if (!tenantId) break;

      const sub = await stripe().subscriptions.retrieve(session.subscription as string);
      const priceId = sub.items.data[0]?.price?.id ?? null;
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          stripeCustomerId: session.customer as string,
          stripeSubscriptionStatus: sub.status,
          stripePriceId: priceId,
        },
      });
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price?.id ?? null;
      const tenant = await prisma.tenant.findFirst({
        where: { stripeCustomerId: sub.customer as string },
        select: { id: true },
      });
      if (tenant) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            stripeSubscriptionStatus: sub.status,
            stripePriceId: priceId,
          },
        });
      }
      break;
    }
    default:
      // Unhandled event type
      break;
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
