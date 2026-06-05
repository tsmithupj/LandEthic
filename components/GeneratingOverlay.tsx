'use client';

import { useEffect, useRef, useState } from 'react';

const STEPS = [
  { label: 'Looking up your soil and land data',       target: 18 },
  { label: 'Figuring out what lives and grows there',  target: 38 },
  { label: 'Checking animals and plants in your area', target: 56 },
  { label: 'Building a picture of your land',          target: 74 },
  { label: 'Writing out your action plan',             target: 92 },
];

const TOTAL_MS = 22000;

export default function GeneratingOverlay({ visible }: { visible: boolean }) {
  const [pct, setPct]         = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const rafRef                = useRef<number | null>(null);
  const startRef              = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) {
      setPct(0);
      setStepIdx(0);
      startRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    function tick(now: number) {
      if (!startRef.current) startRef.current = now;
      const elapsed = now - startRef.current;
      const linear  = Math.min(elapsed / TOTAL_MS, 1);
      const eased   = 1 - Math.pow(1 - linear, 2.4);
      const next    = Math.min(Math.round(eased * 92), 92);

      setPct(next);
      const newStep = STEPS.findIndex((s) => next < s.target);
      setStepIdx(newStep === -1 ? STEPS.length - 1 : Math.max(0, newStep));

      if (next < 92) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [visible]);

  if (!visible) return null;

  const currentLabel = STEPS[stepIdx]?.label ?? STEPS[STEPS.length - 1].label;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="w-full max-w-sm px-8 text-center">
        <div
          className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#EAF3DE' }}
        >
          <span className="text-3xl">🌿</span>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-1">
          Rebuilding your plan
        </h2>
        <p className="text-gray-400 text-sm mb-8">
          We are tailoring your action plan around your updated goals. This takes about 20 seconds.
        </p>

        <div className="mb-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-500 truncate pr-3">{currentLabel}…</span>
            <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#3B6D11' }}>
              {pct}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                backgroundColor: '#639922',
                transition: 'width 0.4s ease-out',
              }}
            />
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          We are using your goals, soil data, and local wildlife info to write tasks specific to your land.
        </p>
      </div>
    </div>
  );
}
