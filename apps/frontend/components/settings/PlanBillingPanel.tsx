"use client";

import { useState, useRef } from "react";
import { createCheckoutSession, createPortalSession } from "@/app/(dashboard)/dashboard/settings/billing-actions";
import type { Plan } from "@/lib/plans";

interface PlanBillingPanelProps {
  plans: Plan[];
  currentPlanId: string | null;
  hasCustomer: boolean;
  successMessage: boolean;
}

const RECOMMENDED_PLAN_ID = "pro";

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function PlanBillingPanel({ plans, currentPlanId, hasCustomer, successMessage }: PlanBillingPanelProps) {
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectingPlan, setRedirectingPlan] = useState<Plan | null>(null);
  const redirectingRef = useRef(false);

  const handleSubscribe = async (plan: Plan) => {
    setError(null);
    setLoadingPlanId(plan.id);
    redirectingRef.current = false;
    try {
      const result = await createCheckoutSession(plan.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.url) {
        redirectingRef.current = true;
        setRedirectingPlan(plan);
        setTimeout(() => {
          window.location.href = result.url!;
        }, 1800);
      }
    } finally {
      if (!redirectingRef.current) setLoadingPlanId(null);
    }
  };

  const handleManageBilling = async () => {
    setError(null);
    setPortalLoading(true);
    try {
      const result = await createPortalSession();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.url) window.location.href = result.url;
    } finally {
      setPortalLoading(false);
    }
  };

  const currentPlan = currentPlanId ? plans.find((p) => p.id === currentPlanId) : null;

  return (
    <div className="space-y-6">
      {/* Success banner */}
      {successMessage && (
        <div className="panel border-nominal-dim">
          <div className="flex items-center gap-3 px-4 py-3 bg-nominal-bg border-b border-nominal-dim">
            <div className="status-dot status-dot--nominal" />
            <span className="text-sm font-medium text-nominal">Your subscription was updated successfully.</span>
          </div>
        </div>
      )}

      {/* Block 1: Current plan status */}
      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Current plan</span>
          {currentPlan ? (
            <span className="badge badge--nominal">{currentPlan.name}</span>
          ) : (
            <span className="badge badge--neutral">No plan</span>
          )}
        </div>
        <div className="p-4 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-secondary">
            {currentPlan ? currentPlan.name : "No active subscription"}
          </p>
          {hasCustomer && (
            <button
              type="button"
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="btn btn--ghost btn--sm"
            >
              {portalLoading ? "..." : "Manage billing"}
            </button>
          )}
        </div>
      </div>

      {/* Block 2: Choose a plan */}
      <div>
        <div className="text-xs text-tertiary tracking-wide uppercase mb-3">Choose a plan</div>
        {error && (
          <div className="mb-4 px-4 py-2 rounded-[var(--radius-sm)] bg-critical-bg border border-critical-dim">
            <p className="text-sm text-critical">{error}</p>
          </div>
        )}
        {redirectingPlan && (
          <div className="mb-4 px-4 py-3 rounded-[var(--radius-sm)] bg-data-bg border border-data-dim">
            <p className="text-sm text-data">
              {redirectingPlan.name} — {formatPrice(redirectingPlan.amountCents, redirectingPlan.currency)}/
              {redirectingPlan.interval}. Redirecting to secure checkout…
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = currentPlanId === plan.id && hasCustomer;
            const isRecommended = plan.id === RECOMMENDED_PLAN_ID;
            const isLoading = loadingPlanId === plan.id;

            return (
              <div
                key={plan.id}
                className={`panel flex flex-col ${isRecommended ? "border-data/40" : ""}`}
              >
                <div className="panel__header">
                  <span className="panel__title">{plan.name}</span>
                  {isRecommended && <span className="badge badge--data">Recommended</span>}
                  {!isRecommended && isCurrent && <span className="badge badge--nominal">Current</span>}
                </div>
                <div className="panel__content flex-1 flex flex-col">
                  <div className="metric mb-3">
                    <div className="metric__value metric__value--data">
                      {formatPrice(plan.amountCents, plan.currency)}
                    </div>
                    <div className="metric__label">per {plan.interval}</div>
                  </div>
                  <p className="text-xs text-tertiary mb-4">{plan.description}</p>
                  <ul className="space-y-1.5 text-xs text-tertiary mb-6 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-data mt-0.5">·</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => handleSubscribe(plan)}
                    disabled={loadingPlanId !== null || isCurrent}
                    className={`btn text-sm w-full mt-auto ${isRecommended && !isCurrent ? "btn--primary" : "btn--secondary"}`}
                  >
                    {isLoading
                      ? "Redirecting…"
                      : isCurrent
                        ? "Current plan"
                        : "Subscribe"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
