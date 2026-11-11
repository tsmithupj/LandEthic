import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { syncCheckoutSession } from '@/lib/billing';

/**
 * POST /api/stripe/sync  { sessionId }
 *
 * Called by the dashboard when a member lands back from a finished Checkout.
 * Applies the new plan straight away instead of waiting for Stripe's webhook,
 * so they never see "your free plan has ended" right after paying.
 * Only works for the signed-in member's own, completed Checkout session.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { sessionId?: unknown };
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
  }

  try {
    const tier = await syncCheckoutSession(userId, sessionId);
    if (!tier) return NextResponse.json({ pending: true }, { status: 202 });
    return NextResponse.json({ tier });
  } catch (err) {
    console.error('[stripe/sync] failed:', err instanceof Error ? err.message : err);
    // The webhook will still apply it — the dashboard keeps checking
    return NextResponse.json({ pending: true }, { status: 202 });
  }
}
