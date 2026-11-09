'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { MONTHLY_PLAN, monthLabel, monthNumOf, monthlyUpdateDue, parseMonthKey } from '@/lib/months';
import { Icon, Spinner } from '@/components/brand';

/**
 * Naturalist / Conservationist monthly update.
 * - When a new month starts: a banner with "Get <Month>'s update".
 * - After the update: the short note written for this month.
 */
export default function MonthlyUpdate() {
  const { plan, tier, monthlyUpdate, isAnalyzing } = useStore();
  const [error, setError] = useState<string | null>(null);
  const cfg = MONTHLY_PLAN[tier];
  if (!plan || !cfg) return null;

  const current = monthNumOf(new Date());
  const month = monthLabel(current).split(' ')[0];
  const lastMonth = monthLabel(current - 1).split(' ')[0];
  const newEnd = monthLabel(current + cfg.months - 1).split(' ')[0];

  if (monthlyUpdateDue(plan, tier)) {
    return (
      <div className="rounded-2xl border-[1.5px] border-forest-600 bg-forest-50 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-forest-700 text-cream">
            <Icon.Sprout size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-bold text-forest-800">Your {month} update is ready to build</p>
            <p className="mt-1 text-sm leading-relaxed text-forest-800">
              We&rsquo;ll move anything you didn&rsquo;t get to in {lastMonth} into {month}, add fresh tasks through {newEnd}{' '}
              built around what you finished, and keep everything you already checked off.
            </p>
            {error && <p className="mt-2 text-xs text-rust-700">{error}</p>}
            <button
              onClick={async () => {
                setError(null);
                const ok = await monthlyUpdate();
                if (!ok) setError('Could not build your update. Try again in a minute.');
              }}
              disabled={isAnalyzing}
              className="btn-primary mt-3 !py-2 !text-sm"
            >
              {isAnalyzing ? <><Spinner className="h-4 w-4" /> Building your update…</> : <>Get {month}&rsquo;s update <Icon.Arrow size={16} /></>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (plan.monthlyNote && parseMonthKey(plan.lastMonthlyUpdate) === current) {
    return (
      <div className="rounded-2xl border border-forest-200 bg-forest-50 p-5">
        <p className="eyebrow !text-forest-700">Your {month} update</p>
        <p className="mt-1.5 text-sm leading-relaxed text-forest-800">{plan.monthlyNote}</p>
      </div>
    );
  }

  return null;
}
