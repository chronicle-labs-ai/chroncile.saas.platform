"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Eyebrow } from "../primitives/eyebrow";
import { ArrowLeftIcon, ArrowRightIcon, LockIcon } from "../icons/glyphs";
import {
  AuthDisplay,
  AuthLede,
  SelectableCard,
  StepFoot,
} from "../auth/_internal";
import { cx } from "../utils/cx";

/*
 * StepBilling — fifth onboarding step. Three plan cards
 * (Sandbox / Team / Scale) with a conditional billing form
 * (card details for Team, contact-sales prompt for Scale).
 *
 * Card brand glyph + Stripe lock-icon notice ported verbatim
 * from the source. Card number / expiry / CVC are formatted as
 * the user types.
 */

export type PlanId = "free" | "team" | "scale";

export interface BillingState {
  plan: PlanId;
  card: {
    num: string;
    exp: string;
    cvc: string;
    name: string;
  };
  billingEmail: string;
  /** True when the user came in via the sandbox off-ramp — biases plan default to "free". */
  sandbox?: boolean;
}

export interface StepBillingProps {
  value: BillingState;
  onChange: (next: BillingState) => void;
  onNext?: () => void;
  onBack?: () => void;
}

const PLANS: {
  id: PlanId;
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  limits: string[];
  badge?: string | null;
}[] = [
  {
    id: "free",
    name: "Sandbox",
    price: "$0",
    cadence: "free forever",
    blurb: "For prototypes and side projects.",
    limits: ["10K events / month", "1 source connector", "7-day retention"],
  },
  {
    id: "team",
    name: "Team",
    price: "$49",
    cadence: "per workspace · monthly",
    blurb: "For real agents with real traffic.",
    limits: [
      "1M events / month",
      "Unlimited sources",
      "90-day retention",
      "Backfill up to 1y",
    ],
    badge: "Most teams start here",
  },
  {
    id: "scale",
    name: "Scale",
    price: "Custom",
    cadence: "annual",
    blurb: "Throughput, retention, SOC 2.",
    limits: [
      "10M+ events / month",
      "Custom retention",
      "VPC peering",
      "Priority support",
    ],
  },
];

const formatCardNum = (v: string) => {
  const digits = v.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
};
const formatExp = (v: string) => {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  if (digits.length < 3) return digits;
  return digits.slice(0, 2) + "/" + digits.slice(2);
};

/**
 * Onboarding step 05 — three-tier plan picker (Sandbox / Team /
 * Scale) with a conditional billing form (card details for Team,
 * contact-sales prompt for Scale).
 */
export function StepBilling({
  value,
  onChange,
  onNext,
  onBack,
}: StepBillingProps) {
  const card = value.card;
  const setCard = (next: Partial<BillingState["card"]>) =>
    onChange({ ...value, card: { ...card, ...next } });

  const cardComplete =
    card.num.replace(/\s/g, "").length >= 15 &&
    /\d{2}\/\d{2}/.test(card.exp) &&
    card.cvc.length >= 3 &&
    card.name.trim().length > 0;

  const needsCard = value.plan === "team";
  const isContact = value.plan === "scale";
  const canContinue =
    value.plan === "free" || (needsCard && cardComplete) || isContact;

  return (
    <div className="flex flex-col">
      <Eyebrow>Step 05</Eyebrow>
      <AuthDisplay>Pick a <em>plan</em>.</AuthDisplay>
      <AuthLede>
        {value.sandbox
          ? "Sandbox is free forever. Upgrade later when you connect real data."
          : "Start free, upgrade when your traffic warrants it. Cancel any time."}
      </AuthLede>

      {/* Plan cards */}
      <div className="cg-fade-up cg-fade-up-2 mt-s-8 grid grid-cols-3 gap-s-3">
        {PLANS.map((p) => {
          const active = value.plan === p.id;
          return (
            <SelectableCard
              key={p.id}
              active={active}
              padding="lg"
              layout="relaxed"
              onClick={() => onChange({ ...value, plan: p.id })}
              className="relative"
            >
              {p.badge ? (
                <span className="absolute -top-[7px] left-s-3 inline-flex items-center rounded-xs bg-ember px-[7px] py-[2px] font-mono text-mono-sm uppercase tracking-tactical text-white">
                  {p.badge}
                </span>
              ) : null}
              <span className="font-mono text-mono uppercase tracking-tactical text-ink-dim">
                {p.name}
              </span>
              <div className="flex items-baseline gap-[6px]">
                <span className="font-display text-display-sm font-medium tracking-tight text-ink-hi">
                  {p.price}
                </span>
                <span className="font-mono text-mono-sm text-ink-dim">
                  {p.cadence}
                </span>
              </div>
              <p className="font-sans text-[13px] font-light leading-[1.45] text-ink-lo">
                {p.blurb}
              </p>
              <ul className="m-0 mt-s-1 flex list-none flex-col gap-[6px] p-0">
                {p.limits.map((l) => (
                  <li
                    key={l}
                    className="flex items-start gap-s-2 font-sans text-[12.5px] text-ink-lo"
                  >
                    <span className="mt-[1px] text-ember">—</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </SelectableCard>
          );
        })}
      </div>

      {/* Conditional billing form */}
      <div className="cg-fade-up cg-fade-up-3 mt-s-6">
        {value.plan === "free" ? (
          <div className="rounded-sm border border-dashed border-hairline-strong px-s-3 py-s-3 font-sans text-[13px] font-light leading-[1.5] text-ink-lo">
            No card needed. We&rsquo;ll email you when you approach the 10K event limit.
          </div>
        ) : null}

        {value.plan === "team" ? (
          <div className="flex flex-col gap-s-3 rounded-sm border border-hairline bg-surface-01 px-s-4 py-s-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-mono uppercase tracking-tactical text-ink-dim">
                Payment method
              </span>
              <span className="inline-flex items-center gap-[6px] font-mono text-mono-sm text-ink-dim">
                <LockIcon size={11} /> Encrypted via Stripe
              </span>
            </div>

            <CardField
              label="Card number"
              value={card.num}
              placeholder="4242 4242 4242 4242"
              onChange={(v) => setCard({ num: formatCardNum(v) })}
              right={<CardBrandGlyph num={card.num} />}
            />
            <div className="grid grid-cols-2 gap-s-2">
              <CardField
                label="Expiry"
                value={card.exp}
                placeholder="MM/YY"
                onChange={(v) => setCard({ exp: formatExp(v) })}
              />
              <CardField
                label="CVC"
                value={card.cvc}
                placeholder="•••"
                onChange={(v) =>
                  setCard({ cvc: v.replace(/\D/g, "").slice(0, 4) })
                }
              />
            </div>
            <CardField
              label="Name on card"
              value={card.name}
              placeholder="Ada Lovelace"
              onChange={(v) => setCard({ name: v })}
            />
            <CardField
              label="Billing email"
              value={value.billingEmail}
              placeholder="billing@yourcompany.com"
              onChange={(v) => onChange({ ...value, billingEmail: v })}
              hint="Receipts and invoices go here."
            />
          </div>
        ) : null}

        {value.plan === "scale" ? (
          <div className="flex flex-col gap-s-3 rounded-sm border border-hairline bg-surface-01 px-s-4 py-s-4">
            <div className="font-display text-title-sm font-medium tracking-tight text-ink-hi">
              Talk to us
            </div>
            <p className="font-sans text-[13.5px] font-light leading-[1.55] text-ink-lo">
              Scale is configured per-workspace. We&rsquo;ll set up a 20-minute call
              to size your throughput, retention, and compliance needs.
            </p>
            <CardField
              label="Work email"
              value={value.billingEmail}
              placeholder="you@yourcompany.com"
              onChange={(v) => onChange({ ...value, billingEmail: v })}
            />
          </div>
        ) : null}
      </div>

      <StepFoot
        back={
          <Button
            density="brand"
            variant="ghost"
            onPress={onBack}
            leadingIcon={<ArrowLeftIcon />}
          >
            Back
          </Button>
        }
        next={
          <Button
            density="brand"
            variant="ember"
            onPress={onNext}
            isDisabled={!canContinue}
            trailingIcon={<ArrowRightIcon />}
          >
            {value.plan === "scale"
              ? "Request a call"
              : value.plan === "free"
                ? "Continue with sandbox"
                : "Confirm & continue"}
          </Button>
        }
      />
    </div>
  );
}

function CardField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  right,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  const [focused, setFocused] = React.useState(false);
  return (
    <label className="flex flex-col gap-[6px]">
      <span className="font-mono text-mono uppercase tracking-tactical text-ink-dim">
        {label}
      </span>
      <div
        className={cx(
          "flex items-center gap-s-2 rounded-sm border bg-surface-02 px-s-3 py-s-2 transition-colors duration-fast",
          focused ? "border-hairline-strong" : "border-hairline",
        )}
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="flex-1 bg-transparent font-mono text-mono-lg text-ink-hi outline-none placeholder:text-ink-faint"
        />
        {right}
      </div>
      {hint ? (
        <span className="font-mono text-mono-sm text-ink-dim">{hint}</span>
      ) : null}
    </label>
  );
}

function CardBrandGlyph({ num }: { num: string }) {
  const digits = (num || "").replace(/\D/g, "");
  const brand = digits.startsWith("4")
    ? "visa"
    : /^(5[1-5]|2[2-7])/.test(digits)
      ? "mc"
      : /^3[47]/.test(digits)
        ? "amex"
        : null;
  if (!brand) {
    return (
      <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
        VISA · MC · AMEX
      </span>
    );
  }
  const label = { visa: "VISA", mc: "MC", amex: "AMEX" }[brand];
  const tint = { visa: "#1a1f71", mc: "#eb5e1d", amex: "#0078a9" }[brand];
  return (
    <span
      className="rounded-xs px-[7px] py-[3px] font-mono text-mono-sm tracking-tactical text-white"
      style={{ background: tint }}
    >
      {label}
    </span>
  );
}
