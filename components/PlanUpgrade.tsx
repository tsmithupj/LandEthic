'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { TIER_ORDER } from '@/lib/tiers';
import { TIER_LABELS } from '@/lib/pricing';
import { Icon, Spinner } from '@/components/brand';
import { ReportLink } from '@/components/ReportProblem';
import type { SubscriptionTier } from '@/types';

/** What a bigger plan adds, in plain words. */
const WHAT_YOU_GET: Record<Exclude<SubscriptionTier, 'free'>, string> = {
  steward: 'a full year of tasks, season by season, with what to photograph for each one',
  naturalist: '3 tasks every month for the next 6 months, each with step-by-step how-to, how long it takes, and what it costs — and fresh tasks every month',
  conservationist: '7 tasks a month with a week-by-week checklist, seed rates and nest box placement, and how long each takes and what it costs',
};

/** True when the member's plan was built for a smaller membership than they have now. */
export function planBelowMembership(planTier: SubscriptionTier | undefined, tier: SubscriptionTier): boolean {
  return !!planTier && tier !== 'free' && TIER_ORDER.indexOf(planTier) < TIER_ORDER.indexOf(tier);
}

/**
 * Shown after moving up a membership (e.g. Steward → Naturalist) until the plan
 * is expanded to match. Finished tasks stay; it doesn't use up a plan rebuild.
 */
export default function PlanUpgradeCard({ onExpand }: { onExpand: () => Promise<boolean> }) {
  const { plan, tier, isAnalyzing, analyzeError } = useStore();
  const [failed, setFailed] = useState(false);
  if (!plan || tier === 'free' || !planBelowMembership(plan.tier, tier)) return null;
  const done = plan.tasks.filter((t) => t.completed).length;

  return (
    <div className="rounded-2xl border-[1.5px] border-forest-600 bg-forest-50 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-forest-700 text-cream">
          <Icon.Sprout size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold text-forest-800">
            Your {TIER_LABELS[tier]} plan is ready to build
          </p>
          <p className="mt-1 text-sm leading-relaxed text-forest-800">
            Your current plan was made for {TIER_LABELS[plan.tier]}. Expand it to get {WHAT_YOU_GET[tier]}.
            {done === 1 ? ' The task you already finished stays on your plan.' : done > 1 ? ` The ${done} tasks you already finished stay on your plan.` : ''}
          </p>
          {failed && !isAnalyzing && (
            <div className="mt-2 text-xs text-rust-700">
              {/* The real reason from the server, e.g. "used this month's plan upgrade" */}
              <p>{analyzeError ?? 'Could not expand your plan. Try again in a minute.'}</p>
              <ReportLink error={analyzeError ?? 'Expand my plan failed'} className="mt-1" />
            </div>
          )}
          <button
            onClick={async () => {
              setFailed(false);
              const ok = await onExpand();
              if (!ok) setFailed(true);
            }}
            disabled={isAnalyzing}
            className="btn-primary mt-3 !py-2 !text-sm"
          >
            {isAnalyzing ? <><Spinner className="h-4 w-4" /> Expanding your plan…</> : <>Expand my plan <Icon.Arrow size={16} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
