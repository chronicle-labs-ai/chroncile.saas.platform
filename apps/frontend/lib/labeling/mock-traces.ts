/* ------------------------------------------------------------------ */
/*  Mock trace data — realistic multi-source event chains              */
/*  Each trace simulates a real customer journey across systems        */
/* ------------------------------------------------------------------ */

import type { Trace, TraceEvent, AutoActionAudit, HumanActionAudit } from "./types";

/* helpers */
const TENANT = "demo-tenant";
let _id = 0;
const uid = () => `trace_${(++_id).toString().padStart(3, "0")}`;
const eid = () => `evt_${Math.random().toString(36).slice(2, 10)}`;

/** Build a date string offset from a base date by `minutes` */
function offset(base: Date, minutes: number): string {
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}

/* ------------------------------------------------------------------ */
/*  Trace 1 — Wrong item return request                               */
/* ------------------------------------------------------------------ */

const t1Base = new Date("2026-02-07T09:15:00Z");
const t1Events: TraceEvent[] = [
  {
    event_id: eid(), source: "intercom", event_type: "conversation.started",
    occurred_at: offset(t1Base, 0),
    actor: { actor_type: "customer", actor_id: "cust_291", name: "Sarah Chen" },
    message: "Customer initiated a new conversation",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t1Base, 1),
    actor: { actor_type: "customer", actor_id: "cust_291", name: "Sarah Chen" },
    message: "Hi, I received the wrong item in my order #ORD-4582. I ordered the blue ceramic vase but got a red one instead. Can I get this returned and the correct item shipped?",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t1Base, 4),
    actor: { actor_type: "agent", actor_id: "agent_12", name: "Marcus Rivera" },
    message: "Hi Sarah! I'm sorry about that mix-up. Let me pull up your order details right away.",
  },
  {
    event_id: eid(), source: "stripe", event_type: "charge.retrieved",
    occurred_at: offset(t1Base, 5),
    actor: { actor_type: "system", actor_id: "stripe_system" },
    message: "Retrieved charge ch_3Nx8qK for order #ORD-4582",
    payload: { charge_id: "ch_3Nx8qK", amount: 8999, currency: "usd", status: "succeeded", customer: "cus_291" },
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t1Base, 7),
    actor: { actor_type: "agent", actor_id: "agent_12", name: "Marcus Rivera" },
    message: "I can see the charge of $89.99 for the blue ceramic vase. I'll submit a return request for the incorrect item. Since this is our error, we'll cover the return shipping.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t1Base, 9),
    actor: { actor_type: "customer", actor_id: "cust_291", name: "Sarah Chen" },
    message: "Thank you! How long will it take to get the correct item?",
  },
  {
    event_id: eid(), source: "slack", event_type: "message.sent",
    occurred_at: offset(t1Base, 12),
    actor: { actor_type: "agent", actor_id: "agent_12", name: "Marcus Rivera" },
    message: "#returns-approvals: Return request for order #ORD-4582 — wrong item shipped (blue ceramic vase → red). Customer: Sarah Chen. Charge: $89.99. Requesting manager approval for return + reship.",
    payload: { channel: "#returns-approvals", thread_ts: "1738923700.001" },
  },
  {
    event_id: eid(), source: "slack", event_type: "message.received",
    occurred_at: offset(t1Base, 38),
    actor: { actor_type: "manager", actor_id: "mgr_03", name: "Diana Patel" },
    message: "Approved. Please expedite the reship — this is a repeat customer. Use 2-day shipping.",
    payload: { channel: "#returns-approvals", thread_ts: "1738923700.001" },
  },
  {
    event_id: eid(), source: "stripe", event_type: "refund.created",
    occurred_at: offset(t1Base, 42),
    actor: { actor_type: "system", actor_id: "stripe_system" },
    message: "Refund re_7Px9rL created for charge ch_3Nx8qK",
    payload: { refund_id: "re_7Px9rL", amount: 8999, status: "pending", reason: "wrong_item" },
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t1Base, 45),
    actor: { actor_type: "agent", actor_id: "agent_12", name: "Marcus Rivera" },
    message: "Great news, Sarah! Your return has been approved and a refund of $89.99 is being processed. We're also shipping the correct blue ceramic vase with 2-day express shipping. You'll receive a return label via email shortly.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t1Base, 48),
    actor: { actor_type: "customer", actor_id: "cust_291", name: "Sarah Chen" },
    message: "That's wonderful, thank you so much for the quick resolution! I appreciate the expedited shipping.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "conversation.closed",
    occurred_at: offset(t1Base, 50),
    actor: { actor_type: "agent", actor_id: "agent_12", name: "Marcus Rivera" },
    message: "Conversation closed — resolved",
  },
];

/* ------------------------------------------------------------------ */
/*  Trace 2 — Billing double charge                                   */
/* ------------------------------------------------------------------ */

const t2Base = new Date("2026-02-07T11:30:00Z");
const t2Events: TraceEvent[] = [
  {
    event_id: eid(), source: "intercom", event_type: "conversation.started",
    occurred_at: offset(t2Base, 0),
    actor: { actor_type: "customer", actor_id: "cust_445", name: "James Mitchell" },
    message: "Customer initiated a new conversation",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t2Base, 1),
    actor: { actor_type: "customer", actor_id: "cust_445", name: "James Mitchell" },
    message: "I just noticed I was charged twice for my subscription this month. I see two charges of $29.99 on Feb 1st. Please fix this ASAP.",
  },
  {
    event_id: eid(), source: "stripe", event_type: "charge.list",
    occurred_at: offset(t2Base, 3),
    actor: { actor_type: "system", actor_id: "stripe_system" },
    message: "Retrieved 2 charges for customer cus_445 in February",
    payload: { charges: [{ id: "ch_A1b2", amount: 2999, created: "2026-02-01T00:00:12Z" }, { id: "ch_C3d4", amount: 2999, created: "2026-02-01T00:05:47Z" }] },
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t2Base, 6),
    actor: { actor_type: "agent", actor_id: "agent_08", name: "Priya Sharma" },
    message: "Hi James, I can confirm there are two charges of $29.99 from Feb 1st. This looks like a duplicate charge from our payment processor. I'm initiating a refund for the duplicate right now.",
  },
  {
    event_id: eid(), source: "stripe", event_type: "refund.created",
    occurred_at: offset(t2Base, 8),
    actor: { actor_type: "system", actor_id: "stripe_system" },
    message: "Refund re_E5f6 created for duplicate charge ch_C3d4",
    payload: { refund_id: "re_E5f6", amount: 2999, charge: "ch_C3d4", status: "succeeded", reason: "duplicate" },
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t2Base, 10),
    actor: { actor_type: "agent", actor_id: "agent_08", name: "Priya Sharma" },
    message: "Done! I've refunded the duplicate charge of $29.99. It should appear on your statement within 3-5 business days. I apologize for the inconvenience.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t2Base, 12),
    actor: { actor_type: "customer", actor_id: "cust_445", name: "James Mitchell" },
    message: "Thanks for the quick fix. Appreciate it.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "conversation.closed",
    occurred_at: offset(t2Base, 14),
    actor: { actor_type: "agent", actor_id: "agent_08", name: "Priya Sharma" },
    message: "Conversation closed — resolved",
  },
];

/* ------------------------------------------------------------------ */
/*  Trace 3 — Feature request: dark mode                              */
/* ------------------------------------------------------------------ */

const t3Base = new Date("2026-02-06T16:20:00Z");
const t3Events: TraceEvent[] = [
  {
    event_id: eid(), source: "intercom", event_type: "conversation.started",
    occurred_at: offset(t3Base, 0),
    actor: { actor_type: "customer", actor_id: "cust_112", name: "Aisha Kone" },
    message: "Customer initiated a new conversation",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t3Base, 1),
    actor: { actor_type: "customer", actor_id: "cust_112", name: "Aisha Kone" },
    message: "Hi! I love the product but I really wish there was a dark mode option. I use it late at night and the bright interface hurts my eyes. Any plans for this?",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t3Base, 5),
    actor: { actor_type: "agent", actor_id: "agent_15", name: "Tom Nakamura" },
    message: "Thanks for the feedback, Aisha! Dark mode is actually on our roadmap for Q2 2026. I'll add your vote to the feature request to help prioritize it. In the meantime, you might find browser extensions like Dark Reader helpful.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t3Base, 8),
    actor: { actor_type: "customer", actor_id: "cust_112", name: "Aisha Kone" },
    message: "That's great to hear! I'll try the extension. Thanks!",
  },
  {
    event_id: eid(), source: "intercom", event_type: "conversation.closed",
    occurred_at: offset(t3Base, 10),
    actor: { actor_type: "agent", actor_id: "agent_15", name: "Tom Nakamura" },
    message: "Conversation closed — resolved",
  },
];

/* ------------------------------------------------------------------ */
/*  Trace 4 — Bug report: checkout crash                              */
/* ------------------------------------------------------------------ */

const t4Base = new Date("2026-02-08T08:05:00Z");
const t4Events: TraceEvent[] = [
  {
    event_id: eid(), source: "intercom", event_type: "conversation.started",
    occurred_at: offset(t4Base, 0),
    actor: { actor_type: "customer", actor_id: "cust_678", name: "Robert Lang" },
    message: "Customer initiated a new conversation",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t4Base, 1),
    actor: { actor_type: "customer", actor_id: "cust_678", name: "Robert Lang" },
    message: "Your checkout page keeps crashing when I try to apply a promo code. I've tried 3 times on Chrome and Safari. Error message says \"Something went wrong\". I'm trying to use code WINTER20.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t4Base, 4),
    actor: { actor_type: "agent", actor_id: "agent_12", name: "Marcus Rivera" },
    message: "I'm sorry about that, Robert. That sounds like a bug. Let me escalate this to our engineering team right away. Can you tell me what items were in your cart?",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t4Base, 7),
    actor: { actor_type: "customer", actor_id: "cust_678", name: "Robert Lang" },
    message: "I had 2 items — the standing desk converter and the monitor arm. Total was around $340 before the promo.",
  },
  {
    event_id: eid(), source: "slack", event_type: "message.sent",
    occurred_at: offset(t4Base, 10),
    actor: { actor_type: "agent", actor_id: "agent_12", name: "Marcus Rivera" },
    message: "#eng-bugs: URGENT — Checkout crash when applying promo code WINTER20. Customer Robert Lang reports crash on Chrome + Safari. Cart: standing desk converter + monitor arm (~$340). Error: \"Something went wrong\". Reproducible — 3 attempts failed.",
    payload: { channel: "#eng-bugs", priority: "high" },
  },
  {
    event_id: eid(), source: "slack", event_type: "message.received",
    occurred_at: offset(t4Base, 18),
    actor: { actor_type: "agent", actor_id: "eng_05", name: "Alex Okafor" },
    message: "Looking into it. Found the issue — promo code validation fails on carts with items from different categories. Pushing a hotfix now.",
    payload: { channel: "#eng-bugs" },
  },
  {
    event_id: eid(), source: "github", event_type: "pull_request.merged",
    occurred_at: offset(t4Base, 55),
    actor: { actor_type: "system", actor_id: "github_system" },
    message: "PR #1847 merged: Fix promo code validation for multi-category carts",
    payload: { pr_number: 1847, branch: "fix/promo-code-validation", author: "alex-okafor" },
  },
  {
    event_id: eid(), source: "slack", event_type: "message.sent",
    occurred_at: offset(t4Base, 60),
    actor: { actor_type: "agent", actor_id: "eng_05", name: "Alex Okafor" },
    message: "#eng-bugs: Hotfix deployed. Promo code WINTER20 should work now for multi-category carts.",
    payload: { channel: "#eng-bugs" },
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t4Base, 65),
    actor: { actor_type: "agent", actor_id: "agent_12", name: "Marcus Rivera" },
    message: "Robert, our engineering team found and fixed the bug. The promo code WINTER20 should work now. Could you try again? And as an apology, I've also added an extra 5% discount to your account.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "conversation.closed",
    occurred_at: offset(t4Base, 90),
    actor: { actor_type: "agent", actor_id: "agent_12", name: "Marcus Rivera" },
    message: "Conversation closed — resolved after customer confirmed successful checkout",
  },
];

/* ------------------------------------------------------------------ */
/*  Trace 5 — Onboarding help: API setup                              */
/* ------------------------------------------------------------------ */

const t5Base = new Date("2026-02-06T14:00:00Z");
const t5Events: TraceEvent[] = [
  {
    event_id: eid(), source: "intercom", event_type: "conversation.started",
    occurred_at: offset(t5Base, 0),
    actor: { actor_type: "customer", actor_id: "cust_830", name: "Lena Virtanen" },
    message: "Customer initiated a new conversation",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t5Base, 1),
    actor: { actor_type: "customer", actor_id: "cust_830", name: "Lena Virtanen" },
    message: "Hi, I just signed up for the developer plan and I'm trying to set up the API integration. The docs mention a webhook URL but I'm not sure where to find my API key or configure the endpoint.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t5Base, 4),
    actor: { actor_type: "agent", actor_id: "agent_15", name: "Tom Nakamura" },
    message: "Welcome aboard, Lena! I'll walk you through the setup. First, go to Settings > API Keys in your dashboard. You'll see a 'Generate Key' button there. Once you have the key, you'll need to configure your webhook endpoint.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t5Base, 10),
    actor: { actor_type: "customer", actor_id: "cust_830", name: "Lena Virtanen" },
    message: "Found it! I generated the key. But when I try to register my webhook URL, I get a 403 error. My endpoint is https://api.myapp.dev/webhooks/incoming",
  },
  {
    event_id: eid(), source: "slack", event_type: "message.sent",
    occurred_at: offset(t5Base, 14),
    actor: { actor_type: "agent", actor_id: "agent_15", name: "Tom Nakamura" },
    message: "#customer-success: New developer plan customer Lena Virtanen getting 403 on webhook registration. URL: https://api.myapp.dev/webhooks/incoming — could be a domain verification issue. Can someone from platform check?",
    payload: { channel: "#customer-success" },
  },
  {
    event_id: eid(), source: "slack", event_type: "message.received",
    occurred_at: offset(t5Base, 22),
    actor: { actor_type: "agent", actor_id: "eng_02", name: "Sam Patel" },
    message: "Checked — the domain needs to be whitelisted first. I've added it. She should retry now.",
    payload: { channel: "#customer-success" },
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t5Base, 25),
    actor: { actor_type: "agent", actor_id: "agent_15", name: "Tom Nakamura" },
    message: "Lena, I had our platform team whitelist your domain. Could you try registering the webhook again?",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t5Base, 30),
    actor: { actor_type: "customer", actor_id: "cust_830", name: "Lena Virtanen" },
    message: "It works now! I can see events coming through. Thanks for the help!",
  },
  {
    event_id: eid(), source: "intercom", event_type: "conversation.closed",
    occurred_at: offset(t5Base, 32),
    actor: { actor_type: "agent", actor_id: "agent_15", name: "Tom Nakamura" },
    message: "Conversation closed — resolved",
  },
];

/* ------------------------------------------------------------------ */
/*  Trace 6 — Refund escalation with manager                         */
/* ------------------------------------------------------------------ */

const t6Base = new Date("2026-02-08T10:20:00Z");
const t6Events: TraceEvent[] = [
  {
    event_id: eid(), source: "intercom", event_type: "conversation.started",
    occurred_at: offset(t6Base, 0),
    actor: { actor_type: "customer", actor_id: "cust_192", name: "Frank Müller" },
    message: "Customer initiated a new conversation",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t6Base, 1),
    actor: { actor_type: "customer", actor_id: "cust_192", name: "Frank Müller" },
    message: "I want a full refund for my annual subscription. I've been paying $299/year and the product hasn't delivered what was promised. The analytics dashboard has been broken for weeks.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t6Base, 4),
    actor: { actor_type: "agent", actor_id: "agent_08", name: "Priya Sharma" },
    message: "I understand your frustration, Frank. I can see the analytics issues have been affecting several users. Let me check your account and discuss refund options.",
  },
  {
    event_id: eid(), source: "stripe", event_type: "subscription.retrieved",
    occurred_at: offset(t6Base, 5),
    actor: { actor_type: "system", actor_id: "stripe_system" },
    message: "Retrieved subscription sub_9Gh0 for customer cus_192",
    payload: { subscription_id: "sub_9Gh0", plan: "annual_pro", amount: 29900, current_period_start: "2025-11-15", current_period_end: "2026-11-15", status: "active" },
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t6Base, 8),
    actor: { actor_type: "agent", actor_id: "agent_08", name: "Priya Sharma" },
    message: "Frank, I can see your annual subscription started on Nov 15, 2025. A full refund of $299 exceeds my authorization limit. I can offer a prorated refund for the remaining months, or I can escalate a full refund request to my manager.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t6Base, 11),
    actor: { actor_type: "customer", actor_id: "cust_192", name: "Frank Müller" },
    message: "I want the full refund. The product was broken for 3 of the 4 months I've been subscribed. Please escalate.",
  },
  {
    event_id: eid(), source: "slack", event_type: "message.sent",
    occurred_at: offset(t6Base, 14),
    actor: { actor_type: "agent", actor_id: "agent_08", name: "Priya Sharma" },
    message: "#escalations: Full refund request for annual Pro subscription ($299). Customer: Frank Müller (cust_192). Reason: Analytics dashboard outages over past 3 months. Customer is frustrated and wants full refund, not prorated. @Diana Patel for approval.",
    payload: { channel: "#escalations" },
  },
  {
    event_id: eid(), source: "slack", event_type: "message.received",
    occurred_at: offset(t6Base, 35),
    actor: { actor_type: "manager", actor_id: "mgr_03", name: "Diana Patel" },
    message: "The analytics issues were indeed widespread. Approve the full refund. Also offer him 3 months free on us when we've fixed the dashboard — we don't want to lose him.",
    payload: { channel: "#escalations" },
  },
  {
    event_id: eid(), source: "stripe", event_type: "refund.created",
    occurred_at: offset(t6Base, 40),
    actor: { actor_type: "system", actor_id: "stripe_system" },
    message: "Refund re_K7m8 created for subscription sub_9Gh0",
    payload: { refund_id: "re_K7m8", amount: 29900, status: "pending" },
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t6Base, 43),
    actor: { actor_type: "agent", actor_id: "agent_08", name: "Priya Sharma" },
    message: "Frank, I've been authorized to issue a full refund of $299. It's being processed now. Additionally, once we've resolved the analytics issues, we'd like to offer you 3 months free to give us another chance. We value your business.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t6Base, 50),
    actor: { actor_type: "customer", actor_id: "cust_192", name: "Frank Müller" },
    message: "I appreciate the full refund and the offer. I'll consider coming back once the analytics are working properly. Thank you for taking this seriously.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "conversation.closed",
    occurred_at: offset(t6Base, 55),
    actor: { actor_type: "agent", actor_id: "agent_08", name: "Priya Sharma" },
    message: "Conversation closed — resolved with full refund + retention offer",
  },
];

/* ------------------------------------------------------------------ */
/*  Trace 7 — Account access recovery (simple)                       */
/* ------------------------------------------------------------------ */

const t7Base = new Date("2026-02-05T18:40:00Z");
const t7Events: TraceEvent[] = [
  {
    event_id: eid(), source: "intercom", event_type: "conversation.started",
    occurred_at: offset(t7Base, 0),
    actor: { actor_type: "customer", actor_id: "cust_503", name: "Maria Gonzales" },
    message: "Customer initiated a new conversation",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t7Base, 1),
    actor: { actor_type: "customer", actor_id: "cust_503", name: "Maria Gonzales" },
    message: "I can't log into my account. I keep getting 'invalid credentials' but I'm sure my password is correct. My email is maria.g@example.com.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t7Base, 3),
    actor: { actor_type: "agent", actor_id: "agent_15", name: "Tom Nakamura" },
    message: "Hi Maria! I can see your account. It looks like it was locked after 5 failed login attempts. I've unlocked it and sent a password reset link to your email.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t7Base, 8),
    actor: { actor_type: "customer", actor_id: "cust_503", name: "Maria Gonzales" },
    message: "Got the email! I'm back in. Thank you!",
  },
  {
    event_id: eid(), source: "intercom", event_type: "conversation.closed",
    occurred_at: offset(t7Base, 10),
    actor: { actor_type: "agent", actor_id: "agent_15", name: "Tom Nakamura" },
    message: "Conversation closed — resolved",
  },
];

/* ------------------------------------------------------------------ */
/*  Trace 8 — Shipping delay complaint                                */
/* ------------------------------------------------------------------ */

const t8Base = new Date("2026-02-07T15:45:00Z");
const t8Events: TraceEvent[] = [
  {
    event_id: eid(), source: "intercom", event_type: "conversation.started",
    occurred_at: offset(t8Base, 0),
    actor: { actor_type: "customer", actor_id: "cust_771", name: "David Park" },
    message: "Customer initiated a new conversation",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t8Base, 1),
    actor: { actor_type: "customer", actor_id: "cust_771", name: "David Park" },
    message: "My order #ORD-5201 was supposed to arrive 4 days ago. Tracking hasn't updated since Feb 3rd. This was supposed to be a birthday gift and the birthday was yesterday. Very disappointed.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t8Base, 3),
    actor: { actor_type: "agent", actor_id: "agent_12", name: "Marcus Rivera" },
    message: "I'm really sorry about this, David. That must be frustrating, especially for a gift. Let me look into the shipping status right away.",
  },
  {
    event_id: eid(), source: "stripe", event_type: "charge.retrieved",
    occurred_at: offset(t8Base, 4),
    actor: { actor_type: "system", actor_id: "stripe_system" },
    message: "Retrieved charge ch_Q2w3 for order #ORD-5201",
    payload: { charge_id: "ch_Q2w3", amount: 6499, currency: "usd", status: "succeeded", shipping_method: "standard" },
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t8Base, 8),
    actor: { actor_type: "agent", actor_id: "agent_12", name: "Marcus Rivera" },
    message: "It looks like the package is stuck in transit at a regional sorting facility. I'm going to file a shipping investigation with our carrier. In the meantime, would you like me to send a replacement with express shipping at no extra cost?",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t8Base, 12),
    actor: { actor_type: "customer", actor_id: "cust_771", name: "David Park" },
    message: "Yes please, that would help. Even though it's late for the birthday I'd still like to give it.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t8Base, 15),
    actor: { actor_type: "agent", actor_id: "agent_12", name: "Marcus Rivera" },
    message: "I've arranged a replacement shipment with overnight delivery. You should receive a tracking number within the hour. I'm also applying a 15% discount to your next order as an apology for the inconvenience.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t8Base, 18),
    actor: { actor_type: "customer", actor_id: "cust_771", name: "David Park" },
    message: "Thank you, I appreciate you going the extra mile.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "conversation.closed",
    occurred_at: offset(t8Base, 20),
    actor: { actor_type: "agent", actor_id: "agent_12", name: "Marcus Rivera" },
    message: "Conversation closed — resolved with replacement + discount",
  },
];

/* ------------------------------------------------------------------ */
/*  Trace 9 — Subscription upgrade (simple, high confidence)          */
/* ------------------------------------------------------------------ */

const t9Base = new Date("2026-02-04T10:00:00Z");
const t9Events: TraceEvent[] = [
  {
    event_id: eid(), source: "intercom", event_type: "conversation.started",
    occurred_at: offset(t9Base, 0),
    actor: { actor_type: "customer", actor_id: "cust_320", name: "Elena Rossi" },
    message: "Customer initiated a new conversation",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t9Base, 1),
    actor: { actor_type: "customer", actor_id: "cust_320", name: "Elena Rossi" },
    message: "I'd like to upgrade from the Starter plan to the Pro plan. How does the billing work if I switch mid-cycle?",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t9Base, 3),
    actor: { actor_type: "agent", actor_id: "agent_08", name: "Priya Sharma" },
    message: "Great choice, Elena! When you upgrade mid-cycle, we'll prorate the difference. You'll only be charged for the remaining days at the Pro rate. Would you like me to process the upgrade?",
  },
  {
    event_id: eid(), source: "stripe", event_type: "subscription.updated",
    occurred_at: offset(t9Base, 6),
    actor: { actor_type: "system", actor_id: "stripe_system" },
    message: "Subscription sub_P4q5 upgraded from starter to pro",
    payload: { subscription_id: "sub_P4q5", previous_plan: "starter", new_plan: "pro", prorated_amount: 1850 },
  },
  {
    event_id: eid(), source: "intercom", event_type: "conversation.closed",
    occurred_at: offset(t9Base, 8),
    actor: { actor_type: "agent", actor_id: "agent_08", name: "Priya Sharma" },
    message: "Conversation closed — upgrade processed",
  },
];

/* ------------------------------------------------------------------ */
/*  Trace 10 — Angry customer: repeated service failure               */
/* ------------------------------------------------------------------ */

const t10Base = new Date("2026-02-08T13:10:00Z");
const t10Events: TraceEvent[] = [
  {
    event_id: eid(), source: "intercom", event_type: "conversation.started",
    occurred_at: offset(t10Base, 0),
    actor: { actor_type: "customer", actor_id: "cust_088", name: "Kevin Wright" },
    message: "Customer initiated a new conversation",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t10Base, 1),
    actor: { actor_type: "customer", actor_id: "cust_088", name: "Kevin Wright" },
    message: "This is the THIRD time this month your service has gone down during business hours. I run an e-commerce store and every hour of downtime costs me thousands. This is absolutely unacceptable. I'm considering switching to your competitor.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t10Base, 3),
    actor: { actor_type: "agent", actor_id: "agent_12", name: "Marcus Rivera" },
    message: "Kevin, I completely understand your frustration and I want you to know we take this very seriously. Let me check the incident reports and connect you with our reliability team.",
  },
  {
    event_id: eid(), source: "slack", event_type: "message.sent",
    occurred_at: offset(t10Base, 5),
    actor: { actor_type: "agent", actor_id: "agent_12", name: "Marcus Rivera" },
    message: "#escalations: HIGH PRIORITY — Repeat customer Kevin Wright (Enterprise plan) threatening churn due to 3 outages this month. Requesting immediate attention from SRE and account management. @Diana Patel @engineering-oncall",
    payload: { channel: "#escalations", priority: "urgent" },
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t10Base, 8),
    actor: { actor_type: "customer", actor_id: "cust_088", name: "Kevin Wright" },
    message: "I need to speak with someone senior. I'm paying enterprise rates for consumer-grade reliability.",
  },
  {
    event_id: eid(), source: "slack", event_type: "message.received",
    occurred_at: offset(t10Base, 12),
    actor: { actor_type: "manager", actor_id: "mgr_03", name: "Diana Patel" },
    message: "I'll jump on the call. We owe him an explanation and a concrete action plan. Also prepare SLA credit calculations for this month.",
    payload: { channel: "#escalations" },
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t10Base, 15),
    actor: { actor_type: "manager", actor_id: "mgr_03", name: "Diana Patel" },
    message: "Hi Kevin, this is Diana Patel, Head of Customer Success. I've reviewed your account and the incident history. You're absolutely right — this level of disruption is unacceptable for an enterprise customer. I'd like to offer: 1) Full SLA credits for this month, 2) A dedicated status page for your account, 3) A call with our VP of Engineering to review our infrastructure roadmap. When would you be available?",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t10Base, 22),
    actor: { actor_type: "customer", actor_id: "cust_088", name: "Kevin Wright" },
    message: "I appreciate you stepping in directly, Diana. I'm available tomorrow at 2pm EST. I want to see a concrete timeline for infrastructure improvements before I make any decisions about staying.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t10Base, 25),
    actor: { actor_type: "manager", actor_id: "mgr_03", name: "Diana Patel" },
    message: "Perfect. I've scheduled the call for tomorrow at 2pm EST with myself and our VP of Engineering. You'll receive a calendar invite shortly. In the meantime, I'm applying the SLA credits to your account.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "conversation.closed",
    occurred_at: offset(t10Base, 30),
    actor: { actor_type: "system", actor_id: "system" },
    message: "Conversation closed — follow-up scheduled",
  },
];

/* ------------------------------------------------------------------ */
/*  Trace 11 — Simple FAQ: return policy                              */
/* ------------------------------------------------------------------ */

const t11Base = new Date("2026-02-03T09:30:00Z");
const t11Events: TraceEvent[] = [
  {
    event_id: eid(), source: "intercom", event_type: "conversation.started",
    occurred_at: offset(t11Base, 0),
    actor: { actor_type: "customer", actor_id: "cust_901", name: "Amy Torres" },
    message: "Customer initiated a new conversation",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t11Base, 1),
    actor: { actor_type: "customer", actor_id: "cust_901", name: "Amy Torres" },
    message: "What's your return policy? Can I return something after 30 days?",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t11Base, 3),
    actor: { actor_type: "agent", actor_id: "agent_15", name: "Tom Nakamura" },
    message: "Hi Amy! Our return policy allows returns within 30 days of delivery for a full refund. After 30 days and up to 60 days, we can offer store credit. Items must be unused and in original packaging. Is there a specific item you're looking to return?",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t11Base, 5),
    actor: { actor_type: "customer", actor_id: "cust_901", name: "Amy Torres" },
    message: "No, just checking before I buy. Thanks!",
  },
  {
    event_id: eid(), source: "intercom", event_type: "conversation.closed",
    occurred_at: offset(t11Base, 6),
    actor: { actor_type: "agent", actor_id: "agent_15", name: "Tom Nakamura" },
    message: "Conversation closed — resolved",
  },
];

/* ------------------------------------------------------------------ */
/*  Trace 12 — Partial refund negotiation                             */
/* ------------------------------------------------------------------ */

const t12Base = new Date("2026-02-08T16:00:00Z");
const t12Events: TraceEvent[] = [
  {
    event_id: eid(), source: "intercom", event_type: "conversation.started",
    occurred_at: offset(t12Base, 0),
    actor: { actor_type: "customer", actor_id: "cust_410", name: "Chris Yamamoto" },
    message: "Customer initiated a new conversation",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t12Base, 1),
    actor: { actor_type: "customer", actor_id: "cust_410", name: "Chris Yamamoto" },
    message: "I ordered a set of 4 mugs (order #ORD-6103) and 2 of them arrived cracked. I'd like a partial refund for the damaged ones.",
  },
  {
    event_id: eid(), source: "stripe", event_type: "charge.retrieved",
    occurred_at: offset(t12Base, 3),
    actor: { actor_type: "system", actor_id: "stripe_system" },
    message: "Retrieved charge ch_R5s6 for order #ORD-6103",
    payload: { charge_id: "ch_R5s6", amount: 4800, currency: "usd", items: [{ name: "Ceramic Mug Set (4)", price: 4800 }] },
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t12Base, 5),
    actor: { actor_type: "agent", actor_id: "agent_08", name: "Priya Sharma" },
    message: "I'm sorry to hear about the damaged mugs, Chris. The set was $48.00 total. I can refund $24.00 for the 2 cracked mugs. Would you also like us to send replacements?",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t12Base, 8),
    actor: { actor_type: "customer", actor_id: "cust_410", name: "Chris Yamamoto" },
    message: "Can I get the refund AND replacements? The cracked ones are totally unusable.",
  },
  {
    event_id: eid(), source: "slack", event_type: "message.sent",
    occurred_at: offset(t12Base, 11),
    actor: { actor_type: "agent", actor_id: "agent_08", name: "Priya Sharma" },
    message: "#cs-decisions: Customer Chris Yamamoto requesting partial refund ($24) + replacement for 2 cracked mugs from a $48 set. Policy says refund OR replace, not both. Should I make an exception?",
    payload: { channel: "#cs-decisions" },
  },
  {
    event_id: eid(), source: "slack", event_type: "message.received",
    occurred_at: offset(t12Base, 25),
    actor: { actor_type: "manager", actor_id: "mgr_07", name: "Jake Torres" },
    message: "Send replacements but no refund. Offer a 10% discount code for the inconvenience instead.",
    payload: { channel: "#cs-decisions" },
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t12Base, 28),
    actor: { actor_type: "agent", actor_id: "agent_08", name: "Priya Sharma" },
    message: "Chris, I've arranged to ship 2 replacement mugs to you right away at no charge. I can also offer you a 10% discount code (SORRY10) for your next order. Unfortunately we can't do both a refund and replacement per our policy, but I want to make sure you get the complete set you paid for.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t12Base, 35),
    actor: { actor_type: "customer", actor_id: "cust_410", name: "Chris Yamamoto" },
    message: "That's fair. I'll take the replacements and the discount. Thanks for sorting it out.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "conversation.closed",
    occurred_at: offset(t12Base, 38),
    actor: { actor_type: "agent", actor_id: "agent_08", name: "Priya Sharma" },
    message: "Conversation closed — resolved with replacement + discount code",
  },
];

/* ------------------------------------------------------------------ */
/*  Trace 13 — Integration setup help                                 */
/* ------------------------------------------------------------------ */

const t13Base = new Date("2026-02-06T11:15:00Z");
const t13Events: TraceEvent[] = [
  {
    event_id: eid(), source: "intercom", event_type: "conversation.started",
    occurred_at: offset(t13Base, 0),
    actor: { actor_type: "customer", actor_id: "cust_565", name: "Nicole Adams" },
    message: "Customer initiated a new conversation",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t13Base, 1),
    actor: { actor_type: "customer", actor_id: "cust_565", name: "Nicole Adams" },
    message: "I need help connecting your platform to our Slack workspace. The OAuth flow keeps timing out.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t13Base, 4),
    actor: { actor_type: "agent", actor_id: "agent_12", name: "Marcus Rivera" },
    message: "Hi Nicole! The timeout issue is usually related to network policies. Are you connecting from a corporate network that might have strict firewall rules?",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t13Base, 7),
    actor: { actor_type: "customer", actor_id: "cust_565", name: "Nicole Adams" },
    message: "Yes, we do have a corporate firewall. What domains do I need to whitelist?",
  },
  {
    event_id: eid(), source: "slack", event_type: "message.sent",
    occurred_at: offset(t13Base, 10),
    actor: { actor_type: "agent", actor_id: "agent_12", name: "Marcus Rivera" },
    message: "#integrations-help: Customer Nicole Adams needs firewall whitelist for Slack OAuth. Do we have an updated list of required domains?",
    payload: { channel: "#integrations-help" },
  },
  {
    event_id: eid(), source: "slack", event_type: "message.received",
    occurred_at: offset(t13Base, 15),
    actor: { actor_type: "agent", actor_id: "eng_02", name: "Sam Patel" },
    message: "Whitelist these: api.chronicle.ai, auth.chronicle.ai, slack.com, *.slack-edge.com. All on port 443.",
    payload: { channel: "#integrations-help" },
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t13Base, 18),
    actor: { actor_type: "agent", actor_id: "agent_12", name: "Marcus Rivera" },
    message: "Nicole, please whitelist these domains on port 443:\n• api.chronicle.ai\n• auth.chronicle.ai\n• slack.com\n• *.slack-edge.com\n\nOnce your IT team adds these, the OAuth flow should complete successfully.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "conversation.closed",
    occurred_at: offset(t13Base, 45),
    actor: { actor_type: "agent", actor_id: "agent_12", name: "Marcus Rivera" },
    message: "Conversation closed — resolved after customer confirmed connection worked",
  },
];

/* ------------------------------------------------------------------ */
/*  Trace 14 — VIP customer priority handling                         */
/* ------------------------------------------------------------------ */

const t14Base = new Date("2026-02-08T09:00:00Z");
const t14Events: TraceEvent[] = [
  {
    event_id: eid(), source: "intercom", event_type: "conversation.started",
    occurred_at: offset(t14Base, 0),
    actor: { actor_type: "customer", actor_id: "cust_001", name: "Yuki Tanaka" },
    message: "VIP customer initiated a new conversation",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t14Base, 1),
    actor: { actor_type: "customer", actor_id: "cust_001", name: "Yuki Tanaka" },
    message: "We're running our quarterly board meeting next Tuesday and the executive dashboard is showing stale data. It's stuck on last week's numbers. We need this fixed urgently — the board presentation depends on it.",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t14Base, 2),
    actor: { actor_type: "agent", actor_id: "agent_08", name: "Priya Sharma" },
    message: "Yuki, I'm flagging this as critical right now and pulling in our engineering team. We'll prioritize this immediately.",
  },
  {
    event_id: eid(), source: "slack", event_type: "message.sent",
    occurred_at: offset(t14Base, 3),
    actor: { actor_type: "agent", actor_id: "agent_08", name: "Priya Sharma" },
    message: "#vip-alerts: CRITICAL — VIP customer Yuki Tanaka (Enterprise, $50K ARR). Executive dashboard showing stale data. Board meeting next Tuesday. Need engineering attention ASAP. @engineering-oncall @Diana Patel",
    payload: { channel: "#vip-alerts", priority: "critical" },
  },
  {
    event_id: eid(), source: "slack", event_type: "message.received",
    occurred_at: offset(t14Base, 8),
    actor: { actor_type: "agent", actor_id: "eng_05", name: "Alex Okafor" },
    message: "Investigating now. The data pipeline job for enterprise dashboards failed silently on Friday. Restarting and backfilling.",
    payload: { channel: "#vip-alerts" },
  },
  {
    event_id: eid(), source: "slack", event_type: "message.received",
    occurred_at: offset(t14Base, 15),
    actor: { actor_type: "manager", actor_id: "mgr_03", name: "Diana Patel" },
    message: "Keep me posted on ETA. Also, let's set up a monitoring alert so pipeline failures don't go unnoticed again.",
    payload: { channel: "#vip-alerts" },
  },
  {
    event_id: eid(), source: "slack", event_type: "message.received",
    occurred_at: offset(t14Base, 45),
    actor: { actor_type: "agent", actor_id: "eng_05", name: "Alex Okafor" },
    message: "Pipeline backfill complete. Dashboard should show current data now. Added PagerDuty alert for pipeline failures.",
    payload: { channel: "#vip-alerts" },
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.sent",
    occurred_at: offset(t14Base, 48),
    actor: { actor_type: "agent", actor_id: "agent_08", name: "Priya Sharma" },
    message: "Yuki, the dashboard has been updated with current data. Our engineering team found a pipeline issue from Friday and resolved it. We've also added automated alerts to prevent this from happening again. Your board meeting data should be accurate now. Would you like me to verify any specific metrics?",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t14Base, 55),
    actor: { actor_type: "customer", actor_id: "cust_001", name: "Yuki Tanaka" },
    message: "I can see the updated numbers now. Everything looks correct for the board deck. Thank you for the fast turnaround.",
  },
  {
    event_id: eid(), source: "stripe", event_type: "invoice.payment_succeeded",
    occurred_at: offset(t14Base, 60),
    actor: { actor_type: "system", actor_id: "stripe_system" },
    message: "Invoice inv_Y8z9 paid — Enterprise annual renewal",
    payload: { invoice_id: "inv_Y8z9", amount: 5000000, customer: "cus_001", description: "Enterprise Plan - Annual" },
  },
  {
    event_id: eid(), source: "intercom", event_type: "conversation.closed",
    occurred_at: offset(t14Base, 65),
    actor: { actor_type: "agent", actor_id: "agent_08", name: "Priya Sharma" },
    message: "Conversation closed — resolved, VIP retained",
  },
];

/* ------------------------------------------------------------------ */
/*  Trace 15 — Abandoned conversation                                 */
/* ------------------------------------------------------------------ */

const t15Base = new Date("2026-02-09T07:20:00Z");
const t15Events: TraceEvent[] = [
  {
    event_id: eid(), source: "intercom", event_type: "conversation.started",
    occurred_at: offset(t15Base, 0),
    actor: { actor_type: "customer", actor_id: "cust_999", name: "Unknown User" },
    message: "Customer initiated a new conversation",
  },
  {
    event_id: eid(), source: "intercom", event_type: "message.received",
    occurred_at: offset(t15Base, 1),
    actor: { actor_type: "customer", actor_id: "cust_999", name: "Unknown User" },
    message: "hello",
  },
];


/* ================================================================== */
/*  Assemble all traces                                                */
/* ================================================================== */

function buildTrace(
  id: string,
  conversationId: string,
  events: TraceEvent[],
  status: Trace["status"],
  autoAudit: AutoActionAudit | null,
  confidence: number | null,
  humanAudit?: HumanActionAudit | null,
): Trace {
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );
  const sources = [...new Set(sorted.map((e) => e.source))];
  return {
    id,
    tenantId: TENANT,
    conversationId,
    status,
    events: sorted,
    eventCount: sorted.length,
    sources,
    firstEventAt: sorted[0].occurred_at,
    lastEventAt: sorted[sorted.length - 1].occurred_at,
    autoAudit,
    confidence,
    humanAudit: humanAudit ?? null,
    reviewedBy: humanAudit ? "agent_08" : null,
    reviewedAt: humanAudit ? new Date().toISOString() : null,
    createdAt: sorted[0].occurred_at,
    updatedAt: new Date().toISOString(),
  };
}

export const MOCK_TRACES: Trace[] = [
  /* Trace 1 — Wrong item return (low confidence) */
  buildTrace(uid(), "conv_wrongitem_4582", t1Events, "auto_labeled", {
    action_annotations: [
      { event_id: t1Events[2].event_id, verdict: "correct", reasoning: "Acknowledged the issue promptly and empathetically" },
      { event_id: t1Events[3].event_id, verdict: "correct", reasoning: "Retrieved order details to verify the claim" },
      { event_id: t1Events[4].event_id, verdict: "partial", reasoning: "Offered return but didn't apologize for inconvenience or offer expedited reship upfront", should_have_done: "Should have offered expedited replacement shipment immediately without waiting for manager approval since this was clearly a company error" },
      { event_id: t1Events[6].event_id, verdict: "correct", reasoning: "Properly escalated to manager for return approval" },
      { event_id: t1Events[8].event_id, verdict: "correct", reasoning: "Refund processed correctly" },
      { event_id: t1Events[9].event_id, verdict: "correct", reasoning: "Communicated resolution clearly with all details including expedited shipping" },
    ],
    overall_score: 3,
    critical_errors: ["Should have offered expedited reship immediately without waiting for manager prompt"],
    correction_summary: "Agent handled the return well but delayed offering expedited replacement. For a wrong-item error caused by the company, the agent should proactively offer expedited replacement shipping without requiring manager escalation.",
    summary: "Customer received wrong item. Agent coordinated return with manager approval, issued refund, and arranged correct item reship with expedited shipping.",
    confidence: 0.34,
  }, 0.34),

  /* Trace 2 — Billing double charge */
  buildTrace(uid(), "conv_doublecharge_445", t2Events, "auto_labeled", {
    action_annotations: [
      { event_id: t2Events[2].event_id, verdict: "correct", reasoning: "Verified duplicate charges efficiently" },
      { event_id: t2Events[3].event_id, verdict: "correct", reasoning: "Quickly confirmed the duplicate and initiated refund" },
      { event_id: t2Events[4].event_id, verdict: "correct", reasoning: "Refund executed properly" },
      { event_id: t2Events[5].event_id, verdict: "partial", reasoning: "Confirmed refund but should have investigated root cause of duplicate billing", should_have_done: "Should have flagged the duplicate charge pattern to the billing/engineering team to prevent recurrence for other customers" },
    ],
    overall_score: 4,
    critical_errors: ["Failed to investigate or report the root cause of duplicate billing"],
    correction_summary: "Agent resolved the immediate issue quickly but missed the opportunity to investigate why the duplicate charge occurred, which could affect other customers.",
    summary: "Customer reported duplicate subscription charge. Agent confirmed and issued immediate refund for the duplicate.",
    confidence: 0.51,
  }, 0.51),

  /* Trace 3 — Dark mode feature request (high confidence) */
  buildTrace(uid(), "conv_darkmode_112", t3Events, "auto_labeled", {
    action_annotations: [
      { event_id: t3Events[2].event_id, verdict: "correct", reasoning: "Provided roadmap timeline, logged the feature vote, and offered a helpful interim workaround" },
    ],
    overall_score: 5,
    critical_errors: [],
    correction_summary: "Agent handled the feature request perfectly — acknowledged the request, provided timeline, and offered interim solution.",
    summary: "Customer requested dark mode. Agent informed about Q2 roadmap and suggested browser extension workaround.",
    confidence: 0.89,
  }, 0.89),

  /* Trace 4 — Checkout bug (very low confidence) */
  buildTrace(uid(), "conv_checkoutbug_678", t4Events, "auto_labeled", {
    action_annotations: [
      { event_id: t4Events[2].event_id, verdict: "partial", reasoning: "Good empathy but asked customer for cart details instead of looking them up in the system", should_have_done: "Should have looked up the customer's cart/session data directly rather than asking the customer to describe it" },
      { event_id: t4Events[4].event_id, verdict: "correct", reasoning: "Excellent bug report to engineering with all relevant details" },
      { event_id: t4Events[6].event_id, verdict: "correct", reasoning: "System fix deployed via proper PR process" },
      { event_id: t4Events[8].event_id, verdict: "correct", reasoning: "Good resolution communication with extra compensation for inconvenience" },
    ],
    overall_score: 4,
    critical_errors: ["Asked customer for cart details instead of retrieving them from the system"],
    correction_summary: "Agent provided excellent escalation to engineering but created unnecessary friction by asking the customer to describe their cart contents when this data was available in the system.",
    summary: "Customer reported checkout crash with promo code. Agent escalated to engineering, hotfix deployed within an hour. Customer received extra discount.",
    confidence: 0.28,
  }, 0.28),

  /* Trace 5 — Onboarding API setup */
  buildTrace(uid(), "conv_onboarding_830", t5Events, "auto_labeled", {
    action_annotations: [
      { event_id: t5Events[2].event_id, verdict: "correct", reasoning: "Clear step-by-step guidance for API key generation" },
      { event_id: t5Events[4].event_id, verdict: "correct", reasoning: "Properly sought platform team help for domain whitelist issue" },
      { event_id: t5Events[6].event_id, verdict: "correct", reasoning: "Communicated resolution and asked customer to retry" },
    ],
    overall_score: 4,
    critical_errors: [],
    correction_summary: "Agent handled the onboarding issue well. Could have proactively provided domain whitelist information upfront since corporate firewall issues are a common pattern for developer plan customers.",
    summary: "New developer plan customer needed help with API setup. Webhook registration failed due to domain whitelist. Platform team resolved and customer confirmed working setup.",
    confidence: 0.73,
  }, 0.73),

  /* Trace 6 — Refund escalation (very low confidence) */
  buildTrace(uid(), "conv_refund_esc_192", t6Events, "auto_labeled", {
    action_annotations: [
      { event_id: t6Events[2].event_id, verdict: "correct", reasoning: "Empathized appropriately with the customer's frustration" },
      { event_id: t6Events[3].event_id, verdict: "correct", reasoning: "Retrieved subscription details to assess the situation" },
      { event_id: t6Events[4].event_id, verdict: "incorrect", reasoning: "Offered prorated refund first instead of directly escalating for a frustrated customer with a legitimate complaint about documented product failures", should_have_done: "Should have immediately escalated the full refund request given the documented analytics outages affecting this customer for 3 months" },
      { event_id: t6Events[6].event_id, verdict: "correct", reasoning: "Escalation to manager with full context" },
      { event_id: t6Events[8].event_id, verdict: "correct", reasoning: "Refund processed correctly" },
      { event_id: t6Events[9].event_id, verdict: "partial", reasoning: "Communicated refund and retention offer but didn't include specific timeline for analytics fix", should_have_done: "Should have provided a concrete timeline or link to status page for the analytics dashboard fix" },
    ],
    overall_score: 2,
    critical_errors: [
      "Delayed escalation by offering prorated refund first to a customer with legitimate grievance about 3 months of broken analytics",
      "No concrete timeline given for product fix in retention offer",
    ],
    correction_summary: "Agent should have recognized the customer's complaint about broken analytics warranted immediate full refund escalation rather than a partial refund offer. The retention offer was good but lacked specific commitments about when the product would be fixed.",
    summary: "Frustrated customer demanded full annual subscription refund due to repeated analytics dashboard issues. Escalated to manager who approved full refund plus retention offer.",
    confidence: 0.22,
  }, 0.22),

  /* Trace 7 — Account lockout (high confidence, already labeled) */
  buildTrace(uid(), "conv_lockout_503", t7Events, "labeled", {
    action_annotations: [
      { event_id: t7Events[2].event_id, verdict: "correct", reasoning: "Quick diagnosis of account lockout and immediate resolution with password reset" },
    ],
    overall_score: 5,
    critical_errors: [],
    correction_summary: "Perfect handling of a straightforward account lockout issue.",
    summary: "Customer locked out after failed login attempts. Agent unlocked account and sent password reset.",
    confidence: 0.91,
  }, 0.91, {
    action_annotations: [
      { event_id: t7Events[2].event_id, verdict: "correct", reasoning: "Textbook account recovery — quick, efficient, and clear" },
    ],
    overall_score: 5,
    critical_errors: [],
    correction_summary: "Textbook account recovery — quick, efficient, and clear.",
    notes: "No issues found. Agent handled this perfectly.",
  }),

  /* Trace 8 — Shipping delay */
  buildTrace(uid(), "conv_shipping_771", t8Events, "auto_labeled", {
    action_annotations: [
      { event_id: t8Events[2].event_id, verdict: "correct", reasoning: "Empathized with the time-sensitive birthday gift situation" },
      { event_id: t8Events[3].event_id, verdict: "correct", reasoning: "Retrieved charge details to verify order" },
      { event_id: t8Events[4].event_id, verdict: "correct", reasoning: "Proactively offered replacement with express shipping" },
      { event_id: t8Events[6].event_id, verdict: "partial", reasoning: "Good resolution but 15% next-order discount may be insufficient for a missed birthday gift", should_have_done: "Should have offered a larger immediate discount or free expedited shipping on future orders given the emotional impact of a missed birthday gift" },
    ],
    overall_score: 4,
    critical_errors: ["Compensation insufficient for emotional impact of missed birthday gift"],
    correction_summary: "Agent handled the shipping delay well with good empathy and proactive replacement, but the compensation (15% future discount) didn't fully match the emotional impact of a missed birthday gift.",
    summary: "Customer's birthday gift was delayed with no tracking updates. Agent arranged replacement with overnight shipping and applied 15% next-order discount.",
    confidence: 0.45,
  }, 0.45),

  /* Trace 9 — Subscription upgrade (high confidence, already labeled) */
  buildTrace(uid(), "conv_upgrade_320", t9Events, "labeled", {
    action_annotations: [
      { event_id: t9Events[2].event_id, verdict: "correct", reasoning: "Clear explanation of proration billing" },
      { event_id: t9Events[3].event_id, verdict: "correct", reasoning: "Subscription upgraded successfully" },
    ],
    overall_score: 5,
    critical_errors: [],
    correction_summary: "Clean and efficient subscription upgrade process.",
    summary: "Customer inquired about mid-cycle plan upgrade. Agent explained proration and processed the upgrade.",
    confidence: 0.82,
  }, 0.82, {
    action_annotations: [
      { event_id: t9Events[2].event_id, verdict: "correct", reasoning: "Clear, accurate explanation of proration" },
      { event_id: t9Events[3].event_id, verdict: "correct", reasoning: "System processed upgrade correctly" },
    ],
    overall_score: 5,
    critical_errors: [],
    correction_summary: "Agent handled upgrade smoothly. Could have mentioned new Pro features to increase engagement.",
    notes: "Perfect upgrade handling. Minor suggestion: highlight new Pro features to drive adoption.",
  }),

  /* Trace 10 — Angry enterprise customer (very low confidence) */
  buildTrace(uid(), "conv_angry_088", t10Events, "auto_labeled", {
    action_annotations: [
      { event_id: t10Events[2].event_id, verdict: "incorrect", reasoning: "Generic empathy response that didn't acknowledge the specific business impact or revenue losses the customer described", should_have_done: "Should have explicitly acknowledged the revenue loss and business impact, then immediately offered to connect with a senior leader" },
      { event_id: t10Events[3].event_id, verdict: "correct", reasoning: "Good urgent escalation with full context and appropriate urgency tags" },
      { event_id: t10Events[6].event_id, verdict: "correct", reasoning: "Excellent senior response with concrete action plan and SLA credits" },
      { event_id: t10Events[8].event_id, verdict: "correct", reasoning: "Properly scheduled follow-up with appropriate stakeholders" },
    ],
    overall_score: 2,
    critical_errors: [
      "Initial agent response was generic and failed to acknowledge specific business impact",
      "Agent should have immediately transferred to a senior leader rather than making the customer ask",
    ],
    correction_summary: "The initial agent response was inadequate for an enterprise customer threatening churn. The agent used a generic empathy template rather than acknowledging the specific business impact. The customer had to ask to speak with someone senior, which should have been offered immediately.",
    summary: "Enterprise customer threatening churn after 3rd service outage this month. Escalated to Head of Customer Success. SLA credits applied, engineering call scheduled.",
    confidence: 0.19,
  }, 0.19),

  /* Trace 11 — FAQ return policy (high confidence, already labeled) */
  buildTrace(uid(), "conv_faq_901", t11Events, "labeled", {
    action_annotations: [
      { event_id: t11Events[2].event_id, verdict: "correct", reasoning: "Comprehensive return policy answer with both 30-day and 60-day windows explained" },
    ],
    overall_score: 5,
    critical_errors: [],
    correction_summary: "Simple FAQ answered thoroughly and correctly.",
    summary: "Customer asked about return policy before purchasing. Agent provided policy details.",
    confidence: 0.95,
  }, 0.95, {
    action_annotations: [
      { event_id: t11Events[2].event_id, verdict: "correct", reasoning: "Clear, complete policy explanation" },
    ],
    overall_score: 5,
    critical_errors: [],
    correction_summary: "Perfect FAQ response — thorough and proactive in asking if the customer had a specific item.",
    notes: "No issues. Textbook FAQ handling.",
  }),

  /* Trace 12 — Cracked mugs partial refund (in review) */
  buildTrace(uid(), "conv_cracked_410", t12Events, "in_review", {
    action_annotations: [
      { event_id: t12Events[2].event_id, verdict: "correct", reasoning: "Retrieved charge details to verify order" },
      { event_id: t12Events[3].event_id, verdict: "partial", reasoning: "Offered either refund or replacement but should have been more flexible given the product quality issue was the company's fault", should_have_done: "Should have proactively offered both replacement AND a discount code without needing manager approval for a $24 claim" },
      { event_id: t12Events[5].event_id, verdict: "unnecessary", reasoning: "Escalated to manager for a routine $24 damaged goods claim that should be within agent authority", should_have_done: "Agent should have authority to handle damaged goods replacement + small discount without escalation for claims under $50" },
      { event_id: t12Events[7].event_id, verdict: "correct", reasoning: "Clearly communicated the resolution with discount code and reasoning" },
    ],
    overall_score: 3,
    critical_errors: [
      "Unnecessary escalation for a routine damaged goods claim",
      "Policy-first approach rather than customer-first approach for a product quality issue",
    ],
    correction_summary: "Agent should have had authority to handle a $24 damaged goods claim without manager escalation. The policy-focused response feels rigid for a product quality issue that was the company's fault.",
    summary: "Customer received 2 cracked mugs from a 4-piece set. Requested refund + replacement but policy allows only one. Manager decided on replacement + 10% discount code.",
    confidence: 0.38,
  }, 0.38),

  /* Trace 13 — Slack integration setup */
  buildTrace(uid(), "conv_slack_565", t13Events, "auto_labeled", {
    action_annotations: [
      { event_id: t13Events[2].event_id, verdict: "correct", reasoning: "Good diagnostic question about corporate firewall" },
      { event_id: t13Events[4].event_id, verdict: "correct", reasoning: "Properly sought engineering help for whitelist requirements" },
      { event_id: t13Events[6].event_id, verdict: "correct", reasoning: "Clear and complete whitelist instructions with port numbers" },
    ],
    overall_score: 4,
    critical_errors: [],
    correction_summary: "Solid handling of integration issue. Could improve by having domain whitelist info readily available in knowledge base rather than asking engineering each time.",
    summary: "Customer had Slack OAuth timeout due to corporate firewall. Agent obtained whitelist domains from engineering and customer confirmed successful connection.",
    confidence: 0.67,
  }, 0.67),

  /* Trace 14 — VIP customer dashboard issue (low confidence) */
  buildTrace(uid(), "conv_vip_001", t14Events, "auto_labeled", {
    action_annotations: [
      { event_id: t14Events[2].event_id, verdict: "correct", reasoning: "Immediate critical prioritization for VIP customer" },
      { event_id: t14Events[3].event_id, verdict: "correct", reasoning: "Excellent urgent escalation with business context including ARR" },
      { event_id: t14Events[7].event_id, verdict: "partial", reasoning: "Good resolution communication but didn't offer follow-up check or dedicated point of contact before the board meeting", should_have_done: "Should have offered to personally verify board meeting data and provided a direct contact for any last-minute issues before Tuesday" },
    ],
    overall_score: 4,
    critical_errors: ["No proactive follow-up offered before critical board meeting"],
    correction_summary: "Agent handled the urgency well with quick escalation, but for a $50K ARR VIP customer with a time-sensitive board meeting, should have offered personal data verification and a direct contact line for pre-meeting support.",
    summary: "VIP enterprise customer reported stale executive dashboard data before board meeting. Engineering found silent pipeline failure, backfilled data, and added monitoring alerts.",
    confidence: 0.41,
  }, 0.41),

  /* Trace 15 — Abandoned conversation (very low confidence) */
  buildTrace(uid(), "conv_abandoned_999", t15Events, "pending", {
    action_annotations: [],
    overall_score: 1,
    critical_errors: ["No agent response to customer greeting — potential SLA violation"],
    correction_summary: "Customer greeting received no response. If this was within business hours, this represents a service failure. An automated acknowledgment should have been sent within 60 seconds.",
    summary: "Customer sent a single greeting message with no follow-up or agent response. Likely abandoned or SLA breach.",
    confidence: 0.15,
  }, 0.15),
];
