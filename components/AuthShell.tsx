import Link from 'next/link';
import type { ReactNode } from 'react';
import { ClerkLoading } from '@clerk/nextjs';
import { ContourLines, Icon, Logo, Spinner } from '@/components/brand';

/** Clerk widget styling shared by sign-in and sign-up (Almanac Heritage). */
export const clerkAppearance = {
  elements: {
    rootBox: 'w-full max-w-md',
    cardBox: 'w-full shadow-none',
    card: 'shadow-none border border-paper-line rounded-2xl bg-cream',
    headerTitle: 'hidden',
    headerSubtitle: 'hidden',
    socialButtonsBlockButton:
      'border border-paper-line rounded-xl bg-white hover:bg-cream-2 transition-colors font-medium',
    formButtonPrimary: 'rounded-xl font-semibold py-3 bg-forest-700 hover:bg-forest-800',
    formFieldInput: 'rounded-xl border-paper-line bg-white focus:border-forest-600 focus:ring-forest-600',
    footerActionLink: 'text-forest-700 font-semibold',
  },
};

const POINTS = [
  'A satellite map and soil breakdown of your land',
  'Tasks ranked by how much good they will do',
  'Plain-language steps: what, where, and why',
];

export default function AuthShell({
  title,
  subtitle,
  switchPrompt,
  switchHref,
  switchLabel,
  children,
}: {
  title: string;
  subtitle: string;
  switchPrompt: string;
  switchHref: string;
  switchLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-cream-2">
      {/* Brand panel — large screens only */}
      <aside className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-forest-900 p-12 text-cream lg:flex">
        <ContourLines className="text-forest-200 opacity-[0.14]" />
        <div className="relative">
          <Link href="/" className="flex items-center gap-2.5 text-cream">
            <Icon.Compass size={26} className="text-forest-200" />
            <span className="font-display text-[19px] font-bold">
              <span className="text-forest-200">Land</span>Ethic.io
            </span>
          </Link>
        </div>
        <div className="relative">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-rust-100">
            Field-tested · AI-powered land stewardship
          </p>
          <h2 className="mb-8 text-4xl font-bold leading-tight text-cream">
            Your land. Every species. One plan.
          </h2>
          <ul className="space-y-4">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[15px] text-forest-200">
                <Icon.CheckCircle size={18} className="mt-0.5 flex-shrink-0 text-forest-200" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-forest-200/80">© {new Date().getFullYear()} LandEthic.io</p>
      </aside>

      {/* Form side */}
      <div className="flex flex-1 flex-col">
        <div className="flex h-14 items-center justify-between gap-3 border-b border-paper-line bg-cream px-4 sm:px-6">
          <div className="lg:invisible"><Logo /></div>
          <p className="text-sm text-ink-soft">
            {switchPrompt}{' '}
            <Link href={switchHref} className="font-semibold text-forest-700 hover:text-forest-800">
              {switchLabel}
            </Link>
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-12">
          <div className="mb-7 text-center">
            <span className="eyebrow">LandEthic.io</span>
            <h1 className="mb-2 mt-2 text-3xl font-bold text-ink">{title}</h1>
            <p className="text-sm text-ink-soft">{subtitle}</p>
          </div>
          <div className="flex w-full justify-center">
            <ClerkLoading>
              <div className="card flex h-64 w-full max-w-md flex-col items-center justify-center gap-3 text-sm text-ink-soft">
                <Spinner className="h-5 w-5 text-forest-700" />
                Loading secure sign-in…
              </div>
            </ClerkLoading>
            {children}
          </div>
          <p className="mt-8 max-w-sm text-center text-xs leading-relaxed text-ink-faint">
            By continuing you agree to our{' '}
            <Link href="/terms" className="underline hover:text-ink-soft">Terms</Link> and{' '}
            <Link href="/privacy" className="underline hover:text-ink-soft">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
