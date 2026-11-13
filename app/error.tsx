'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Icon, Seal } from '@/components/brand';
import { ReportLink } from '@/components/ReportProblem';

/**
 * Shown when a page crashes, instead of the browser's bare "Application error".
 * The member can try again, go back to their dashboard, or report it in one tap
 * (the crash message is attached automatically).
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[page crash]', error);
  }, [error]);
  const shown = `${error.message || 'The page crashed'}${error.digest ? ` (ref ${error.digest})` : ''}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-2 px-4">
      <div className="max-w-md text-center">
        <Seal size={64} tone="rust"><Icon.Warning size={26} /></Seal>
        <h1 className="mt-5 text-2xl font-bold text-ink">Something went wrong on this page</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Your plan and progress are safe. Try again, or let us know so we can fix it right away.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <button onClick={reset} className="btn-primary !py-2.5 !text-sm">Try again</button>
          <Link href="/dashboard" className="text-sm font-semibold text-forest-700 hover:underline">Back to my dashboard</Link>
          <ReportLink error={shown} label="Report this problem" className="mt-2 !text-sm" />
        </div>
      </div>
    </div>
  );
}
