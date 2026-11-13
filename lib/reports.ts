import { createHash } from 'node:crypto';
import { and, count, eq, gte, or } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { problemReports } from '@/lib/db/schema';

// "Report a problem": save the report and email it right away.
//
// Email goes through Resend (https://resend.com) when these are set in Vercel:
//   RESEND_API_KEY  — from the Resend dashboard (Secret)
//   REPORTS_EMAIL   — where reports go, e.g. tyler@… (Config)
//   REPORTS_FROM    — optional sender; defaults to Resend's test sender, which can
//                     only email the Resend account's own address (fine for alerts)
// Without them, reports are still saved and logged — nothing breaks.

export interface ProblemReport {
  clerkUserId: string | null;
  email: string | null;
  tier: string | null;
  page: string | null;
  message: string | null;
  error: string | null;
  details: Record<string, unknown>;
  ip: string | null;
}

const MAX_PER_HOUR = 10;

export function hashIp(ip: string | null): string | null {
  return ip ? createHash('sha256').update(`landethic:${ip}`).digest('hex').slice(0, 32) : null;
}

/** True when this member / address has already sent a lot of reports in the last hour. */
export async function tooManyReports(clerkUserId: string | null, ipHash: string | null): Promise<boolean> {
  if (!clerkUserId && !ipHash) return false;
  try {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const who = [
      ...(clerkUserId ? [eq(problemReports.clerkUserId, clerkUserId)] : []),
      ...(ipHash ? [eq(problemReports.ipHash, ipHash)] : []),
    ];
    const [row] = await getDb()
      .select({ n: count() })
      .from(problemReports)
      .where(and(gte(problemReports.createdAt, since), or(...who)));
    return Number(row?.n ?? 0) >= MAX_PER_HOUR;
  } catch {
    return false;
  }
}

/** Save the report. Returns its id, or null if the database couldn't take it. */
export async function saveReport(r: ProblemReport): Promise<string | null> {
  try {
    const [row] = await getDb()
      .insert(problemReports)
      .values({
        clerkUserId: r.clerkUserId,
        email: r.email,
        tier: r.tier,
        page: r.page,
        message: r.message,
        error: r.error,
        details: r.details,
        ipHash: hashIp(r.ip),
      })
      .returning({ id: problemReports.id });
    return row?.id ?? null;
  } catch (err) {
    console.error('[problem-report] could not save (is the problem_reports table created?):', err instanceof Error ? err.message : err);
    return null;
  }
}

function emailText(r: ProblemReport, id: string | null): string {
  const lines = [
    `Someone reported a problem on LandEthic.`,
    ``,
    `Who: ${r.email ?? 'not signed in'}${r.tier ? ` (${r.tier} plan)` : ''}`,
    `Page: ${r.page ?? 'unknown'}`,
    `When: ${new Date().toUTCString()}`,
    ``,
    `What they said:`,
    r.message?.trim() ? r.message.trim() : '(nothing typed)',
    ``,
    `Error they saw:`,
    r.error?.trim() ? r.error.trim() : '(none captured)',
    ``,
    `Technical details:`,
    JSON.stringify(r.details, null, 2),
    ``,
    id ? `Report id: ${id} — all reports: /admin/reports` : 'Report was not saved to the database (see Vercel logs).',
  ];
  return lines.join('\n');
}

/** Email the report to the owner. Never throws. Returns true if Resend accepted it. */
export async function emailReport(r: ProblemReport, id: string | null): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.REPORTS_EMAIL;
  if (!key || !to) return false;
  try {
    const subjectBits = [r.error?.slice(0, 60), r.page].filter(Boolean).join(' — ');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.REPORTS_FROM || 'LandEthic Reports <onboarding@resend.dev>',
        to: to.split(',').map((s) => s.trim()).filter(Boolean),
        ...(r.email ? { reply_to: r.email } : {}),
        subject: `LandEthic problem report${subjectBits ? `: ${subjectBits}` : ''}`,
        text: emailText(r, id),
      }),
    });
    if (!res.ok) console.error('[problem-report] email failed:', res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (err) {
    console.error('[problem-report] email failed:', err instanceof Error ? err.message : err);
    return false;
  }
}
