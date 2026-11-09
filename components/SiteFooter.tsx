import Link from 'next/link';
import { Logo } from '@/components/brand';

export default function SiteFooter() {
  return (
    <footer className="border-t border-paper-line bg-cream px-4 py-9 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
        <Logo size="sm" />
        <nav className="flex items-center gap-6 text-[13px] text-ink-soft">
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
        </nav>
        <p className="text-xs text-ink-faint">© {new Date().getFullYear()} LandEthic.io · All rights reserved</p>
      </div>
    </footer>
  );
}
