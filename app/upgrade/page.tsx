'use client';

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useStore } from "@/lib/store";
import { PLANS, TIER_LABELS } from "@/lib/pricing";
import type { SubscriptionTier } from "@/types";
import AppHeader from "@/components/AppHeader";
import { ContourLines, Icon, Spinner } from "@/components/brand";

interface BillingStatus {
  status: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function UpgradePageContent() {
  const { tier: currentTier } = useStore();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState<SubscriptionTier | null>(null);
  const [resuming, setResuming] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBillingStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/stripe/subscription");
      if (res.ok) setBillingStatus(await res.json());
    } catch {
      // leave stale/empty on failure
    }
  }, []);

  useEffect(() => {
    refreshBillingStatus();
  }, [refreshBillingStatus]);

  // After returning from the Billing Portal, Clerk's cached publicMetadata may be
  // stale — the webhook already updated it server-side (e.g. a payment method change
  // triggering a status update). A completed Checkout redirects straight to the
  // dashboard instead, so there's no "checkout=success" case to handle here.
  useEffect(() => {
    const portal = searchParams.get("portal");
    const checkout = searchParams.get("checkout");
    if (portal === "return") {
      user?.reload().then(() => refreshBillingStatus());
      router.replace("/upgrade");
    } else if (checkout === "cancelled") {
      router.replace("/upgrade");
    }
  }, [searchParams, user, router, refreshBillingStatus]);

  const handleSelect = async (tierId: SubscriptionTier) => {
    if (tierId === currentTier && !(tierId === "free" && billingStatus?.cancelAtPeriodEnd)) return;
    setLoading(tierId);
    setError(null);
    try {
      if (tierId === "free") {
        const periodEnd = billingStatus?.currentPeriodEnd ? formatDate(billingStatus.currentPeriodEnd) : "the end of your billing period";
        const confirmed = window.confirm(
          `Your plan will switch to Free on ${periodEnd}. You'll keep your ${TIER_LABELS[currentTier]} features until then. Continue?`
        );
        if (!confirmed) {
          setLoading(null);
          return;
        }
        const res = await fetch("/api/stripe/subscription", { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to schedule downgrade");
        await refreshBillingStatus();
      } else if (currentTier === "free") {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier: tierId }),
        });
        if (!res.ok) throw new Error("Failed to start checkout");
        const data = await res.json();
        window.location.href = data.url;
        return;
      } else {
        const res = await fetch("/api/stripe/subscription", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier: tierId }),
        });
        if (!res.ok) throw new Error("Failed to switch plan");
        await user?.reload();
        router.push("/dashboard");
        return;
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const handleResume = async () => {
    setResuming(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/subscription", { method: "PUT" });
      if (!res.ok) throw new Error("Failed to resume plan");
      await refreshBillingStatus();
    } catch {
      setError("Could not resume your plan. Please try again.");
    } finally {
      setResuming(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (!res.ok) throw new Error("Failed to open billing portal");
      const data = await res.json();
      window.location.href = data.url;
    } catch {
      setError("Could not open the billing portal. Please try again.");
      setPortalLoading(false);
    }
  };

  const currentTierLabel = TIER_LABELS[currentTier];

  return (
    <div className="min-h-screen bg-cream-2">
      <AppHeader back={{ href: "/dashboard", label: "Back to dashboard" }} width="max-w-5xl" />

      {/* Header band */}
      <div className="relative overflow-hidden border-b border-paper-line bg-cream px-4 py-10 text-center sm:py-12">
        <ContourLines className="text-forest-700 opacity-[0.1]" />
        <div className="relative mx-auto max-w-xl">
          <span className="eyebrow inline-block rounded-full bg-rust-100 px-3.5 py-1.5">
            Currently on the {currentTierLabel} plan
          </span>
          <h1 className="mb-3 mt-5 text-3xl font-bold text-ink sm:text-4xl">Manage your plan</h1>
          <p className="mx-auto max-w-lg text-sm leading-relaxed text-ink-soft">
            Switching between paid plans applies right away with a prorated charge. Downgrading to Free takes
            effect at the end of your current billing period, and your land data always carries over.
          </p>
          {currentTier !== "free" && (
            <button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="btn-outline mt-5 !px-5 !py-2.5 !text-sm"
            >
              {portalLoading ? <><Spinner /> Opening billing…</> : "Manage billing & invoices"}
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        {billingStatus?.cancelAtPeriodEnd && (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-r-xl border border-l-[3px] border-paper-line border-l-rust-600 bg-rust-100 p-4">
            <p className="text-sm text-rust-700">
              Your plan downgrades to <strong>Free</strong>
              {billingStatus.currentPeriodEnd ? ` on ${formatDate(billingStatus.currentPeriodEnd)}` : ""}.
            </p>
            <button
              onClick={handleResume}
              disabled={resuming}
              className="btn-primary !px-4 !py-2 !text-sm"
            >
              {resuming ? "Restoring…" : "Keep my plan"}
            </button>
          </div>
        )}

        {error && (
          <p className="mb-6 rounded-xl border border-rust-600/40 bg-rust-100 px-4 py-3 text-center text-sm text-rust-700">{error}</p>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const isCurrent = plan.tier === currentTier;
            const isLoading = loading === plan.tier;
            const isEndingHere = isCurrent && plan.tier !== "free" && billingStatus?.cancelAtPeriodEnd;
            const downgradeAlreadyScheduled = plan.tier === "free" && !isCurrent && billingStatus?.cancelAtPeriodEnd;
            const highlighted = Boolean(plan.badge) && !isCurrent;

            return (
              <div
                key={plan.tier}
                className={`card relative flex flex-col p-6 ${
                  isCurrent ? "!border-2 !border-forest-700" : highlighted ? "!border-2 !border-rust-700" : ""
                }`}
              >
                {/* Ribbon */}
                {isEndingHere ? (
                  <span className="absolute -top-px right-5 rounded-b-lg bg-rust-600 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-cream">
                    Ends {billingStatus?.currentPeriodEnd ? formatDate(billingStatus.currentPeriodEnd) : "soon"}
                  </span>
                ) : isCurrent ? (
                  <span className="absolute -top-px right-5 inline-flex items-center gap-1 rounded-b-lg bg-forest-700 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-cream">
                    <Icon.Check size={11} /> Your plan
                  </span>
                ) : plan.badge ? (
                  <span className="absolute -top-px right-5 rounded-b-lg bg-rust-700 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-cream">
                    {plan.badge}
                  </span>
                ) : null}

                <h2 className="mb-1.5 mt-5 text-[17px] font-bold text-ink">{plan.name}</h2>
                <div className="mb-1.5 flex items-baseline gap-1">
                  <span className="font-display text-[28px] font-bold text-ink">{plan.price}</span>
                  {plan.period && <span className="text-[13px] text-ink-faint">{plan.period}</span>}
                </div>
                <p className="mb-5 text-[13px] text-ink-faint">{plan.tagline}</p>

                <ul className="mb-6 flex flex-1 flex-col gap-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-ink-soft">
                      <Icon.CheckCircle size={16} className="mt-0.5 flex-shrink-0 text-forest-600" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelect(plan.tier)}
                  disabled={isCurrent || loading !== null || Boolean(downgradeAlreadyScheduled)}
                  className={`w-full !py-3 !text-sm disabled:cursor-not-allowed ${
                    isCurrent || downgradeAlreadyScheduled
                      ? "inline-flex items-center justify-center rounded-[10px] bg-cream-2 font-semibold text-ink-faint"
                      : highlighted
                      ? "btn-primary"
                      : "btn-outline"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Spinner className="h-3.5 w-3.5" /> Switching…
                    </>
                  ) : isCurrent ? (
                    "Current plan"
                  ) : downgradeAlreadyScheduled ? (
                    "Downgrade scheduled"
                  ) : plan.tier === "free" ? (
                    "Downgrade to Free"
                  ) : currentTier === "free" ? (
                    "Start free trial"
                  ) : (
                    `Switch to ${plan.name}`
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-7 text-center text-[12.5px] text-ink-faint">
          All paid plans include a 14-day free trial on first subscribe. Cancel anytime.
        </p>
      </div>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={null}>
      <UpgradePageContent />
    </Suspense>
  );
}
