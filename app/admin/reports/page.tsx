import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { currentUser } from '@clerk/nextjs/server';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { problemReports } from '@/lib/db/schema';
import AppHeader from '@/components/AppHeader';

// Owner-only list of "Report a problem" submissions. Who counts as the owner:
// ADMIN_EMAILS in Vercel (comma-separated sign-in emails). Everyone else gets a 404.
export const dynamic = 'force-dynamic';

function isAdmin(email: string | null | undefined): boolean {
  const list = (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}

async function setStatus(formData: FormData) {
  'use server';
  const me = await currentUser();
  if (!isAdmin(me?.primaryEmailAddress?.emailAddress)) return;
  const id = String(formData.get('id') ?? '');
  const status = formData.get('status') === 'fixed' ? 'fixed' : 'new';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await getDb().update(problemReports).set({ status }).where(eq(problemReports.id, id));
  revalidatePath('/admin/reports');
}

const when = (d: Date) =>
  d.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default async function ReportsPage() {
  const me = await currentUser();
  if (!isAdmin(me?.primaryEmailAddress?.emailAddress)) notFound();

  let rows: (typeof problemReports.$inferSelect)[] = [];
  let missing = false;
  try {
    rows = await getDb().select().from(problemReports).orderBy(desc(problemReports.createdAt)).limit(100);
  } catch {
    missing = true;
  }
  const open = rows.filter((r) => r.status !== 'fixed').length;

  return (
    <div className="min-h-screen bg-cream-2">
      <AppHeader back={{ href: '/dashboard', label: 'Dashboard' }} width="max-w-3xl" />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-2xl font-bold text-ink">Problem reports</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {missing ? 'The problem_reports table isn’t set up yet.' : `${open} open · ${rows.length} total (newest first, last 100)`}
        </p>

        <div className="mt-5 space-y-3">
          {rows.map((r) => (
            <div key={r.id} className={`card p-4 ${r.status === 'fixed' ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-ink-soft">
                  {when(r.createdAt)} · {r.email ?? 'not signed in'}{r.tier ? ` · ${r.tier}` : ''} · {r.page ?? '?'}
                </p>
                <form action={setStatus}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="status" value={r.status === 'fixed' ? 'new' : 'fixed'} />
                  <button className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${r.status === 'fixed' ? 'border-paper-line text-ink-soft' : 'border-forest-700 bg-forest-700 text-cream'}`}>
                    {r.status === 'fixed' ? 'Fixed — reopen' : 'Mark fixed'}
                  </button>
                </form>
              </div>
              {r.error && <p className="mt-2 rounded-lg bg-rust-100 px-3 py-2 text-sm text-rust-700">{r.error}</p>}
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{r.message || <span className="text-ink-faint">(nothing typed)</span>}</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-semibold text-forest-700">Technical details</summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-cream p-3 text-[11px] leading-relaxed text-ink-soft">{JSON.stringify(r.details, null, 2)}</pre>
              </details>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
