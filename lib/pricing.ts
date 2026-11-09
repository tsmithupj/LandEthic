import type { SubscriptionTier } from '@/types';

// One source of truth for plan names, prices, and feature copy — used by both the
// landing page and /upgrade so they can't drift apart. Every line here should
// describe something the app actually does today.

export interface PlanInfo {
  tier: SubscriptionTier;
  name: string;
  price: string;
  period?: string;
  tagline: string;
  features: string[];
  badge?: string;
}

export const PLANS: PlanInfo[] = [
  {
    tier: 'free',
    name: 'Free',
    price: '$0',
    tagline: 'A real look at what your land can do.',
    features: [
      'Satellite map of your property',
      'Soil and land breakdown',
      'Land health score',
      '30-day action plan',
      '1 property',
    ],
  },
  {
    tier: 'steward',
    name: 'Steward',
    price: '$9.99',
    period: '/mo',
    tagline: 'A full year of direction for your land.',
    badge: 'Most popular',
    features: [
      'Full-year action plan, season by season',
      'ID plants and animals from your photos',
      'Swap tasks you already did for new ones',
      '1 property',
    ],
  },
  {
    tier: 'naturalist',
    name: 'Naturalist',
    price: '$19.99',
    period: '/mo',
    tagline: 'A month-by-month calendar for your land.',
    features: [
      'Everything in Steward',
      'Month-by-month task calendar',
      'Fresh tasks every month, built around what you finished',
      'See how each task moves your land health',
      'Up to 3 properties',
    ],
  },
  {
    tier: 'conservationist',
    name: 'Conservationist',
    price: '$39.99',
    period: '/mo',
    tagline: 'Built for people who take their land seriously.',
    features: [
      'Everything in Naturalist',
      'Weekly checklists you can tick off step by step',
      'Food plot planner: what to plant, how much, and where',
      'Nesting box planner: which boxes, how high, and where',
      'Seven tasks a month for faster progress',
      'Unlimited properties',
    ],
  },
];

export const TRIAL_NOTE = 'All paid plans include a 14-day free trial. Cancel anytime.';

export const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: 'Free',
  steward: 'Steward',
  naturalist: 'Naturalist',
  conservationist: 'Conservationist',
};
