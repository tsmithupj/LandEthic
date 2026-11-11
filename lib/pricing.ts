import type { SubscriptionTier } from '@/types';

// One source of truth for plan names, prices, and feature copy — used by the
// landing page, /upgrade, the Terms page, and the free-plan banner so they can't
// drift apart. Every line here should describe something the app actually does.
// Prices and allowances: see claude/LandEthic-Pricing-Analysis.md (Nov 2026).

export type BillingInterval = 'month' | 'year';

/** How long the Free plan lasts, and how long data is kept after access ends. */
export const FREE_PLAN_DAYS = 7;
export const DATA_KEEP_DAYS = 30;

export interface PlanInfo {
  tier: SubscriptionTier;
  name: string;
  /** Price per month when billed monthly (0 for Free). */
  monthly: number;
  /** Price per year when billed yearly (0 for Free). */
  yearly: number;
  tagline: string;
  features: string[];
  badge?: string;
}

export const PLANS: PlanInfo[] = [
  {
    tier: 'free',
    name: 'Free',
    monthly: 0,
    yearly: 0,
    tagline: `Try it free for ${FREE_PLAN_DAYS} days. No card needed.`,
    features: [
      'Satellite map of your property',
      'Soil and land breakdown',
      'Land health score',
      '30-day action plan',
      '3 plant and animal IDs from your photos',
      '1 property',
    ],
  },
  {
    tier: 'steward',
    name: 'Steward',
    monthly: 3.99,
    yearly: 29.99,
    tagline: 'A full year of direction for your land.',
    badge: 'Most popular',
    features: [
      'Full-year action plan, season by season',
      'ID plants and animals from your photos (20 a month)',
      'Rebuild your plan once a month',
      'Swap up to 5 tasks a month for new ones',
      '1 property',
    ],
  },
  {
    tier: 'naturalist',
    name: 'Naturalist',
    monthly: 6.99,
    yearly: 59.99,
    tagline: 'A month-by-month calendar for your land.',
    features: [
      'Everything in Steward',
      'Month-by-month task calendar',
      'Fresh tasks every month, built around what you finished',
      'See how each task moves your land health',
      '30 plant and animal IDs a month',
      'Up to 3 properties',
    ],
  },
  {
    tier: 'conservationist',
    name: 'Conservationist',
    monthly: 15.99,
    yearly: 119.99,
    tagline: 'Built for people who take their land seriously.',
    features: [
      'Everything in Naturalist',
      'Weekly checklists you can tick off step by step',
      'Food plot planner: what to plant, how much, and where',
      'Nesting box planner: which boxes, how high, and where',
      'Seven tasks a month for faster progress',
      '60 plant and animal IDs a month',
      'Up to 10 properties',
    ],
  },
];

export const TRIAL_NOTE = `Every account starts with a free ${FREE_PLAN_DAYS}-day plan, no card needed. Paid plans renew monthly or yearly. Cancel anytime.`;

export const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: 'Free',
  steward: 'Steward',
  naturalist: 'Naturalist',
  conservationist: 'Conservationist',
};

export function planFor(tier: SubscriptionTier): PlanInfo {
  return PLANS.find((p) => p.tier === tier) ?? PLANS[0];
}

/** "$3.99" — or "$0" for free. */
export function formatPrice(amount: number): string {
  return amount === 0 ? '$0' : `$${amount.toFixed(2)}`;
}

/** How much cheaper yearly is than 12 months, as a whole percent. */
export function yearlySavingsPercent(plan: PlanInfo): number {
  if (!plan.monthly) return 0;
  return Math.round((1 - plan.yearly / (plan.monthly * 12)) * 100);
}
