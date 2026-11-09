import Link from 'next/link';
import type { SVGProps } from 'react';

// ─── Almanac Heritage brand pieces ─────────────────────────────────────────
// Line icons and seals stand in for emoji throughout the app (per the design).

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...rest,
  };
}

export const Icon = {
  Compass: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={1.6}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.2 8.8l-1.6 4-4 1.6 1.6-4 4-1.6z" fill="currentColor" stroke="none" />
    </svg>
  ),
  Sprout: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M12 21V12" /><path d="M12 12C12 8 9 5 5 5c0 4 3 7 7 7z" /><path d="M12 12c0-4 3-7 7-7 0 4-3 7-7 7z" />
    </svg>
  ),
  Antler: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M12 21V11" /><path d="M12 11c-1-3-1-6 0-8" /><path d="M12 11c1-3 1-6 0-8" />
      <path d="M9.5 5c1 0 1.6.8 1.7 1.8" /><path d="M14.5 5c-1 0-1.6.8-1.7 1.8" />
    </svg>
  ),
  Bird: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M3 13c3-5 9-7 13-4 1.6 1.1 2.6 1.4 5-.3-.6 2.4-2.2 3.6-4 3.9 1 2 .8 4.6-.6 6.4-2-.4-3.6-1.7-4.4-3.6-2.6.8-5.2.2-6.7-2.1z" />
    </svg>
  ),
  Flower: (p: IconProps) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 4.5c1.5 0 2.7 1.6 2 3.4-1.7-1-3-1-4.5 0-.7-1.8.5-3.4 2.5-3.4z" />
      <path d="M12 19.5c1.5 0 2.7-1.6 2-3.4-1.7 1-3 1-4.5 0-.7 1.8.5 3.4 2.5 3.4z" />
      <path d="M4.5 12c0-1.5 1.6-2.7 3.4-2-1 1.7-1 3 0 4.5-1.8.7-3.4-.5-3.4-2.5z" />
      <path d="M19.5 12c0-1.5-1.6-2.7-3.4-2 1 1.7 1 3 0 4.5 1.8.7 3.4-.5 3.4-2.5z" />
    </svg>
  ),
  Drop: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M12 3s6.5 7.5 6.5 12A6.5 6.5 0 0 1 5.5 15C5.5 10.5 12 3 12 3z" />
    </svg>
  ),
  Leaf: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M4 20c9-1 15-8 16-17-10 1-16 8-16 17z" /><path d="M7.5 16.5c3-3 6.5-6.5 9-9" />
    </svg>
  ),
  Turkey: (p: IconProps) => (
    <svg {...base(p)}>
      <circle cx="9" cy="14" r="4" /><path d="M13 14c3 0 6-2 7-5" /><path d="M13 11c2-1 4-3 4-6" />
      <path d="M11 10.5C11 8 12 5 14 3" /><path d="M9 18v3" />
    </svg>
  ),
  Lizard: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M4 18c3 0 4-3 6-5s5-3 7-6c1-1.5 3-2 3-2" /><path d="M8 13l-2-2M11 11l1-3M10 15l2 2M14 12l2 2" />
    </svg>
  ),
  Warning: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M12 4 2 20h20L12 4z" /><path d="M12 10v5" /><path d="M12 17.5v.01" />
    </svg>
  ),
  Bulb: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M9 18h6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-3 11c1 .7 1 1.5 1 2h4c0-.5 0-1.3 1-2a6 6 0 0 0-3-11z" />
    </svg>
  ),
  Sun: (p: IconProps) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </svg>
  ),
  Snow: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11" /><path d="M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5" />
    </svg>
  ),
  Camera: (p: IconProps) => (
    <svg {...base(p)}>
      <rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7l1.5-2.5h5L16 7" /><circle cx="12" cy="13.5" r="3.5" />
    </svg>
  ),
  Refresh: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M4 12a8 8 0 0 1 14-5.3L20 8" /><path d="M20 4v4h-4" /><path d="M20 12a8 8 0 0 1-14 5.3L4 16" /><path d="M4 20v-4h4" />
    </svg>
  ),
  Lock: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={2}>
      <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  Check: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={2.5}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  ),
  CheckCircle: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={2}>
      <circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" />
    </svg>
  ),
  Arrow: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M4 12h16" /><path d="M14 6l6 6-6 6" />
    </svg>
  ),
  Bolt: (p: IconProps) => (
    <svg {...base(p)} fill="currentColor" stroke="none">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  ),
  Pin: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
    </svg>
  ),
  Chat: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M4 5h16v11H9l-5 4V5z" />
    </svg>
  ),
  Mushroom: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M3 12a9 7 0 0 1 18 0H3z" /><path d="M10 12v6a2 2 0 0 0 4 0v-6" />
    </svg>
  ),
  Bug: (p: IconProps) => (
    <svg {...base(p)}>
      <rect x="8" y="7" width="8" height="12" rx="4" /><path d="M12 7v12M9 4l1.5 3M15 4l-1.5 3M4 11h4M16 11h4M4 16h4M16 16h4" />
    </svg>
  ),
  Fish: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M3 12c3-5 10-6 14 0-4 6-11 5-14 0z" /><path d="M17 12l4-3v6l-4-3z" /><circle cx="8" cy="11" r=".6" fill="currentColor" />
    </svg>
  ),
  Paw: (p: IconProps) => (
    <svg {...base(p)}>
      <circle cx="7" cy="9" r="1.6" /><circle cx="11" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="18" cy="9.5" r="1.6" />
      <path d="M8 16c0-3 2-5 4.5-5s4.5 2 4.5 5c0 2-2 3-4.5 3S8 18 8 16z" />
    </svg>
  ),
  Card: (p: IconProps) => (
    <svg {...base(p)}>
      <rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10.5h18" /><path d="M7 15h4" />
    </svg>
  ),
  Search: (p: IconProps) => (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" />
    </svg>
  ),
};

/** Seal-style circular badge holding an icon — used where emoji used to be. */
export function Seal({
  children,
  tone = 'forest',
  size = 56,
}: {
  children: React.ReactNode;
  tone?: 'forest' | 'rust' | 'teal';
  size?: number;
}) {
  const tones = {
    forest: 'border-forest-700 text-forest-700 bg-forest-50',
    rust:   'border-rust-700 text-rust-700 bg-rust-100',
    teal:   'border-teal-700 text-teal-700 bg-teal-50',
  };
  return (
    <div
      className={`mx-auto flex items-center justify-center rounded-full border-2 ${tones[tone]}`}
      style={{ width: size, height: size }}
    >
      {children}
    </div>
  );
}

export function Logo({ href = '/', size = 'md' }: { href?: string; size?: 'sm' | 'md' | 'lg' }) {
  const text = size === 'lg' ? 'text-[19px]' : size === 'sm' ? 'text-[15px]' : 'text-[17px]';
  const icon = size === 'lg' ? 26 : size === 'sm' ? 20 : 24;
  return (
    <Link href={href} className="flex items-center gap-2.5 text-ink">
      <Icon.Compass size={icon} className="text-forest-700" />
      <span className={`font-display font-bold ${text}`}>
        <span className="text-forest-700">Land</span>Ethic.io
      </span>
    </Link>
  );
}

/** Faint topographic contour lines for hero / callout backgrounds. */
export function ContourLines({ className = '', color = 'currentColor' }: { className?: string; color?: string }) {
  return (
    <svg
      viewBox="0 0 1440 500"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
    >
      {[0, 70, 140, 210, 280].map((y) => (
        <path
          key={y}
          d={`M-50,${90 + y} C 260,${20 + y} 480,${150 + y} 760,${70 + y} C 1040,${-10 + y} 1260,${100 + y} 1490,${50 + y}`}
          fill="none"
          stroke={color}
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

/** Spinner in brand colors. */
export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}
