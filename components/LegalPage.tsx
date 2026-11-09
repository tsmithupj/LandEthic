import Link from 'next/link';
import type { ReactNode } from 'react';
import AppHeader from '@/components/AppHeader';
import SiteFooter from '@/components/SiteFooter';
import { ContourLines, Icon } from '@/components/brand';
import { CONTACT_EMAIL, LEGAL_DRAFT, LEGAL_LAST_UPDATED } from '@/lib/legal';

/** Shared shell for /privacy and /terms. */
export default function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  sections: { id: string; title: string; body: ReactNode }[];
}) {
  return (
    <div className="min-h-screen bg-cream">
      <AppHeader width="max-w-5xl">
        <Link href="/" className="text-sm font-medium text-ink-soft transition-colors hover:text-ink">
          Home
        </Link>
        <Link href="/sign-up" className="btn-primary !rounded-lg !px-3.5 !py-2 !text-xs sm:!text-sm">
          Get started free
        </Link>
      </AppHeader>

      <header className="relative overflow-hidden border-b border-paper-line bg-cream-2 px-4 py-12 sm:px-6 sm:py-16">
        <ContourLines className="text-forest-700 opacity-[0.1]" />
        <div className="relative mx-auto max-w-3xl">
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="mb-4 mt-3 text-4xl font-bold text-ink sm:text-5xl">{title}</h1>
          <p className="text-sm text-ink-faint">Last updated {LEGAL_LAST_UPDATED}</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
        {/* Contents */}
        <nav aria-label="On this page" className="mb-10 hidden lg:block">
          <div className="sticky top-20">
            <p className="eyebrow mb-3">On this page</p>
            <ol className="space-y-2 border-l border-paper-line text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="-ml-px block border-l border-transparent pl-3 text-ink-soft transition-colors hover:border-forest-700 hover:text-ink">
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <article className="min-w-0 max-w-3xl">
          {LEGAL_DRAFT && (
            <div className="mb-8 flex gap-3 rounded-r-xl border border-l-[3px] border-paper-line border-l-rust-600 bg-rust-100 p-4 text-sm text-rust-700">
              <Icon.Warning size={18} className="mt-0.5 flex-shrink-0" />
              <p>
                <strong>Draft.</strong> This page is being reviewed and may change before LandEthic.io fully launches.
                Questions? Email <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              </p>
            </div>
          )}

          <div className="legal-prose">{intro}</div>

          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-20 border-t border-paper-line pt-8 mt-8">
              <h2 className="mb-4 text-xl font-bold text-ink sm:text-2xl">
                <span className="mr-2 font-display text-forest-700">{i + 1}.</span>
                {s.title}
              </h2>
              <div className="legal-prose">{s.body}</div>
            </section>
          ))}
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
