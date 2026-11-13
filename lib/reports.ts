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

// Times in the email are shown in the owner's time zone
const TIME_ZONE = 'America/New_York';
const ZONE_LABEL = 'Eastern';

function eastern(d: Date, withDate: boolean): string {
  return d.toLocaleString('en-US', {
    timeZone: TIME_ZONE,
    ...(withDate ? { weekday: 'short', month: 'short', day: 'numeric' } : {}),
    hour: 'numeric',
    minute: '2-digit',
    ...(withDate ? {} : { second: '2-digit' }),
  });
}

/** A step's time: a full ISO time, or (older app versions) "HH:MM:SS" in UTC on the report's day. */
function stepTime(at: unknown, now: Date): string {
  if (typeof at !== 'string') return '';
  const d = /^\d{2}:\d{2}:\d{2}$/.test(at) ? new Date(`${now.toISOString().slice(0, 10)}T${at}Z`) : new Date(at);
  return Number.isNaN(d.getTime()) ? at : eastern(d, false);
}

/** "Chrome 152 on Mac" from a browser's user-agent string. */
export function describeBrowser(ua: unknown): string | null {
  if (typeof ua !== 'string' || !ua) return null;
  const major = (re: RegExp) => ua.match(re)?.[1]?.split('.')[0] ?? null;
  // Order matters: Edge also says "Chrome", and Chrome also says "Safari"
  const known: [string, RegExp][] = [
    ['Edge', /Edg(?:e|A|iOS)?\/([\d.]+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
    ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari\//],
  ];
  let browser = 'Unknown browser';
  for (const [name, re] of known) {
    const v = major(re);
    if (v) { browser = `${name} ${v}`; break; }
  }
  const system =
    (/iPhone/.test(ua) && 'iPhone') ||
    (/iPad/.test(ua) && 'iPad') ||
    (/Android/.test(ua) && 'Android') ||
    (/Mac OS X|Macintosh/.test(ua) && 'Mac') ||
    (/Windows/.test(ua) && 'Windows') ||
    (/CrOS/.test(ua) && 'Chromebook') ||
    (/Linux/.test(ua) && 'Linux') ||
    'unknown device';
  return `${browser} on ${system}`;
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Plain-language email body. `origin` is the site the member was on, for clickable links. */
export function emailText(r: ProblemReport, id: string | null, origin: string, now = new Date()): string {
  const d = { ...r.details } as Record<string, unknown>;
  const take = (k: string) => { const v = d[k]; delete d[k]; return v; };
  const ua = take('browser');
  const screen = take('screen');
  const online = take('online');
  const appVersion = take('appVersion');
  const userId = take('userId');
  const recent = take('recent');

  const steps = Array.isArray(recent)
    ? recent.map((s) => {
        const step = (s ?? {}) as { at?: unknown; what?: unknown };
        const time = stepTime(step.at, now);
        return `• ${time ? `${time}  ` : ''}${String(step.what ?? '')}`;
      })
    : [];
  const pageUrl = r.page ? (r.page.startsWith('/') ? `${origin}${r.page}` : r.page) : null;
  const extra = Object.entries(d).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);

  return [
    `Someone reported a problem on LandEthic.`,
    ``,
    `Who:   ${r.email ?? 'a visitor who isn’t signed in'}${r.tier ? ` (${capital(r.tier)} plan)` : ''}`,
    `When:  ${eastern(now, true)} ${ZONE_LABEL}`,
    `Page:  ${pageUrl ?? 'unknown'}`,
    ``,
    `WHAT THEY SAID`,
    r.message?.trim() || '(nothing typed)',
    ``,
    `ERROR THEY SAW`,
    r.error?.trim() || '(no error message on screen)',
    ``,
    `WHAT THE APP DID JUST BEFORE (${ZONE_LABEL} time)`,
    ...(steps.length ? steps : ['(nothing recorded)']),
    ``,
    `TECHNICAL DETAILS`,
    `Browser:      ${describeBrowser(ua) ?? 'unknown'}`,
    `Screen size:  ${typeof screen === 'string' ? screen : 'unknown'}`,
    `Online:       ${online === false ? 'no — their connection was down' : online === true ? 'yes' : 'unknown'}`,
    `App version:  ${typeof appVersion === 'string' ? appVersion : 'unknown'}`,
    `Member id:    ${typeof userId === 'string' ? userId : 'not signed in'}`,
    ...extra,
    ...(typeof ua === 'string' ? [`Full browser info: ${ua}`] : []),
    ``,
    `———`,
    r.email ? `Reply to this email to answer ${r.email} directly.` : `They weren’t signed in, so there’s no email to reply to.`,
    `All reports (mark this one fixed when it’s sorted): ${origin}/admin/reports`,
    id ? `Report id: ${id}` : `This report wasn’t saved to the database — it’s still in the Vercel logs.`,
  ].join('\n');
}

/** Short subject: who it's from, then the error (or the page). */
export function emailSubject(r: ProblemReport): string {
  const who = r.email ?? 'a visitor';
  const what = r.error?.trim() ? r.error.trim().replace(/\s+/g, ' ').slice(0, 70) : r.page ? `on ${r.page}` : '';
  return `LandEthic problem from ${who}${what ? ` — ${what}` : ''}`;
}

/** Email the report to the owner. Never throws. Returns true if Resend accepted it. */
export async function emailReport(r: ProblemReport, id: string | null, origin = 'https://landethic.io'): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.REPORTS_EMAIL;
  if (!key || !to) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.REPORTS_FROM || 'LandEthic Reports <onboarding@resend.dev>',
        to: to.split(',').map((s) => s.trim()).filter(Boolean),
        ...(r.email ? { reply_to: r.email } : {}),
        subject: emailSubject(r),
        text: emailText(r, id, origin.replace(/\/$/, '')),
      }),
    });
    if (!res.ok) console.error('[problem-report] email failed:', res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (err) {
    console.error('[problem-report] email failed:', err instanceof Error ? err.message : err);
    return false;
  }
}
