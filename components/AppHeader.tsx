import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, Logo } from '@/components/brand';

/**
 * Shared top bar for the signed-in app pages (Almanac Heritage style).
 *
 * - With `back`, shows a "← Back to …" link on the left and the logo on the right.
 * - Without it, shows the logo on the left and any `children` (actions) on the right.
 */
export default function AppHeader({
  back,
  children,
  width = 'max-w-3xl',
}: {
  back?: { href: string; label: string };
  children?: ReactNode;
  width?: string;
}) {
  return (
    <nav className="sticky top-0 z-40 border-b border-paper-line bg-cream/95 backdrop-blur">
      <div className={`mx-auto flex h-14 ${width} items-center justify-between gap-3 px-4`}>
        {back ? (
          <Link
            href={back.href}
            className="flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <Icon.Arrow size={16} className="rotate-180" />
            {back.label}
          </Link>
        ) : (
          <Logo />
        )}
        {children ? (
          <div className="flex items-center gap-2 sm:gap-3">{children}</div>
        ) : back ? (
          <Logo size="sm" />
        ) : null}
      </div>
    </nav>
  );
}

/** Small uppercase plan badge used in headers. */
export function TierTag({ label }: { label: string }) {
  return (
    <span className="hidden rounded-full border border-paper-line bg-cream-2 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-soft sm:inline-block">
      {label}
    </span>
  );
}
