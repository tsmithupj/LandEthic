'use client';

/**
 * Full-screen waiting screen shown while LandEthic studies a property and
 * builds a plan. Two modes, remembered per browser:
 *   - "watch":    short vertical clips (tips / your own videos) with a live
 *                 status bar on top — swipe or tap through like Shorts.
 *   - "progress": just the progress bar and checklist.
 * When the work finishes during "watch", the clip keeps playing and a
 * "Your plan is ready" bar appears (auto-continues after a short countdown).
 */

import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import type { AnalyzeStage } from '@/lib/store';
import { WAIT_CLIPS, TIP_SECONDS, type WaitClip, type TipIcon } from '@/lib/wait-clips';
import { ContourLines, Icon, Seal, Spinner } from '@/components/brand';

// ── Stages and progress ──────────────────────────────────────────────────

export type Flow = 'new' | 'rebuild' | 'upgrade';
type WorkStage = Exclude<AnalyzeStage, 'idle'>;

interface StageDef {
  key: WorkStage;
  label: string;
  from: number;
  to: number;
  expectedMs: number;
  details: string[];
}

const ANALYZING: Omit<StageDef, 'from' | 'to'> = {
  key: 'analyzing',
  label: 'Studying your land',
  expectedMs: 45_000,
  details: [
    'Pulling up the satellite photo of your land',
    'Looking up your soil type',
    'Checking your plant hardiness zone',
    'Spotting tree lines, fields, and water',
    'Writing up what we found',
  ],
};
const PLANNING: Omit<StageDef, 'from' | 'to'> = {
  key: 'planning',
  label: 'Writing your action plan',
  expectedMs: 90_000,
  details: [
    'Matching tasks to your goals',
    'Picking native plants for your zone',
    'Timing each task to the right season',
    'Marking where each task happens on your map',
    'Scoring each task for impact',
  ],
};
const SAVING: Omit<StageDef, 'from' | 'to'> = {
  key: 'saving',
  label: 'Saving your plan',
  expectedMs: 4_000,
  details: ['Saving your plan'],
};

const FLOWS: Record<Flow, StageDef[]> = {
  new: [
    { ...ANALYZING, from: 0, to: 38 },
    { ...PLANNING, from: 38, to: 95 },
    { ...SAVING, from: 95, to: 99 },
  ],
  rebuild: [
    { ...PLANNING, from: 0, to: 95 },
    { ...SAVING, from: 95, to: 99 },
  ],
  upgrade: [
    { ...PLANNING, from: 0, to: 95 },
    { ...SAVING, from: 95, to: 99 },
  ],
};

const COPY: Record<Flow, { title: string; subtitle: string }> = {
  new: {
    title: 'Analyzing your property',
    subtitle: 'We are studying your land and writing a plan just for it. This usually takes 1 to 3 minutes.',
  },
  rebuild: {
    title: 'Rebuilding your plan',
    subtitle: 'We are writing a fresh plan around your goals. This usually takes 1 to 2 minutes.',
  },
  upgrade: {
    title: 'Expanding your plan',
    subtitle: 'We are adding more tasks, step-by-step how-tos, and time and cost for each — and keeping everything you finished. This usually takes 2 to 3 minutes.',
  },
};

const MODE_KEY = 'landethic_wait_mode';
const READY_COUNTDOWN = 10;

function readMode(): 'watch' | 'progress' {
  try {
    return localStorage.getItem(MODE_KEY) === 'progress' ? 'progress' : 'watch';
  } catch {
    return 'watch';
  }
}
function saveMode(mode: 'watch' | 'progress') {
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* private mode etc. */ }
}

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Live progress: stage-based, eased within each stage, never fakes 100%. */
function useProgress(active: boolean, stage: AnalyzeStage, flow: Flow) {
  const stages = FLOWS[flow];
  const [now, setNow] = useState(() => Date.now());
  const startRef = useRef<number>(Date.now());
  const stageStartRef = useRef<number>(Date.now());
  const lastStageRef = useRef<AnalyzeStage>(stage);

  useEffect(() => {
    if (!active) return;
    startRef.current = Date.now();
    stageStartRef.current = Date.now();
  }, [active]);

  useEffect(() => {
    if (stage !== lastStageRef.current) {
      lastStageRef.current = stage;
      stageStartRef.current = Date.now();
    }
  }, [stage]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);

  const idx = Math.max(0, stages.findIndex((s) => s.key === stage));
  const def = stages[idx];
  const inStage = Math.max(0, now - stageStartRef.current);
  const eased = 1 - Math.exp((-2 * inStage) / def.expectedMs);
  const pct = Math.round(def.from + (def.to - def.from) * eased);
  const detail = def.details[Math.floor(inStage / 5000) % def.details.length];

  return { stages, idx, def, pct, detail, elapsed: Math.max(0, now - startRef.current) };
}

// ── Clip player ──────────────────────────────────────────────────────────

const TIP_ICONS: Record<TipIcon, ComponentType<{ size?: number; className?: string }>> = {
  pin: Icon.Pin, check: Icon.CheckCircle, refresh: Icon.Refresh, chat: Icon.Chat,
  camera: Icon.Camera, leaf: Icon.Leaf, compass: Icon.Compass,
};

function TipCard({ clip }: { clip: Extract<WaitClip, { kind: 'tip' }> }) {
  const TipIconC = TIP_ICONS[clip.icon] ?? Icon.Compass;
  return (
    <div className="relative flex h-full w-full flex-col justify-center overflow-hidden bg-gradient-to-b from-forest-800 via-[#1f4108] to-[#132a05] px-7 text-left">
      <ContourLines className="text-forest-200 opacity-[0.12]" />
      <div className="le-rise relative">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-forest-200/70 bg-forest-200/10 text-forest-200">
          <TipIconC size={30} />
        </div>
        {clip.eyebrow && (
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#F2B48C]">{clip.eyebrow}</p>
        )}
        <h3 className="font-display text-[28px] font-bold leading-[1.1] text-cream">{clip.title}</h3>
        <p className="mt-4 text-[15px] leading-relaxed text-cream/85">{clip.caption}</p>
      </div>
      <p className="absolute bottom-6 left-7 flex items-center gap-1.5 text-xs font-semibold text-forest-200/80">
        <Icon.Compass size={14} /> LandEthic.io tip
      </p>
    </div>
  );
}

function ClipPlayer({ onSkip, statusSlot }: { onSkip: () => void; statusSlot: React.ReactNode }) {
  const clips = WAIT_CLIPS;
  const [i, setI] = useState(0);
  const [clipPct, setClipPct] = useState(0);
  const [muted, setMuted] = useState(true);
  const touchY = useRef<number | null>(null);
  const touchX = useRef<number | null>(null);
  const clip = clips[i % clips.length];

  const next = useCallback(() => { setI((v) => (v + 1) % clips.length); setClipPct(0); }, [clips.length]);
  const prev = useCallback(() => { setI((v) => (v - 1 + clips.length) % clips.length); setClipPct(0); }, [clips.length]);

  // Timer-driven clips (tip cards, YouTube) advance on their own
  useEffect(() => {
    if (clip.kind === 'video') return;
    const total = (clip.kind === 'youtube' ? clip.seconds ?? 30 : TIP_SECONDS) * 1000;
    const start = Date.now();
    const t = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / total);
      setClipPct(p);
      if (p >= 1) next();
    }, 100);
    return () => clearInterval(t);
  }, [clip, next]);

  // Keyboard: arrows to move, Esc to skip videos
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onSkip]);

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative overflow-hidden rounded-2xl bg-black shadow-2xl"
        style={{ height: 'min(640px, calc(100dvh - 250px))', aspectRatio: '9 / 16', maxWidth: 'calc(100vw - 32px)' }}
        onTouchStart={(e) => { touchY.current = e.touches[0].clientY; touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchY.current === null || touchX.current === null) return;
          const dy = e.changedTouches[0].clientY - touchY.current;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) { if (dy < 0) next(); else prev(); }
          else if (Math.abs(dx) > 50) { if (dx < 0) next(); else prev(); }
          touchY.current = touchX.current = null;
        }}
      >
        {/* Status sits on top of the clip */}
        <div className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/75 via-black/45 to-transparent px-3 pb-8 pt-3">
          {/* Story segments: one per clip */}
          <div className="mb-3 flex gap-1">
            {clips.map((c, j) => (
              <div key={c.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full bg-white"
                  style={{ width: j < i ? '100%' : j === i ? `${Math.round(clipPct * 100)}%` : '0%' }}
                />
              </div>
            ))}
          </div>
          {statusSlot}
        </div>

        {/* The clip */}
        <div key={`${clip.id}-${i}`} className="absolute inset-0">
          {clip.kind === 'tip' && <TipCard clip={clip} />}
          {clip.kind === 'video' && (
            <video
              src={clip.src}
              poster={clip.poster}
              autoPlay
              muted={muted}
              playsInline
              onEnded={next}
              onError={next}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration) setClipPct(v.currentTime / v.duration);
              }}
              className="h-full w-full object-cover"
            />
          )}
          {clip.kind === 'youtube' && (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${clip.youtubeId}?autoplay=1&mute=1&playsinline=1&controls=0&loop=1&playlist=${clip.youtubeId}&modestbranding=1&rel=0`}
              title={clip.title}
              allow="autoplay; encrypted-media; picture-in-picture"
              className="pointer-events-none h-full w-full"
            />
          )}
          {clip.kind !== 'tip' && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-5 pt-12">
              <p className="font-display text-lg font-bold leading-tight text-white">{clip.title}</p>
              <p className="mt-1 text-sm leading-snug text-white/85">{clip.caption}</p>
            </div>
          )}
        </div>

        {/* Tap zones: left = back, right = next */}
        <button aria-label="Previous clip" onClick={prev} className="absolute bottom-0 left-0 top-24 z-10 w-1/3" />
        <button aria-label="Next clip" onClick={next} className="absolute bottom-0 right-0 top-24 z-10 w-2/3" />

        {clip.kind === 'video' && (
          <button
            onClick={() => setMuted((m) => !m)}
            className="absolute right-3 top-[92px] z-20 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"
          >
            {muted ? 'Tap for sound' : 'Mute'}
          </button>
        )}

        {/* Desktop arrows */}
        <div className="absolute bottom-4 right-3 z-20 hidden flex-col gap-2 sm:flex">
          <button onClick={prev} aria-label="Previous clip" className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70">
            <Icon.Arrow size={16} className="-rotate-90" />
          </button>
          <button onClick={next} aria-label="Next clip" className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70">
            <Icon.Arrow size={16} className="rotate-90" />
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-white/50">Swipe or tap to see the next tip</p>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export default function WaitScreen({
  active,
  failed = false,
  stage,
  flow,
  onDone,
}: {
  /** True while the work is running. */
  active: boolean;
  /** True if the work ended with an error — the screen just closes. */
  failed?: boolean;
  stage: AnalyzeStage;
  flow: Flow;
  /** Called once the user is ready to see the result. */
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'watch' | 'progress'>('watch');
  const [countdown, setCountdown] = useState<number | null>(null);
  const wasActive = useRef(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const { stages, idx, def, pct, detail, elapsed } = useProgress(active, stage, flow);

  const finish = useCallback(() => {
    setOpen(false);
    setReady(false);
    setCountdown(null);
    onDoneRef.current?.();
  }, []);

  // Open when work starts; when it ends, close (progress / error) or show "ready" (watching)
  useEffect(() => {
    if (active && !wasActive.current) {
      setMode(readMode());
      setReady(false);
      setCountdown(null);
      setOpen(true);
    }
    if (!active && wasActive.current) {
      if (failed) {
        setOpen(false);
      } else if (modeRef.current === 'watch') {
        setReady(true);
        setCountdown(READY_COUNTDOWN);
      } else {
        finish();
      }
    }
    wasActive.current = active;
  }, [active, failed, finish]);

  // Auto-continue countdown once the plan is ready
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { finish(); return; }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, finish]);

  // Lock page scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const chooseMode = (m: 'watch' | 'progress') => {
    setMode(m);
    saveMode(m);
    if (m === 'progress' && ready) finish();
  };

  if (!open) return null;

  const shownPct = ready ? 100 : pct;
  const copy = COPY[flow];

  // ── Watch mode ──
  if (mode === 'watch') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0c1606] px-4 py-4" role="dialog" aria-modal="true" aria-label={copy.title}>
        <ClipPlayer
          onSkip={() => chooseMode('progress')}
          statusSlot={
            <div role="status" aria-live="polite">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-white">
                  {ready ? <Icon.CheckCircle size={14} className="flex-shrink-0 text-forest-200" /> : <Spinner className="h-3.5 w-3.5 flex-shrink-0 text-forest-200" />}
                  <span className="truncate">{ready ? 'Your plan is ready' : `${def.label}…`}</span>
                </span>
                <span className="flex-shrink-0 text-xs font-bold text-forest-200">{shownPct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-forest-200" style={{ width: `${shownPct}%`, transition: 'width 0.4s ease-out' }} />
              </div>
              {!ready && (
                <p className="mt-1.5 truncate text-[11px] text-white/70">
                  {detail} · {formatElapsed(elapsed)}
                </p>
              )}
            </div>
          }
        />

        <div className="mt-3 flex w-full max-w-[360px] flex-col gap-2">
          {ready ? (
            <>
              <button onClick={finish} className="btn-primary w-full !py-3 !text-sm">
                See my plan <Icon.Arrow size={16} />
              </button>
              <button onClick={() => setCountdown(null)} className="text-xs font-medium text-white/70 underline">
                {countdown !== null ? `Opening in ${countdown}s · keep watching` : 'Keep watching — tap "See my plan" when you are done'}
              </button>
            </>
          ) : (
            <button
              onClick={() => chooseMode('progress')}
              className="w-full rounded-[10px] border border-white/25 py-2.5 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10"
            >
              Skip videos and just wait
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Progress-only mode ──
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-cream px-4" role="dialog" aria-modal="true" aria-label={copy.title}>
      <ContourLines className="text-forest-700 opacity-[0.08]" />
      <div className="relative w-full max-w-sm text-center">
        <div className="mb-5"><Seal size={64}><Icon.Compass size={30} /></Seal></div>
        <h2 className="mb-1 text-2xl font-bold text-ink">{copy.title}</h2>
        <p className="mb-7 text-sm text-ink-soft">{copy.subtitle}</p>

        <div role="status" aria-live="polite" className="mb-5 text-left">
          <div className="mb-2 flex items-center justify-between">
            <span className="truncate pr-3 text-xs text-ink-soft">{detail}…</span>
            <span className="flex-shrink-0 text-xs font-bold text-forest-700">{shownPct}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-cream-2">
            <div className="h-full rounded-full bg-forest-600" style={{ width: `${shownPct}%`, transition: 'width 0.4s ease-out' }} />
          </div>
          <p className="mt-2 text-right text-[11px] text-ink-faint">{formatElapsed(elapsed)} elapsed</p>
        </div>

        {/* Stage checklist */}
        <ol className="mb-7 space-y-2 text-left">
          {stages.map((s, j) => {
            const done = j < idx;
            const current = j === idx;
            return (
              <li key={s.key} className={`flex items-center gap-2.5 text-sm ${done ? 'text-forest-700' : current ? 'font-semibold text-ink' : 'text-ink-faint'}`}>
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                  {done ? <Icon.CheckCircle size={18} /> : current ? <Spinner className="h-4 w-4 text-forest-700" /> : <span className="h-2 w-2 rounded-full bg-paper-line" />}
                </span>
                {s.label}
              </li>
            );
          })}
        </ol>

        <button onClick={() => chooseMode('watch')} className="btn-outline w-full !py-2.5 !text-sm">
          <Icon.Camera size={16} /> Watch quick tips while you wait
        </button>
      </div>
    </div>
  );
}
