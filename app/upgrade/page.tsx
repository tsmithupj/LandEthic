'use client';

import Link from "next/link";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useStore } from "@/lib/store";
import type { SubscriptionTier } from "@/types";

const TIERS: {
  name: string;
  tierId: SubscriptionTier;
  price: string;
  period?: string;
  badge?: string;
  description: string;
  features: string[];
  highlighted: boolean;
}[] = [
  {
    name: "Free",
    tierId: "free",
    price: "$0",
    description: "A real look at what your land can do.",
    features: ["1 property", "Satellite + parcel analysis", "Basic property profile", "30-day action plan"],
    highlighted: false,
  },
  {
    name: "Steward",
    tierId: "steward",
    price: "$9.99",
    period: "/mo",
    badge: "Most popular",
    description: "A full year of direction for your land.",
    features: ["Ground-level photo input", "Tree & species ID", "Yearly action plan", "Ecosystem health score", "Swap completed tasks for new ones"],
    highlighted: true,
  },
  {
    name: "Naturalist",
    tierId: "naturalist",
    price: "$19.99",
    period: "/mo",
    description: "Fresh guidance every single month.",
    features: ["Everything in Steward", "Monthly action calendar", "Impact score on every task", "Up to 3 properties"],
    highlighted: false,
  },
  {
    name: "Conservationist",
    tierId: "conservationist",
    price: "$39.99",
    period: "/mo",
    description: "Built for people who take their land seriously.",
    features: ["Everything in Naturalist", "Weekly task checklists", "Food plot seed picks", "Nesting box placement plans", "OnX integration (coming soon)"],
    highlighted: false,
  },
];

const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: "Free",
  steward: "Steward",
  naturalist: "Naturalist",
  conservationist: "Conservationist",
};

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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            &larr; Back to dashboard
          </Link>
          <Link href="/" className="text-base font-semibold">
            <span style={{ color: "#3B6D11" }}>Land</span>Ethic.io
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="text-center mb-10">
          <div className="inline-block text-xs font-semibold px-3 py-1.5 rounded-full mb-4"
            style={{ backgroundColor: "#EAF3DE", color: "#3B6D11" }}>
            Currently on the <strong>{currentTierLabel}</strong> plan
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-3">
            Manage your plan
          </h1>
          <p className="text-gray-500 max-w-lg mx-auto text-sm leading-relaxed">
            Switching between paid plans applies immediately with a prorated charge. Downgrading to Free takes effect at the end of your current billing period, and your land data always carries over.
          </p>
          {currentTier !== "free" && (
            <button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="mt-3 text-sm font-medium underline disabled:opacity-60"
              style={{ color: "#3B6D11" }}
            >
              {portalLoading ? "Opening billing…" : "Manage billing"}
            </button>
          )}
        </div>

        {billingStatus?.cancelAtPeriodEnd && (
          <div
            className="mb-8 rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3"
            style={{ borderColor: "#F0C674", backgroundColor: "#FDF6E8" }}
          >
            <p className="text-sm text-gray-700">
              Your plan downgrades to <strong>Free</strong>
              {billingStatus.currentPeriodEnd ? ` on ${formatDate(billingStatus.currentPeriodEnd)}` : ""}.
            </p>
            <button
              onClick={handleResume}
              disabled={resuming}
              className="text-sm font-semibold disabled:opacity-60"
              style={{ color: "#3B6D11" }}
            >
              {resuming ? "Restoring…" : "Keep my plan"}
            </button>
          </div>
        )}

        {error && (
          <p className="text-center text-sm text-red-500 mb-6">{error}</p>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIERS.map((tier) => {
            const isCurrent = tier.tierId === currentTier;
            const isLoading = loading === tier.tierId;
            const isEndingHere = isCurrent && tier.tierId !== "free" && billingStatus?.cancelAtPeriodEnd;
            const downgradeAlreadyScheduled = tier.tierId === "free" && !isCurrent && billingStatus?.cancelAtPeriodEnd;

            return (
              <div
                key={tier.name}
                className={`bg-white rounded-2xl p-5 flex flex-col transition-shadow ${
                  isCurrent
                    ? "border-2"
                    : tier.highlighted
                    ? "border-2"
                    : "border border-gray-100"
                }`}
                style={{
                  borderColor: isCurrent ? "#3B6D11" : tier.highlighted ? "#639922" : undefined,
                }}
              >
                {/* Badges */}
                <div className="min-h-[28px] mb-3 flex items-start">
                  {isEndingHere ? (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: "#FDF6E8", color: "#946200" }}>
                      Ending {billingStatus?.currentPeriodEnd ? formatDate(billingStatus.currentPeriodEnd) : "soon"}
                    </span>
                  ) : isCurrent ? (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: "#EAF3DE", color: "#3B6D11" }}>
                      &#10003; Your current plan
                    </span>
                  ) : tier.badge ? (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: "#EAF3DE", color: "#3B6D11" }}>
                      {tier.badge}
                    </span>
                  ) : null}
                </div>

                <h2 className="text-base font-semibold text-gray-900">{tier.name}</h2>
                <div className="mt-0.5 mb-1">
                  <span className="text-xl font-semibold text-gray-900">{tier.price}</span>
                  {tier.period && <span className="text-sm text-gray-400">{tier.period}</span>}
                </div>
                <p className="text-xs text-gray-400 mb-4">{tier.description}</p>

                <ul className="space-y-2 flex-1 mb-5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="font-bold text-xs mt-0.5 flex-shrink-0" style={{ color: "#639922" }}>&#10003;</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelect(tier.tierId)}
                  disabled={isCurrent || loading !== null || downgradeAlreadyScheduled}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-all disabled:cursor-not-allowed ${
                    isCurrent || downgradeAlreadyScheduled
                      ? "bg-gray-100 text-gray-400"
                      : tier.highlighted
                      ? "text-white hover:opacity-90"
                      : "border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  }`}
                  style={!isCurrent && !downgradeAlreadyScheduled && tier.highlighted ? { backgroundColor: "#3B6D11" } : {}}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Switching&hellip;
                    </span>
                  ) : isCurrent ? (
                    "Current plan"
                  ) : downgradeAlreadyScheduled ? (
                    "Downgrade scheduled"
                  ) : tier.tierId === "free" ? (
                    "Downgrade to Free"
                  ) : (
                    `Switch to ${tier.name}`
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          All paid plans include a 14-day free trial on first subscribe.
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
