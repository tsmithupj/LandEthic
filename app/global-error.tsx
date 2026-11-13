'use client';

import { useState } from 'react';

/**
 * Last-resort crash screen (the whole app failed to load). Plain HTML on purpose —
 * nothing else from the app may be working. Still lets the visitor send a report.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [sent, setSent] = useState<'no' | 'sending' | 'yes' | 'failed'>('no');
  const shown = `${error.message || 'The app crashed'}${error.digest ? ` (ref ${error.digest})` : ''}`;

  const report = async () => {
    setSent('sending');
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: shown,
          message: 'The whole app crashed (reported from the crash screen).',
          page: window.location.pathname,
          details: { browser: navigator.userAgent, screen: `${window.innerWidth}×${window.innerHeight}`, stack: (error.stack ?? '').slice(0, 2000) },
        }),
      });
      setSent(res.ok ? 'yes' : 'failed');
    } catch {
      setSent('failed');
    }
  };

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4EBD9', color: '#2A2116', fontFamily: '-apple-system, system-ui, sans-serif', padding: 16 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: '#6B5D48', margin: '0 0 20px' }}>
            Your plan and progress are safe. Try again, or send us a report so we can fix it right away.
          </p>
          <button onClick={reset} style={{ background: '#3B6D11', color: '#FBF6EC', border: 0, borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Try again
          </button>
          <div style={{ marginTop: 16, fontSize: 14 }}>
            {sent === 'yes' ? (
              <span style={{ color: '#3B6D11', fontWeight: 600 }}>Thanks — we got your report.</span>
            ) : (
              <button onClick={report} disabled={sent === 'sending'} style={{ background: 'none', border: 0, color: '#8F3412', textDecoration: 'underline', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                {sent === 'sending' ? 'Sending…' : sent === 'failed' ? 'Could not send — try again' : 'Report this problem'}
              </button>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
