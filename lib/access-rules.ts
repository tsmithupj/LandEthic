import type { SubscriptionTier } from '@/types';
import { DATA_KEEP_DAYS, FREE_PLAN_DAYS } from '@/lib/pricing';

// Free plan rules — pure, safe to import anywhere (also used by the cleanup job).
//
//  - A new account gets FREE_PLAN_DAYS days of the Free plan.
//  - When a paid plan is cancelled, access lasts until the paid period ends.
//  - After that the account is LOCKED (no AI features, no new properties) until
//    the member picks a plan.
//  - DATA_KEEP_DAYS days after the lock, the cleanup job deletes their land data.

export interface AccessState {
  tier: SubscriptionTier;
  /** True while the member can use the app. */
  locked: boolean;
  /** When free (or cancelled paid) access ends / ended. Null for active paid plans. */
  endsAt: string | null;
  /** When land data is deleted if they don't pick a plan. Null for active paid plans. */
  deleteAt: string | null;
  /** Whole days of access left (0 once locked). Null for active paid plans. */
  daysLeft: number | null;
  /** Paid plan whose last renewal payment failed (Stripe is retrying). From /api/account/access only. */
  paymentIssue?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When a member's paid access ended, from their saved subscription row.
 *  - canceled: at the end of the last paid period
 *  - unpaid (Stripe gave up on renewal but kept the subscription): when it went unpaid
 *  - anything else (never subscribed, still paying, never completed a payment): null
 */
export function paidAccessEndFromSubscription(
  sub: { status: string | null; currentPeriodEnd: Date | null; updatedAt: Date } | null | undefined,
): Date | null {
  if (!sub?.status) return null;
  if (sub.status === 'canceled') return sub.currentPeriodEnd ?? sub.updatedAt;
  if (sub.status === 'unpaid') return sub.updatedAt;
  return null;
}

export function computeAccess(input: {
  tier: SubscriptionTier;
  accountCreatedAt: Date;
  /** When a cancelled paid plan's last paid period ended, if they ever paid. */
  paidAccessEndedAt?: Date | null;
  now?: Date;
}): AccessState {
  const now = input.now ?? new Date();
  if (input.tier !== 'free') {
    return { tier: input.tier, locked: false, endsAt: null, deleteAt: null, daysLeft: null };
  }
  const freeEnds = input.accountCreatedAt.getTime() + FREE_PLAN_DAYS * DAY_MS;
  const ends = Math.max(freeEnds, input.paidAccessEndedAt?.getTime() ?? 0);
  const locked = now.getTime() >= ends;
  return {
    tier: 'free',
    locked,
    endsAt: new Date(ends).toISOString(),
    deleteAt: new Date(ends + DATA_KEEP_DAYS * DAY_MS).toISOString(),
    daysLeft: locked ? 0 : Math.ceil((ends - now.getTime()) / DAY_MS),
  };
}
