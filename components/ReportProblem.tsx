'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Icon, Spinner } from '@/components/brand';

// ─── What happened just before the report (attached automatically) ─────────

interface Activity { at: string; what: string }
const recent: Activity[] = [];
function remember(what: string) {
  recent.push({ at: new Date().toISOString().slice(11, 19), what: what.slice(0, 300) });
  if (recent.length > 15) recent.shift();
}

/** Paths only — never query strings, which can hold ids or tokens. */
function pathOf(url: string): string {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url.split('?')[0];
  }
}

let watching = false;
/** Keep a short log of the app's own requests and any crashes, to attach to reports. */
function watchActivity() {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = pathOf(url);
    const ours = path.startsWith('/api/') && path !== '/api/report' && (url.startsWith('/') || url.startsWith(window.location.origin));
    const method = init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET');
    const started = Date.now();
    try {
      const res = await realFetch(input, init);
      if (ours) remember(`${method} ${path} → ${res.status} (${Date.now() - started} ms)`);
      return res;
    } catch (err) {
      if (ours) remember(`${method} ${path} → connection failed after ${Date.now() - started} ms`);
      throw err;
    }
  };
  window.addEventListener('error', (e) => remember(`error: ${e.message}`));
  window.addEventListener('unhandledrejection', (e) => {
    const reason = (e as PromiseRejectionEvent).reason;
    remember(`error: ${reason instanceof Error ? reason.message : String(reason)}`);
  });
}

function technicalDetails(extra?: Record<string, unknown>) {
  return {
    browser: navigator.userAgent,
    screen: `${window.innerWidth}×${window.innerHeight}`,
    online: navigator.onLine,
    recent: [...recent],
    ...extra,
  };
}

/** Send a report straight to the server. Used by the dialog and the crash screens. */
export async function sendProblemReport(input: { message?: string; error?: string; page?: string; extra?: Record<string, unknown> }) {
  const res = await fetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: input.message,
      error: input.error,
      page: input.page ?? window.location.pathname,
      details: technicalDetails(input.extra),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Could not send your report. Please try again.');
}

// ─── The dialog, available everywhere ───────────────────────────────────────

interface OpenOptions { error?: string; extra?: Record<string, unknown> }
const ReportContext = createContext<((opts?: OpenOptions) => void) | null>(null);

/** Open the "Report a problem" dialog (optionally with the error that was shown). */
export function useReportProblem() {
  const open = useContext(ReportContext);
  return open ?? ((opts?: OpenOptions) => window.dispatchEvent(new CustomEvent('landethic:report', { detail: opts })));
}

export function ReportProblemProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<OpenOptions | null>(null);
  const openDialog = useCallback((opts?: OpenOptions) => setOpen(opts ?? {}), []);

  useEffect(() => {
    watchActivity();
    const onEvent = (e: Event) => openDialog((e as CustomEvent<OpenOptions>).detail);
    window.addEventListener('landethic:report', onEvent);
    return () => window.removeEventListener('landethic:report', onEvent);
  }, [openDialog]);

  return (
    <ReportContext.Provider value={openDialog}>
      {children}
      {open && <ReportDialog options={open} onClose={() => setOpen(null)} />}
    </ReportContext.Provider>
  );
}

function ReportDialog({ options, onClose }: { options: OpenOptions; onClose: () => void }) {
  const pathname = usePathname();
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [failure, setFailure] = useState<string | null>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    boxRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async () => {
    setState('sending');
    setFailure(null);
    try {
      await sendProblemReport({ message, error: options.error, page: pathname, extra: options.extra });
      setState('sent');
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Could not send your report. Please try again.');
      setState('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Report a problem" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-paper-line bg-cream p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {state === 'sent' ? (
          <div className="py-4 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-forest-700 text-cream"><Icon.Check size={22} /></span>
            <p className="mt-3 font-display text-lg font-bold text-ink">Thanks — we got it</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">We&apos;ll look into this right away. You don&apos;t need to do anything else.</p>
            <button onClick={onClose} className="btn-primary mt-4 !py-2 !text-sm">Close</button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-bold text-ink">Report a problem</p>
                <p className="mt-0.5 text-sm text-ink-soft">Tell us what happened and we&apos;ll fix it as fast as we can.</p>
              </div>
              <button onClick={onClose} aria-label="Close" className="-mr-1 rounded-full p-1 text-ink-faint hover:text-ink">✕</button>
            </div>
            {options.error && (
              <div className="mt-3 rounded-lg border border-rust-600/30 bg-rust-100 px-3 py-2 text-xs text-rust-700">
                <span className="font-semibold">The error: </span>{options.error}
              </div>
            )}
            <label className="mt-3 block text-xs font-semibold text-ink-soft" htmlFor="report-message">What were you doing when it happened?</label>
            <textarea
              id="report-message"
              ref={boxRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="e.g. I upgraded to Conservationist and tapped Expand my plan"
              className="mt-1 w-full resize-none rounded-xl border border-paper-line bg-white px-3 py-2.5 text-sm text-ink placeholder-ink-faint focus:border-forest-600 focus:outline-none"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
              We&apos;ll also send the page you&apos;re on, the error, your browser, and the app&apos;s last few steps — nothing else.
            </p>
            {failure && <p className="mt-2 text-xs text-rust-700">{failure}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={send}
                disabled={state === 'sending' || (!message.trim() && !options.error)}
                className="btn-primary flex-1 !py-2 !text-sm disabled:opacity-50"
              >
                {state === 'sending' ? <><Spinner className="h-4 w-4" /> Sending…</> : 'Send report'}
              </button>
              <button onClick={onClose} className="btn-outline !px-4 !py-2 !text-sm">Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Small "Report this problem" link to put next to any error message. */
export function ReportLink({ error, className = '', label = 'Report this problem' }: { error?: string | null; className?: string; label?: string }) {
  const open = useReportProblem();
  return (
    <button
      type="button"
      onClick={() => open({ error: error ?? undefined })}
      className={`inline-flex items-center gap-1 text-xs font-semibold text-rust-700 underline underline-offset-2 hover:text-rust-600 ${className}`}
    >
      <Icon.Warning size={12} /> {label}
    </button>
  );
}
