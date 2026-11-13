'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useStore } from '@/lib/store';
import { startCheckout } from '@/lib/checkout';
import { DATA_KEEP_DAYS, formatPrice, planFor } from '@/lib/pricing';
import { Icon, Seal, Spinner } from '@/components/brand';
import { ReportLink } from '@/components/ReportProblem';

function day(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '';
}

/** One-tap "keep my plan" button → Stripe Checkout for Steward, billed yearly. */
function KeepPlanButton({ label }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const steward = planFor('steward');
  return (
    <div>
      <button
        onClick={async () => {
          setBusy(true);
          setError(null);
          const err = await startCheckout('steward', 'year');
          if (err) { setError(err); setBusy(false); }
        }}
        disabled={busy}
        className="btn-primary !py-2.5 !text-sm"
      >
        {busy ? <><Spinner className="h-4 w-4" /> Opening checkout…</> : <>{label ?? `Keep my plan — ${formatPrice(steward.yearly)}/year`} <Icon.Arrow size={16} /></>}
      </button>
      {error && <p className="mt-2 text-xs text-rust-700">{error} <ReportLink error={error} className="ml-1" /></p>}
    </div>
  );
}

/**
 * Shown at the top of the dashboard on every visit while the free plan is running:
 * how many days are left, what happens after, and a one-tap way to keep everything.
 */
export function FreePlanBanner() {
  const { access } = useStore();
  if (!access || access.tier !== 'free' || access.locked || access.daysLeft === null) return null;
  const steward = planFor('steward');
  const urgent = access.daysLeft <= 2;

  return (
    <div className={`rounded-2xl border-[1.5px] p-5 ${urgent ? 'border-rust-600 bg-rust-100' : 'border-forest-600 bg-forest-50'}`}>
      <div className="flex items-start gap-4">
        <div
          className={`flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-full ${urgent ? 'bg-rust-600' : 'bg-forest-700'} text-cream`}
          aria-hidden="true"
        >
          <span className="font-display text-xl font-bold leading-none">{access.daysLeft}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider">{access.daysLeft === 1 ? 'day' : 'days'}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`font-display text-base font-bold ${urgent ? 'text-rust-700' : 'text-forest-800'}`}>
            {access.daysLeft === 1 ? 'Last day of your free plan' : `${access.daysLeft} days left in your free plan`}
          </p>
          <p className={`mt-1 text-sm leading-relaxed ${urgent ? 'text-rust-700' : 'text-forest-800'}`}>
            On {day(access.endsAt)} your plan, progress, and property info will be locked, and deleted {DATA_KEEP_DAYS} days
            later. Keep everything and get a full year of tasks for just {formatPrice(steward.yearly / 12)} a month.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <KeepPlanButton />
            <Link href="/upgrade" className="text-sm font-semibold text-forest-700 underline-offset-2 hover:underline">
              See all plans
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Replaces the dashboard once the free plan (or a cancelled plan) has ended. */
export function LockedScreen() {
  const { access, property, plan } = useStore();
  const tasks = plan?.tasks ?? [];
  const done = tasks.filter((t) => t.completed).length;

  return (
    <div className="mx-auto max-w-xl px-4 py-12 text-center sm:py-16">
      <Seal size={64} tone="rust"><Icon.Lock size={26} /></Seal>
      <h1 className="mt-5 text-2xl font-bold text-ink">Your free plan has ended</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
        {property ? (
          <>
            Your plan for <strong className="text-ink">{property.name}</strong>
            {tasks.length > 0 && <> ({tasks.length} tasks, {done} done)</>} is saved until{' '}
            <strong className="text-ink">{day(access?.deleteAt)}</strong>. Pick a plan to pick up right where you left off.
          </>
        ) : (
          <>Pick a plan to keep building on your land.</>
        )}
      </p>

      {tasks.length > 0 && (
        <div className="relative mx-auto mt-6 max-w-md overflow-hidden rounded-xl border border-paper-line bg-cream text-left" aria-hidden="true">
          <div className="pointer-events-none select-none divide-y divide-paper-line blur-[3px]">
            {tasks.slice(0, 3).map((t) => (
              <div key={t.id} className="px-4 py-3">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-ink-soft">{t.description}</p>
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-cream/40">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-cream">
              <Icon.Lock size={12} /> Locked
            </span>
          </div>
        </div>
      )}

      <div className="mt-7 flex flex-col items-center gap-3">
        <KeepPlanButton label={`Unlock my plan — ${formatPrice(planFor('steward').yearly)}/year`} />
        <Link href="/upgrade" className="text-sm font-semibold text-forest-700 underline-offset-2 hover:underline">
          See all plans, including monthly
        </Link>
      </div>
    </div>
  );
}

/** Paying member whose renewal payment failed — Stripe is retrying; ask them to fix their card. */
export function PaymentIssueBanner() {
  const { access } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!access?.paymentIssue) return null;

  return (
    <div className="rounded-2xl border-[1.5px] border-rust-600 bg-rust-100 p-5">
      <p className="font-display text-base font-bold text-rust-700">Your last payment didn&apos;t go through</p>
      <p className="mt-1 text-sm leading-relaxed text-rust-700">
        Your plan is still on while we try your card again. Update your payment details to keep everything running.
      </p>
      <button
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch('/api/stripe/portal', { method: 'POST' });
            const data = (await res.json().catch(() => ({}))) as { url?: string };
            if (!res.ok || !data.url) throw new Error();
            window.location.href = data.url;
          } catch {
            setError('Could not open billing. Please try again.');
            setBusy(false);
          }
        }}
        disabled={busy}
        className="btn-primary mt-3 !py-2.5 !text-sm"
      >
        {busy ? <><Spinner className="h-4 w-4" /> Opening billing…</> : <>Update payment <Icon.Arrow size={16} /></>}
      </button>
      {error && <p className="mt-2 text-xs text-rust-700">{error} <ReportLink error={error} className="ml-1" /></p>}
    </div>
  );
}

/** Shown for a few seconds after a finished Checkout while the new plan is switched on. */
export function FinishingCheckout() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <Seal size={64}><Spinner className="h-7 w-7" /></Seal>
      <h1 className="mt-5 text-2xl font-bold text-ink">Payment received — thank you!</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">Switching on your plan. This only takes a moment…</p>
    </div>
  );
}

/**
 * Back from a finished Stripe Checkout (?checkout=success&session_id=…): apply the
 * new plan right away, reload the member, and keep checking for up to ~30 seconds
 * in case Stripe is slow. Returns true while that's happening.
 */
export function useFinishCheckout(): boolean {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { refreshAccess } = useStore();
  const returning = searchParams.get('checkout') === 'success';
  const sessionId = searchParams.get('session_id');
  const [finishing, setFinishing] = useState(returning);
  const started = useRef(false);
  const mounted = useRef(true);
  // Refs so reloading the user (which hands us a new user object) doesn't restart the loop
  const userRef = useRef(user);
  userRef.current = user;
  const refreshRef = useRef(refreshAccess);
  refreshRef.current = refreshAccess;
  const hasUser = !!user;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!returning || !isLoaded || !hasUser || started.current) return;
    started.current = true;
    (async () => {
      for (let attempt = 0; attempt < 15 && mounted.current; attempt++) {
        if (sessionId) {
          await fetch('/api/stripe/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          }).catch(() => null);
        }
        const fresh = await userRef.current?.reload().catch(() => null);
        const tier = fresh?.publicMetadata?.tier;
        if (tier && tier !== 'free') break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!mounted.current) return;
      await refreshRef.current();
      setFinishing(false);
      // upgraded=1 → the dashboard expands their plan to the new membership
      router.replace('/dashboard?upgraded=1');
    })();
  }, [returning, isLoaded, hasUser, sessionId, router]);

  return returning && finishing;
}

/** For inner pages: once the account is locked, send the member back to the dashboard. */
export function useRedirectWhenLocked(to = '/dashboard') {
  const { access } = useStore();
  const router = useRouter();
  useEffect(() => {
    if (access?.locked) router.replace(to);
  }, [access?.locked, router, to]);
}
