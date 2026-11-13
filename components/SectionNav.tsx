'use client';

import { useEffect, useRef, useState } from 'react';

export interface NavSection {
  /** id of the element on the page to jump to */
  id: string;
  label: string;
}

/** Space taken by the sticky app header + this bar, so jumps don't land under them. */
const STICKY_OFFSET = 112;

/**
 * Sticky row of section chips under the app header ("Overview · Insights · Action plan").
 * Tapping one scrolls straight to that section; the chip for the section on screen
 * is highlighted as the member scrolls.
 */
export default function SectionNav({ sections }: { sections: NavSection[] }) {
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);
  const rowRef = useRef<HTMLDivElement>(null);
  const jumpingUntil = useRef(0);
  const key = sections.map((s) => s.id).join('|');

  // Highlight the section currently at the top of the screen
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (Date.now() < jumpingUntil.current) return; // let a tapped jump finish first
      let current = sections[0]?.id ?? null;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top - STICKY_OFFSET - 24 <= 0) current = s.id;
      }
      // At the very bottom, the last section counts even if its top never reaches the bar
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = sections[sections.length - 1]?.id ?? current;
      }
      setActive(current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Keep the highlighted chip visible in the row on narrow phones
  useEffect(() => {
    const row = rowRef.current;
    const chip = active ? row?.querySelector<HTMLElement>(`[data-section="${active}"]`) : null;
    if (!row || !chip) return;
    const left = chip.offsetLeft - 16;
    const right = chip.offsetLeft + chip.offsetWidth + 16 - row.clientWidth;
    if (row.scrollLeft > left) row.scrollTo({ left, behavior: 'smooth' });
    else if (row.scrollLeft < right) row.scrollTo({ left: right, behavior: 'smooth' });
  }, [active]);

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id);
    jumpingUntil.current = Date.now() + 900;
    const top = id === sections[0]?.id ? 0 : el.getBoundingClientRect().top + window.scrollY - STICKY_OFFSET;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };

  if (sections.length < 2) return null;

  return (
    <div className="sticky top-14 z-30 border-b border-paper-line bg-cream/95 backdrop-blur">
      <div
        ref={rowRef}
        className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Jump to a section"
      >
        {sections.map((s) => {
          const isActive = s.id === active;
          return (
            <button
              key={s.id}
              data-section={s.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => jump(s.id)}
              className={`flex-shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? 'border-forest-700 bg-forest-700 text-cream'
                  : 'border-paper-line bg-cream-2 text-ink-soft hover:border-forest-600 hover:text-forest-700'
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
