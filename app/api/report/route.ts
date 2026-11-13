import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isTier } from '@/lib/tiers';
import { emailReport, hashIp, saveReport, tooManyReports } from '@/lib/reports';

const clip = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

/**
 * POST /api/report  { message?, error?, page?, details? }
 *
 * "Report a problem" from anywhere in the app — including crash screens and pages
 * where the visitor isn't signed in, so this route is public (see middleware.ts).
 * Saves the report, emails it to the owner, and writes it to the server log.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid report' }, { status: 400 });

  const message = clip(body.message, 2000);
  const error = clip(body.error, 2000);
  if (!message && !error) {
    return NextResponse.json({ error: 'Tell us a little about what went wrong.' }, { status: 400 });
  }

  const { userId } = await auth();
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  if (await tooManyReports(userId, hashIp(ip))) {
    return NextResponse.json({ error: 'Thanks — we already have your reports. We\'re on it.' }, { status: 429 });
  }

  let email: string | null = null;
  let tier: string | null = null;
  if (userId) {
    const me = await currentUser().catch(() => null);
    email = me?.primaryEmailAddress?.emailAddress ?? null;
    const t = me?.publicMetadata?.tier;
    tier = isTier(t) ? t : 'free';
  }

  // Technical details from the browser (size-capped), plus what only the server knows
  let details: Record<string, unknown> = {};
  if (body.details && typeof body.details === 'object' && !Array.isArray(body.details)) {
    const raw = JSON.stringify(body.details);
    details = raw.length <= 8000 ? (body.details as Record<string, unknown>) : { truncated: raw.slice(0, 8000) };
  }
  details = {
    ...details,
    appVersion: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    userId,
  };

  const report = { clerkUserId: userId, email, tier, page: clip(body.page, 300), message, error, details, ip };
  const id = await saveReport(report);
  const emailed = await emailReport(report, id, req.nextUrl.origin);
  // Always in the server log too, so nothing is lost even if the database or email is down
  console.error('[problem-report]', JSON.stringify({ id, emailed, email, tier, page: report.page, error, message }));

  return NextResponse.json({ ok: true, id });
}
