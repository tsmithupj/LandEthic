'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, useRef, Suspense, type ComponentType } from 'react';
import { useStore } from '@/lib/store';
import type { ActionTask } from '@/types';
import { TIER_LABELS, formatPrice, planFor } from '@/lib/pricing';
import { TIER_ORDER } from '@/lib/tiers';
import { clipToProperty } from '@/lib/geo';
import WaitScreen from '@/components/WaitScreen';
import MonthlyUpdate from '@/components/MonthlyUpdate';
import { FinishingCheckout, FreePlanBanner, LockedScreen, PaymentIssueBanner, useFinishCheckout } from '@/components/FreePlan';
import WeeklyChecklist from '@/components/WeeklyChecklist';
import SectionNav, { type NavSection } from '@/components/SectionNav';
import AppUserButton from '@/components/AppUserButton';
import AppHeader, { TierTag } from '@/components/AppHeader';
import { Icon, Seal, Spinner } from '@/components/brand';

const DashboardMap = dynamic(() => import('@/components/DashboardMap'), { ssr: false });

type IconComponent = ComponentType<{ size?: number; className?: string }>;

// ─── Sub-components ────────────────────────────────────────────────────────

function ImpactBadge({ score }: { score: number }) {
  const tone =
    score >= 8 ? 'bg-forest-50 text-forest-700 border-forest-200' :
    score >= 6 ? 'bg-rust-100 text-rust-700 border-rust-100' :
                 'bg-cream-2 text-ink-soft border-paper-line';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>
      <Icon.Bolt size={11} />
      {score.toFixed(1)}
    </span>
  );
}

function EcoScoreRing({ score }: { score: number }) {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = circ * (value / 100);
  return (
    // Number inside the ring, label underneath — the label is too wide to fit inside it
    <div className="flex w-24 flex-shrink-0 flex-col items-center" role="img" aria-label={`Land health ${value} out of 100`}>
      <div className="relative h-24 w-24">
        <svg width="96" height="96" className="-rotate-90" viewBox="0 0 96 96" aria-hidden="true">
          <circle cx="48" cy="48" r={r} fill="none" stroke="#EAF3DE" strokeWidth="8" />
          {value > 0 && (
            <circle
              cx="48" cy="48" r={r} fill="none"
              stroke="#3B6D11" strokeWidth="8"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
          <span className="font-display text-[28px] font-bold leading-none text-forest-700">{value}</span>
          <span className="mt-0.5 text-[10px] font-semibold leading-none text-ink-faint">of 100</span>
        </div>
      </div>
      <span className="mt-1.5 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.1em] text-ink-soft" aria-hidden="true">
        Land health
      </span>
    </div>
  );
}

function TaskRow({ task }: { task: ActionTask }) {
  const { completeTask, replaceTask, tier, plan, property, boundary } = useStore();
  const [replacing, setReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const locked = TIER_ORDER.indexOf(task.tier) > TIER_ORDER.indexOf(tier);
  const canReplace = !locked && !task.completed && tier !== 'free';

  const handleAlreadyDone = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!property || !plan) return;
    setReplacing(true);
    setReplaceError(null);
    try {
      const res = await fetch('/api/replace-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedTask: task,
          property,
          existingTasks: plan.tasks.filter((t) => t.id !== task.id),
          boundary: boundary ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({})) as { task?: ActionTask; error?: string };
      if (!res.ok || !data.task) throw new Error(data.error ?? "Couldn't suggest a new task. Try again.");
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.task),
      });
      replaceTask(task.id, data.task);
    } catch (err) {
      setReplaceError(err instanceof Error ? err.message : "Couldn't suggest a new task. Try again.");
      setReplacing(false);
    }
  };

  return (
    <div className={locked ? 'opacity-55' : ''} data-spot={`plan-${task.id}`}>
      <div className="flex items-start gap-3.5 px-4 py-4 transition-colors hover:bg-cream-2 sm:px-5">
        {/* Checkbox */}
        <button
          onClick={() => !locked && completeTask(task.id)}
          disabled={locked}
          aria-label={task.completed ? 'Mark as not done' : 'Mark as done'}
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-[1.5px] transition-colors ${
            task.completed
              ? 'border-forest-700 bg-forest-700 text-cream'
              : 'border-paper-line bg-cream hover:border-forest-600'
          }`}
        >
          {task.completed && <Icon.Check size={13} />}
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <Link
            href={locked ? '/upgrade' : `/dashboard/task/${task.id}`}
            className="block"
          >
            <p className={`text-sm font-semibold leading-snug ${task.completed ? 'text-ink-faint line-through' : 'text-ink'}`}>
              {task.title}
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-soft">
              {task.description}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {locked ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-paper-line bg-cream-2 px-2 py-0.5 text-xs font-medium text-ink-soft">
                  <Icon.Lock size={11} />
                  {TIER_LABELS[task.tier]} plan
                </span>
              ) : (
                <>
                  <ImpactBadge score={task.impactScore} />
                  {task.steps?.length ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-forest-200 bg-forest-50 px-2 py-0.5 text-xs font-medium text-forest-700">
                      <Icon.Check size={11} />
                      {task.steps.filter((st) => st.done).length}/{task.steps.length} steps
                    </span>
                  ) : null}
                  {task.tags.slice(0, 3).map((t) => (
                    <span key={t} className="rounded-full border border-paper-line bg-cream-2 px-2 py-0.5 text-xs text-ink-soft">
                      {t}
                    </span>
                  ))}
                </>
              )}
            </div>
          </Link>

          {/* Already done inline button */}
          {canReplace && (
            <button
              onClick={handleAlreadyDone}
              disabled={replacing}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-forest-200 px-2.5 py-1 text-xs font-medium text-forest-700 transition-colors hover:bg-forest-50 disabled:opacity-60"
            >
              {replacing ? (
                <>
                  <Spinner className="h-3 w-3" /> Finding a new task…
                </>
              ) : (
                <>
                  <Icon.Check size={12} /> Already done — suggest another
                </>
              )}
            </button>
          )}
          {replaceError && <p className="mt-1.5 text-xs text-rust-700">{replaceError}</p>}
        </div>

        <span className="mt-1 flex-shrink-0 text-ink-faint" aria-hidden="true">
          <Icon.Arrow size={14} />
        </span>
      </div>
    </div>
  );
}


// ─── ActionPlanSection: grouped by month/season based on tier ──────────────

const SEASON_ORDER = ['Spring', 'Summer', 'Fall', 'Winter'];
const SEASON_ICON: Record<string, IconComponent> = {
  Spring: Icon.Sprout, Summer: Icon.Sun, Fall: Icon.Leaf, Winter: Icon.Snow,
};

function ActionPlanSection({
  unlockedTasks,
  lockedTasks,
  tier,
}: {
  unlockedTasks: ActionTask[];
  lockedTasks: ActionTask[];
  tier: string;
}) {
  const completedCount = unlockedTasks.filter((t) => t.completed).length;
  const isGrouped = tier === 'steward' || tier === 'naturalist' || tier === 'conservationist';
  const groupByMonth = tier === 'naturalist' || tier === 'conservationist';

  // Build groups
  const groups: { label: string; icon?: IconComponent; tasks: ActionTask[] }[] = [];

  if (isGrouped && unlockedTasks.length > 0) {
    if (groupByMonth) {
      // Group by task.month field (e.g. "June 2026")
      const monthMap = new Map<string, ActionTask[]>();
      for (const t of unlockedTasks) {
        const key = t.month ?? t.season ?? 'Upcoming';
        if (!monthMap.has(key)) monthMap.set(key, []);
        monthMap.get(key)!.push(t);
      }
      // Sort months chronologically — handles "June 2026", "Jul 2026", ISO, etc.
      const MONTHS = ['january','february','march','april','may','june',
                      'july','august','september','october','november','december'];
      const parseMonth = (label: string) => {
        // Try "Month YYYY" format first (e.g. "June 2026")
        const parts = label.trim().split(/\s+/);
        if (parts.length === 2) {
          const mIdx = MONTHS.indexOf(parts[0].toLowerCase());
          const yr = parseInt(parts[1], 10);
          if (mIdx !== -1 && !isNaN(yr)) return yr * 100 + mIdx;
        }
        // Fall back to Date parsing
        const d = new Date(label);
        return isNaN(d.getTime()) ? 999999 : d.getFullYear() * 100 + d.getMonth();
      };
      const now = new Date();
      const nowKey = now.getFullYear() * 100 + now.getMonth();
      // Only include current month and future months
      Array.from(monthMap.entries())
        .filter(([label]) => parseMonth(label) >= nowKey || parseMonth(label) === 999999)
        .sort(([a], [b]) => parseMonth(a) - parseMonth(b))
        .forEach(([label, tasks]) => groups.push({ label, tasks }));
    } else {
      // Group by season for Steward
      const seasonMap = new Map<string, ActionTask[]>();
      for (const t of unlockedTasks) {
        const key = t.season ?? 'Upcoming';
        if (!seasonMap.has(key)) seasonMap.set(key, []);
        seasonMap.get(key)!.push(t);
      }
      // Sort by season order
      SEASON_ORDER.forEach((s) => {
        if (seasonMap.has(s)) {
          groups.push({ label: s, icon: SEASON_ICON[s], tasks: seasonMap.get(s)! });
        }
      });
      // Any tasks with unknown season
      seasonMap.forEach((tasks, label) => {
        if (!SEASON_ORDER.includes(label)) groups.push({ label, tasks });
      });
    }
  } else {
    // Flat for free tier
    groups.push({ label: 'Your 30-day plan', tasks: unlockedTasks });
  }

  const planLabel = tier === 'free'
    ? 'Your 30-day action plan'
    : tier === 'steward'
    ? 'Your yearly action plan'
    : tier === 'naturalist'
    ? 'Your 6-month action plan'
    : 'Your 3-month action plan';

  return (
    <div className="card overflow-hidden">
      {/* Header with overall progress */}
      <div className="flex items-center justify-between gap-4 border-b border-paper-line px-4 py-4 sm:px-5">
        <div>
          <p className="eyebrow">{planLabel}</p>
          <p className="mt-1 text-xs text-ink-soft">
            {completedCount} of {unlockedTasks.length} tasks done
          </p>
        </div>
        {/* Progress scorecard — pills for month-grouped, dots for flat */}
        {groupByMonth && groups.length > 1 ? (
          <div className="flex max-w-[180px] flex-wrap justify-end gap-1.5">
            {groups.map((g) => {
              const done = g.tasks.filter((t) => t.completed).length;
              const all = g.tasks.length;
              const pct = all === 0 ? 0 : Math.round((done / all) * 100);
              const isComplete = done === all && all > 0;
              return (
                <span
                  key={g.label}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    isComplete ? 'bg-forest-50 text-forest-700' : 'bg-cream-2 text-ink-soft'
                  }`}
                  title={`${g.label}: ${done}/${all}`}
                >
                  {g.label.split(' ')[0]} {pct}%
                </span>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {unlockedTasks.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full ${i < completedCount ? 'bg-forest-700' : 'bg-paper-line'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Task groups */}
      {groups.map((group) => {
        const GroupIcon = group.icon;
        return (
          <div key={group.label}>
            {isGrouped && (
              <div className="flex items-center gap-2 border-b border-paper-line bg-cream-2 px-4 py-2.5 sm:px-5">
                {GroupIcon && <GroupIcon size={16} className="text-forest-700" />}
                <p className="font-display text-sm font-bold text-ink">{group.label}</p>
                <span className="ml-auto text-xs text-ink-faint">
                  {group.tasks.filter((t) => t.completed).length}/{group.tasks.length} done
                </span>
              </div>
            )}
            <div className="divide-y divide-paper-line">
              {group.tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Teaser locked task */}
      {lockedTasks.length > 0 && (
        <div className="border-t border-paper-line">
          {lockedTasks.slice(0, 1).map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Insights ──────────────────────────────────────────────────────────────

const INSIGHT_STYLE = {
  positive:    { Icon: Icon.Leaf,    accent: '#639922', soft: '#EAF3DE', text: 'text-forest-700', map: '#97C459' },
  warning:     { Icon: Icon.Warning, accent: '#B5501C', soft: '#F7DDCB', text: 'text-rust-700',   map: '#F08A3E' },
  opportunity: { Icon: Icon.Bulb,    accent: '#0F6E56', soft: '#E1F5EE', text: 'text-teal-700',   map: '#2BD4A0' },
} as const;

// ─── Empty / loading states ────────────────────────────────────────────────

function NoProperty() {
  return (
    <div className="px-6 py-20 text-center">
      <div className="mb-5">
        <Seal size={64}><Icon.Leaf size={28} /></Seal>
      </div>
      <h2 className="mb-2 text-2xl font-bold text-ink">No property yet</h2>
      <p className="mx-auto mb-7 max-w-sm text-sm leading-relaxed text-ink-soft">
        Add your first property and we will build you a land management plan around it.
      </p>
      <Link href="/onboarding" className="btn-primary">
        Get started
        <Icon.Arrow size={18} />
      </Link>
    </div>
  );
}

// ─── Coming back to where you were ─────────────────────────────────────────
// Tapping a task (or any link) remembers the spot; coming back to the dashboard
// (Back button or "Back to plan") scrolls straight to it instead of the top.

const RETURN_KEY = 'landethic_dashboard_spot';
const RETURN_FOR_MS = 30 * 60 * 1000;
const FLASH = ['ring-2', 'ring-inset', 'ring-forest-600'];

interface ReturnSpot { propertyId: string; spot: string | null; y: number; at: number }

function saveReturnSpot(spot: ReturnSpot) {
  try { sessionStorage.setItem(RETURN_KEY, JSON.stringify(spot)); } catch { /* private mode etc. */ }
}

/** Read (and forget) the saved spot, if it's recent and for this property. */
function takeReturnSpot(propertyId: string): ReturnSpot | null {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    const spot = raw ? (JSON.parse(raw) as ReturnSpot) : null;
    if (!spot || spot.propertyId !== propertyId || Date.now() - spot.at > RETURN_FOR_MS) return null;
    return spot;
  } catch {
    return null;
  }
}

function goToSpot(spot: ReturnSpot) {
  const find = () => (spot.spot ? document.querySelector<HTMLElement>(`[data-spot="${CSS.escape(spot.spot)}"]`) : null);
  const place = () => {
    const el = find();
    if (el) el.scrollIntoView({ block: 'center' });
    else window.scrollTo({ top: spot.y });
  };

  // The page can still shift for a moment while the map and lists finish loading —
  // keep it on the spot until the member scrolls or taps themselves.
  let userMoved = false;
  const stop = () => { userMoved = true; };
  const events = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;
  events.forEach((ev) => window.addEventListener(ev, stop, { passive: true }));
  const ro = new ResizeObserver(() => { if (!userMoved) place(); });
  ro.observe(document.body);
  setTimeout(() => {
    ro.disconnect();
    events.forEach((ev) => window.removeEventListener(ev, stop));
  }, 2500);

  place();
  const el = find();
  if (el) {
    el.classList.add(...FLASH); // brief outline so the eye finds it
    setTimeout(() => el.classList.remove(...FLASH), 1800);
  }
}

// ─── Dashboard page ────────────────────────────────────────────────────────

function DashboardPageContent() {
  const router = useRouter();
  const {
    property, plan, insights, boundary, address,
    propertyEntries, activePropertyId, switchProperty,
    tier, access, canAddProperty, reset,
    userGoalsText, setUserGoalsText, regeneratePlan, refreshInsights, isAnalyzing, analyzeStage, analyzeError,
  } = useStore();
  const [editingGoals, setEditingGoals] = useState(false);
  const [refreshingInsights, setRefreshingInsights] = useState(false);
  const [activeInsightIndex, setActiveInsightIndex] = useState<number | null>(null);
  const mapWrapRef = useRef<HTMLDivElement>(null);

  // Reset the selected insight when switching properties or refreshing insights
  useEffect(() => { setActiveInsightIndex(null); }, [activePropertyId, insights]);

  const activeInsight = activeInsightIndex !== null ? insights[activeInsightIndex] : null;
  // Memoized so the map only re-frames when the selected spot actually changes
  const mapHighlight = useMemo(
    () =>
      activeInsight?.area && clipToProperty(activeInsight.area, boundary)
        ? {
            ring: activeInsight.area,
            color: (INSIGHT_STYLE[activeInsight.type] ?? INSIGHT_STYLE.opportunity).map,
            label: activeInsight.zoneLabel ?? activeInsight.title,
          }
        : null,
    [activeInsight, boundary]
  );

  const showInsightOnMap = (i: number) => {
    const next = activeInsightIndex === i ? null : i;
    setActiveInsightIndex(next);
    if (next !== null) mapWrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const [goalsInput, setGoalsInput] = useState('');
  const [regenError, setRegenError] = useState<string | null>(null);

  // Landing here straight from a finished Stripe Checkout — switch the new plan on
  // before showing anything (otherwise a just-paid member could see the locked screen).
  const finishingCheckout = useFinishCheckout();

  // Back from a task page → land on the task that was opened, not the top of the page
  const restoredSpot = useRef(false);
  useEffect(() => {
    if (restoredSpot.current || !property || finishingCheckout || access?.locked) return;
    restoredSpot.current = true;
    const spot = takeReturnSpot(property.id);
    if (spot) setTimeout(() => goToSpot(spot), 60); // after the page has laid out
  }, [property, finishingCheckout, access?.locked]);

  const rememberSpot = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!property || !target.closest('a[href^="/"]')) return;
    const spotEl = target.closest<HTMLElement>('[data-spot]');
    saveReturnSpot({ propertyId: property.id, spot: spotEl?.dataset.spot ?? null, y: window.scrollY, at: Date.now() });
  };

  // Show switcher for tiers that support multiple properties
  const showSwitcher = (tier === 'naturalist' || tier === 'conservationist') && propertyEntries.length > 0;
  const tierLabel = TIER_LABELS[tier];

  if (finishingCheckout) return (
    <div className="min-h-screen bg-cream-2">
      <AppHeader>
        <AppUserButton />
      </AppHeader>
      <FinishingCheckout />
    </div>
  );

  // Free plan (or a cancelled plan) has ended — everything is saved but locked
  if (access?.locked) return (
    <div className="min-h-screen bg-cream-2">
      <AppHeader>
        <AppUserButton />
      </AppHeader>
      <LockedScreen />
    </div>
  );

  if (!property) return (
    <div className="min-h-screen bg-cream-2">
      <AppHeader>
        <AppUserButton />
      </AppHeader>
      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-6"><FreePlanBanner /><PaymentIssueBanner /></div>
      <NoProperty />
    </div>
  );

  const ecosystemScore = property.ecosystemScore ?? 50;
  const userTierIdx = TIER_ORDER.indexOf(tier);
  const freeTasks = plan?.tasks.filter((t) => TIER_ORDER.indexOf(t.tier) <= userTierIdx) ?? [];
  const lockedTasks = plan?.tasks.filter((t) => TIER_ORDER.indexOf(t.tier) > userTierIdx) ?? [];

  const startNewProperty = () => { reset(); router.push('/onboarding'); };

  const sections: NavSection[] = [
    { id: 'overview', label: 'Overview' },
    ...(insights.length > 0 ? [{ id: 'insights', label: 'Property insights' }] : []),
    ...(tier === 'conservationist'
      ? [{ id: 'this-week', label: 'This week' }, { id: 'planners', label: 'Planners' }]
      : []),
    { id: 'action-plan', label: 'Action plan' },
  ];

  // Secondary actions — shown inline in the header on larger screens and as a
  // scrollable row under it on phones.
  const quickActions = (
    <>
      <button
        onClick={async () => { await regeneratePlan(); }}
        disabled={isAnalyzing}
        className="inline-flex flex-shrink-0 items-center gap-1.5 text-xs font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
        title="Regenerate your action plan"
      >
        <Icon.Refresh size={15} /> Refresh plan
      </button>
      <Link
        href="/dashboard/species"
        className="inline-flex flex-shrink-0 items-center gap-1.5 text-xs font-semibold text-forest-700 transition-colors hover:text-forest-800"
      >
        <Icon.Camera size={15} /> Species ID
      </Link>
      {canAddProperty && (
        <button
          onClick={startNewProperty}
          className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-medium text-ink-soft transition-colors hover:text-ink"
          title="Analyze a new property"
        >
          + New property
        </button>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-cream-2" onClickCapture={rememberSpot}>
      <WaitScreen active={isAnalyzing} failed={!!analyzeError} stage={analyzeStage} flow="rebuild" />

      <AppHeader>
        <TierTag label={`${tierLabel} plan`} />
        <div className="hidden items-center gap-4 md:flex">{quickActions}</div>
        <Link href="/upgrade" className="btn-primary !rounded-lg !px-3 !py-1.5 !text-xs">
          {tier === 'free' || tier === 'steward' ? 'Upgrade' : 'Manage plan'}
        </Link>
        <AppUserButton />
      </AppHeader>

      {/* Phone-width action row */}
      <div className="border-b border-paper-line bg-cream md:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-5 overflow-x-auto px-4 py-2.5">{quickActions}</div>
      </div>

      {/* Property switcher — Naturalist / Conservationist only */}
      {showSwitcher && (
        <div className="border-b border-paper-line bg-cream">
          <div className="mx-auto flex max-w-3xl items-center gap-2 overflow-x-auto px-4 py-2">
            {propertyEntries.map((entry) => {
              const isActive = entry.property.id === activePropertyId;
              return (
                <button
                  key={entry.property.id}
                  onClick={() => switchProperty(entry.property.id)}
                  className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                    isActive
                      ? 'border-forest-700 bg-forest-700 text-cream'
                      : 'border-paper-line bg-cream-2 text-ink-soft hover:bg-paper-line'
                  }`}
                >
                  {entry.property.name}
                </button>
              );
            })}
            {canAddProperty && (
              <button
                onClick={startNewProperty}
                className="flex-shrink-0 rounded-full border border-dashed border-paper-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-all hover:bg-cream-2"
              >
                + Add property
              </button>
            )}
          </div>
        </div>
      )}

      {/* Jump to a section without scrolling the whole page */}
      <SectionNav sections={sections} />

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:py-8">
        {analyzeError && !isAnalyzing && (
          <div className="rounded-xl border border-rust-600/40 bg-rust-100 px-4 py-3 text-sm text-rust-700">
            {analyzeError}
          </div>
        )}

        {/* Free plan countdown — every visit */}
        <FreePlanBanner />
        <PaymentIssueBanner />

        {/* Monthly update — Naturalist / Conservationist */}
        <MonthlyUpdate />

        {/* 3D Property Map */}
        <div ref={mapWrapRef} id="overview" className="scroll-mt-28">
        <DashboardMap
          boundary={boundary}
          address={address}
          propertyName={property.name}
          acreage={property.acreage}
          county={property.county}
          state={property.state}
          propertyId={property.id}
          highlight={mapHighlight}
        />
        </div>

        {/* Property header */}
        <div className="card p-5">
          <div className="flex items-start gap-4 sm:gap-5">
            <EcoScoreRing score={ecosystemScore} />
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold leading-tight text-ink">{property.name}</h1>
              <p className="mt-1 text-sm text-ink-soft">
                {property.county}, {property.state} · {property.acreage?.toFixed(1)} acres
              </p>
              {property.soilType && (
                <p className="mt-1 text-xs text-ink-faint">Soil: {property.soilType}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {property.goals.map((g) => (
                  <span key={g} className="tag capitalize">
                    {g.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Goals text — inline editable */}
          <div className="mt-4 border-t border-paper-line pt-4">
            {editingGoals ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  value={goalsInput}
                  onChange={(e) => setGoalsInput(e.target.value)}
                  rows={3}
                  placeholder="e.g. I want to plant food plots and learn where to put white oaks. We have a wet area I want to improve for ducks."
                  className="w-full resize-none rounded-xl border border-paper-line bg-white px-4 py-3 text-sm text-ink placeholder-ink-faint focus:border-forest-600 focus:outline-none"
                />
                {regenError && <p className="text-xs text-rust-700">{regenError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setUserGoalsText(goalsInput);
                      setEditingGoals(false);
                      setRegenError(null);
                      // Pass the new goals straight in — the saved text only updates on the next render
                      const ok = await regeneratePlan(goalsInput);
                      if (!ok) setRegenError('Could not regenerate plan. Try again.');
                    }}
                    disabled={isAnalyzing}
                    className="btn-primary flex-1 !py-2 !text-sm"
                  >
                    {isAnalyzing ? 'Rebuilding your plan…' : 'Save & rebuild plan'}
                  </button>
                  <button
                    onClick={() => { setEditingGoals(false); setRegenError(null); }}
                    className="btn-outline !px-4 !py-2 !text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setGoalsInput(userGoalsText); setEditingGoals(true); }}
                className="group w-full text-left"
              >
                {userGoalsText ? (
                  <div>
                    <p className="eyebrow mb-1.5">Your goals</p>
                    <p className="text-sm leading-relaxed text-ink-soft">{userGoalsText}</p>
                    <p className="mt-1.5 text-xs font-medium text-forest-700 opacity-70 transition-opacity group-hover:opacity-100">Tap to edit &amp; rebuild plan</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-ink-soft transition-colors hover:text-forest-700">
                    <span className="font-bold">+</span>
                    <span>Add your specific goals to get a more personal plan</span>
                  </div>
                )}
              </button>
            )}
          </div>
        </div>

        {/* AI Insights */}
        {insights.length > 0 && (
          <div id="insights" className="card scroll-mt-28 p-5">
            <p className="eyebrow">Property insights</p>
            <p className="mb-4 mt-1 text-xs text-ink-soft">
              What we found on your land, exactly where it is, and what to do about it.
              {insights.some((ins) => clipToProperty(ins.area, boundary)) && ' Tap "Show on map" to see the spot outlined above.'}
            </p>
            {!insights.some((ins) => ins.where && ins.area) && (
              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-paper-line bg-cream-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-relaxed text-ink-soft">
                  Update these insights to get directions to each spot, step-by-step instructions, and the spot outlined on your map.
                </p>
                <button
                  onClick={async () => {
                    setRefreshingInsights(true);
                    await refreshInsights();
                    setRefreshingInsights(false);
                  }}
                  disabled={refreshingInsights || isAnalyzing}
                  className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-lg bg-forest-700 px-3 py-2 text-xs font-semibold text-cream transition-colors hover:bg-forest-800 disabled:opacity-60"
                >
                  {refreshingInsights ? <Spinner className="h-3.5 w-3.5" /> : <Icon.Refresh size={14} />}
                  {refreshingInsights ? 'Studying your land…' : 'Update insights'}
                </button>
              </div>
            )}
            <div className="space-y-3">
              {insights.map((insight, i) => {
                const style = INSIGHT_STYLE[insight.type] ?? INSIGHT_STYLE.opportunity;
                const InsightIcon = style.Icon;
                const steps = (insight.steps ?? []).filter(Boolean);
                const isActive = activeInsightIndex === i;
                const canShow = !!clipToProperty(insight.area, boundary);
                return (
                  <div
                    key={i}
                    className="flex w-full gap-3 rounded-r-xl border border-l-[3px] p-4 text-left transition-colors"
                    style={{
                      borderLeftColor: style.accent,
                      borderTopColor: isActive ? style.accent : '#E1D3B3',
                      borderRightColor: isActive ? style.accent : '#E1D3B3',
                      borderBottomColor: isActive ? style.accent : '#E1D3B3',
                      background: isActive ? style.soft : '#FBF6EC',
                    }}
                  >
                    <span className={`mt-0.5 flex-shrink-0 ${style.text}`}>
                      <InsightIcon size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                        <p className="text-sm font-semibold text-ink">{insight.title}</p>
                        {insight.zoneLabel && (
                          <span
                            className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.text}`}
                            style={{ background: style.soft }}
                          >
                            <Icon.Pin size={11} />
                            {insight.zoneLabel}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-ink-soft">{insight.description}</p>

                      {insight.where && (
                        <div className="mt-3">
                          <p className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${style.text}`}>
                            <Icon.Pin size={12} />
                            Where
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-ink">{insight.where}</p>
                        </div>
                      )}

                      {canShow && (
                        <button
                          onClick={() => showInsightOnMap(i)}
                          aria-pressed={isActive}
                          className={`mt-2.5 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${style.text}`}
                          style={{ borderColor: style.accent, background: isActive ? '#FBF6EC' : style.soft }}
                        >
                          <Icon.Pin size={13} />
                          {isActive ? 'Hide on map' : 'Show on map'}
                        </button>
                      )}

                      {steps.length > 0 && (
                        <div className="mt-3">
                          <p className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${style.text}`}>
                            <Icon.Check size={12} />
                            What to do
                          </p>
                          <ol className="mt-1.5 space-y-1.5">
                            {steps.map((step, j) => (
                              <li key={j} className="flex gap-2 text-xs leading-relaxed text-ink">
                                <span
                                  className={`mt-px flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${style.text}`}
                                  style={{ background: style.soft }}
                                >
                                  {j + 1}
                                </span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Plan summary */}
        {plan?.summary && (
          <div className="rounded-2xl border border-forest-200 bg-forest-50 p-5">
            <p className="mb-1.5 font-display text-base font-bold text-forest-800">Your plan summary</p>
            <p className="text-sm leading-relaxed text-forest-800">{plan.summary}</p>
          </div>
        )}

        {/* This week's checklist + habitat planners — Conservationist */}
        {tier === 'conservationist' && <div id="this-week" className="scroll-mt-28"><WeeklyChecklist /></div>}
        {tier === 'conservationist' && (
          <div id="planners" className="grid scroll-mt-28 gap-3 sm:grid-cols-2">
            {[
              { href: '/dashboard/food-plots', Icon: Icon.Sprout, title: 'Food plot planner', text: 'What to plant, how much seed, and where each plot goes.' },
              { href: '/dashboard/nesting-boxes', Icon: Icon.Bird, title: 'Nesting box planner', text: 'Which boxes to put up, how high, and exactly where.' },
            ].map(({ href, Icon: TileIcon, title, text }) => (
              <Link key={href} href={href} data-spot={`tile-${href}`} className="card group flex items-start gap-3 p-4 transition-colors hover:bg-cream-2">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-forest-50 text-forest-700">
                  <TileIcon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-sm font-bold text-ink group-hover:text-forest-700">{title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{text}</span>
                </span>
                <span className="mt-1 text-ink-faint"><Icon.Arrow size={14} /></span>
              </Link>
            ))}
          </div>
        )}

        {/* Action plan — grouped by month (Naturalist/Conservationist) or season (Steward) or flat (Free) */}
        <div id="action-plan" className="scroll-mt-28">
          <ActionPlanSection
            unlockedTasks={freeTasks}
            lockedTasks={lockedTasks}
            tier={tier}
          />
        </div>

        {/* Upgrade CTA — only shown for free/steward, points at the next tier */}
        {(tier === 'free' || tier === 'steward') && (
          <Link
            href="/upgrade"
            className="block rounded-2xl border-[1.5px] border-rust-600 bg-rust-100 p-5 transition-colors hover:bg-[#F3D2BC]"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-display text-base font-bold text-rust-700">
                  {tier === 'free' ? 'Unlock your full-year action plan' : 'Get a month-by-month plan'}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-rust-700">
                  {tier === 'free'
                    ? `Steward is ${formatPrice(planFor('steward').yearly)}/year — a full year of tasks season by season, 20 plant and animal IDs a month, and a plan rebuild every month.`
                    : `Naturalist is ${formatPrice(planFor('naturalist').yearly)}/year — a month-by-month task calendar, fresh tasks every month, and up to 3 properties.`}
                </p>
              </div>
              <span className="flex-shrink-0 text-rust-700"><Icon.Arrow size={22} /></span>
            </div>
          </Link>
        )}
        {tier === 'naturalist' && (
          <Link
            href="/upgrade"
            className="block rounded-2xl border-[1.5px] border-rust-600 bg-rust-100 p-5 transition-colors hover:bg-[#F3D2BC]"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-display text-base font-bold text-rust-700">Plan food plots and nest boxes</p>
                <p className="mt-1 text-sm leading-relaxed text-rust-700">
                  Conservationist is {formatPrice(planFor('conservationist').yearly)}/year — a food plot planner with seed picks and
                  rates, a nesting box planner, weekly checklists, and up to 10 properties.
                </p>
              </div>
              <span className="flex-shrink-0 text-rust-700"><Icon.Arrow size={22} /></span>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageContent />
    </Suspense>
  );
}
