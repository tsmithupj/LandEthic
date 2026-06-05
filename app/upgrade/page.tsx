'use client';

import Link from "next/link";
import { useState } from "react";
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

export default function UpgradePage() {
  const { tier: currentTier } = useStore();
  const [loading, setLoading] = useState<SubscriptionTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (tierId: SubscriptionTier) => {
    if (tierId === currentTier) return;
    setLoading(tierId);
    setError(null);
    try {
      const res = await fetch("/api/set-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tierId }),
      });
      if (!res.ok) throw new Error("Failed to update plan");
      window.location.href = "/dashboard";
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(null);
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
            Switch to any plan below. Changes take effect immediately and your land data carries over.
          </p>
        </div>

        {error && (
          <p className="text-center text-sm text-red-500 mb-6">{error}</p>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIERS.map((tier) => {
            const isCurrent = tier.tierId === currentTier;
            const isLoading = loading === tier.tierId;

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
                  {isCurrent ? (
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
                  disabled={isCurrent || loading !== null}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-all disabled:cursor-not-allowed ${
                    isCurrent
                      ? "bg-gray-100 text-gray-400"
                      : tier.highlighted
                      ? "text-white hover:opacity-90"
                      : "border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  }`}
                  style={!isCurrent && tier.highlighted ? { backgroundColor: "#3B6D11" } : {}}
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
                  ) : (
                    `Switch to ${tier.name}`
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          All paid plans include a 14-day free trial. Cancel or switch anytime.
        </p>
      </div>
    </div>
  );
}
