'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { ActionTask } from '@/types';
import type { InsightZone } from '@/lib/store';
import GeneratingOverlay from '@/components/GeneratingOverlay';

const DashboardMap = dynamic(() => import('@/components/DashboardMap'), { ssr: false });

// ─── Sub-components ────────────────────────────────────────────────────────

function ImpactBadge({ score }: { score: number }) {
  const color =
    score >= 8 ? { bg: '#EAF3DE', text: '#3B6D11' } :
    score >= 6 ? { bg: '#FAEEDA', text: '#633806' } :
                 { bg: '#F1EFE8', text: '#5F5E5A' };
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: color.bg, color: color.text }}
    >
      ⚡ {score.toFixed(1)}
    </span>
  );
}

function EcoScoreRing({ score }: { score: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg width="96" height="96" className="-rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#EAF3DE" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          stroke="#639922" strokeWidth="8"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold" style={{ color: '#3B6D11' }}>{score}</span>
        <span className="text-xs text-gray-400">land health</span>
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: ActionTask }) {
  const { completeTask, replaceTask, tier, plan, property } = useStore();
  const [replacing, setReplacing] = useState(false);
  const TIER_ORDER = ['free', 'steward', 'naturalist', 'conservationist'];
  const userTierIdx = TIER_ORDER.indexOf(tier);
  const taskTierIdx = TIER_ORDER.indexOf(task.tier);
  const locked = taskTierIdx > userTierIdx;
  const canReplace = !locked && !task.completed && tier !== 'free';

  const handleAlreadyDone = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!property || !plan) return;
    setReplacing(true);
    try {
      const res = await fetch('/api/replace-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedTask: task,
          property,
          existingTasks: plan.tasks.filter((t) => t.id !== task.id),
          tier,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { task: ActionTask };
      replaceTask(task.id, data.task);
    } catch {
      setReplacing(false);
    }
  };

  return (
    <div className={locked ? 'opacity-50' : ''}>
      <div className="flex items-start gap-3.5 px-5 py-4 hover:bg-gray-50 transition-colors">
        {/* Checkbox */}
        <button
          onClick={() => completeTask(task.id)}
          className={`w-5 h-5 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
            task.completed
              ? 'bg-[#3B6D11] border-[#3B6D11]'
              : 'border-gray-300 hover:border-[#639922]'
          }`}
        >
          {task.completed && <span className="text-white text-xs">✓</span>}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Link
            href={locked ? '/upgrade' : `/dashboard/task/${task.id}`}
            className="block"
          >
            <p className={`text-sm font-medium leading-snug ${task.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {task.title}
            </p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
              {task.description}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {locked ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                  🔒 {task.tier.charAt(0).toUpperCase() + task.tier.slice(1)} plan
                </span>
              ) : (
                <>
                  <ImpactBadge score={task.impactScore} />
                  {task.tags.slice(0, 3).map((t) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
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
              className="mt-2 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50"
              style={{ borderColor: '#C0DD97', color: '#3B6D11' }}
            >
              {replacing ? 'Finding a new task…' : '✓ Already done — suggest another'}
            </button>
          )}
        </div>

        <span className="text-gray-300 text-sm flex-shrink-0 mt-1">›</span>
      </div>
    </div>
  );
}


// ─── ActionPlanSection: grouped by month/season based on tier ──────────────

const SEASON_ORDER = ['Spring', 'Summer', 'Fall', 'Winter'];
const SEASON_EMOJI: Record<string, string> = {
  Spring: '🌱', Summer: '☀️', Fall: '🍂', Winter: '❄️',
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
  const groups: { label: string; emoji?: string; tasks: ActionTask[] }[] = [];

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
          groups.push({ label: s, emoji: SEASON_EMOJI[s], tasks: seasonMap.get(s)! });
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
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header with overall progress */}
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {planLabel}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {completedCount} of {unlockedTasks.length} tasks complete
          </p>
        </div>
        {/* Progress scorecard — pills for month-grouped, dots for flat */}
        {groupByMonth && groups.length > 1 ? (
          <div className="flex flex-wrap gap-1.5 justify-end max-w-[180px]">
            {groups.map((g) => {
              const done = g.tasks.filter((t) => t.completed).length;
              const all = g.tasks.length;
              const pct = all === 0 ? 0 : Math.round((done / all) * 100);
              const isComplete = done === all && all > 0;
              return (
                <span
                  key={g.label}
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: isComplete ? '#EAF3DE' : '#F1EFE8',
                    color: isComplete ? '#3B6D11' : '#5F5E5A',
                  }}
                  title={`${g.label}: ${done}/${all}`}
                >
                  {g.label.split(' ')[0]} {pct}%
                </span>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {unlockedTasks.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i < completedCount ? 'bg-[#3B6D11]' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Task groups */}
      {groups.map((group, gi) => (
        <div key={group.label}>
          {isGrouped && (
            <div
              className="px-5 py-2.5 flex items-center gap-2 border-b border-gray-50"
              style={{ backgroundColor: '#FAFAF9' }}
            >
              {group.emoji && <span className="text-sm">{group.emoji}</span>}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {group.label}
              </p>
              <span className="text-xs text-gray-400 ml-auto">
                {group.tasks.filter((t) => t.completed).length}/{group.tasks.length} done
              </span>
            </div>
          )}
          <div className="divide-y divide-gray-50">
            {group.tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
          {gi < groups.length - 1 && <div className="h-px bg-gray-100" />}
        </div>
      ))}

      {/* Teaser locked task */}
      {lockedTasks.length > 0 && (
        <div className="border-t border-gray-100">
          {lockedTasks.slice(0, 1).map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Empty / loading states ────────────────────────────────────────────────

function NoProperty() {
  return (
    <div className="text-center py-20 px-6">
      <div className="text-5xl mb-4">🌿</div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">No property yet</h2>
      <p className="text-sm text-gray-500 mb-6">
        Add your first property and we will build you a land management plan around it.
      </p>
      <Link
        href="/onboarding"
        className="inline-block text-sm font-semibold text-white px-6 py-3 rounded-xl"
        style={{ backgroundColor: '#3B6D11' }}
      >
        Get started →
      </Link>
    </div>
  );
}

// ─── Dashboard page ────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const {
    property, plan, insights, boundary, address,
    propertyEntries, activePropertyId, switchProperty,
    tier, canAddProperty, reset,
    userGoalsText, setUserGoalsText, analyzeAndPlan, regeneratePlan, isAnalyzing,
  } = useStore();
  const [activeInsightIndex, setActiveInsightIndex] = useState<number | null>(null);
  const [editingGoals, setEditingGoals] = useState(false);
  const [goalsInput, setGoalsInput] = useState('');
  const [regenError, setRegenError] = useState<string | null>(null);

  const activeInsight = activeInsightIndex !== null ? insights[activeInsightIndex] : null;
  const activeZone = (activeInsight?.zone ?? null) as InsightZone | null;
  const activeZoneLabel = activeInsight?.zoneLabel ?? null;
  const activeZoneType = activeInsight?.type ?? null;

  // Show switcher for tiers that support multiple properties
  const showSwitcher = (tier === 'naturalist' || tier === 'conservationist') && propertyEntries.length > 0;
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  if (!property) return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-base font-semibold">
            <span style={{ color: '#3B6D11' }}>Land</span>Ethic.io
          </Link>
        </div>
      </nav>
      <NoProperty />
    </div>
  );

  const ecosystemScore = property.ecosystemScore ?? 50;
  const TIER_ORDER_DASH = ['free', 'steward', 'naturalist', 'conservationist'];
  const userTierIdx = TIER_ORDER_DASH.indexOf(tier);
  const freeTasks = plan?.tasks.filter((t) => TIER_ORDER_DASH.indexOf(t.tier) <= userTierIdx) ?? [];
  const lockedTasks = plan?.tasks.filter((t) => TIER_ORDER_DASH.indexOf(t.tier) > userTierIdx) ?? [];
  const completedCount = freeTasks.filter((t) => t.completed).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <GeneratingOverlay visible={isAnalyzing} />
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-base font-semibold">
            <span style={{ color: '#3B6D11' }}>Land</span>Ethic.io
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden sm:block">{tierLabel} plan</span>
            {tier === 'free' || tier === 'steward' ? (
              <Link
                href="/upgrade"
                className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: '#3B6D11' }}
              >
                Upgrade
              </Link>
            ) : null}
            {property && (
              <button
                onClick={async () => { await regeneratePlan(); }}
                disabled={isAnalyzing}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors hidden sm:block disabled:opacity-40"
                title="Regenerate your action plan"
              >
                ↺ Refresh plan
              </button>
            )}
            {property && tier !== 'free' && (
              <Link
                href="/dashboard/species"
                className="text-xs font-medium hidden sm:block transition-colors"
                style={{ color: '#3B6D11' }}
              >
                🔍 Species ID
              </Link>
            )}
            {canAddProperty ? (
              <button
                onClick={() => { reset(); router.push('/onboarding'); }}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors hidden sm:block"
                title="Analyze a new property"
              >
                + New property
              </button>
            ) : null}
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </nav>

      {/* Property switcher — Naturalist / Conservationist only */}
      {showSwitcher && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-3xl mx-auto px-4 py-2 flex items-center gap-2 overflow-x-auto">
            {propertyEntries.map((entry) => {
              const isActive = entry.property.id === activePropertyId;
              return (
                <button
                  key={entry.property.id}
                  onClick={() => switchProperty(entry.property.id)}
                  className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                    isActive
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                  style={isActive ? { backgroundColor: '#3B6D11' } : {}}
                >
                  {entry.property.name}
                </button>
              );
            })}
            {canAddProperty && (
              <button
                onClick={() => { reset(); router.push('/onboarding'); }}
                className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
              >
                + Add property
              </button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        {/* 3D Property Map */}
        <DashboardMap
          boundary={boundary}
          address={address}
          propertyName={property.name}
          acreage={property.acreage}
          county={property.county}
          state={property.state}
          activeZone={activeZone}
          activeZoneLabel={activeZoneLabel}
          activeZoneType={activeZoneType}
          propertyId={property.id}
        />

        {/* Property header */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-5">
            <EcoScoreRing score={ecosystemScore} />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-gray-900">{property.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {property.county}, {property.state} · {property.acreage?.toFixed(1)} acres
              </p>
              {property.soilType && (
                <p className="text-xs text-gray-400 mt-1">Soil: {property.soilType}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {property.goals.map((g) => (
                  <span key={g} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                    {g.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Goals text — inline editable */}
          <div className="mt-4 pt-4 border-t border-gray-50">
            {editingGoals ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  value={goalsInput}
                  onChange={(e) => setGoalsInput(e.target.value)}
                  rows={3}
                  placeholder="e.g. I want to plant food plots and learn where to put white oaks. We have a wet area I want to improve for ducks."
                  className="w-full text-sm text-gray-700 placeholder-gray-400 border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-[#639922]"
                />
                {regenError && <p className="text-xs text-red-500">{regenError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setUserGoalsText(goalsInput);
                      setEditingGoals(false);
                      setRegenError(null);
                      const ok = await regeneratePlan();
                      if (!ok) setRegenError('Could not regenerate plan. Try again.');
                    }}
                    disabled={isAnalyzing}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: '#3B6D11' }}
                  >
                    {isAnalyzing ? 'Rebuilding your plan…' : 'Save & rebuild plan'}
                  </button>
                  <button
                    onClick={() => { setEditingGoals(false); setRegenError(null); }}
                    className="px-4 py-2 rounded-xl text-sm text-gray-500 border border-gray-200 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setGoalsInput(userGoalsText); setEditingGoals(true); }}
                className="w-full text-left group"
              >
                {userGoalsText ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Your goals</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{userGoalsText}</p>
                    <p className="text-xs text-[#639922] mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">Tap to edit &amp; rebuild plan</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#3B6D11] transition-colors">
                    <span>+</span>
                    <span>Add your specific goals to get a more personalised plan</span>
                  </div>
                )}
              </button>
            )}
          </div>
        </div>

        {/* AI Insights */}
        {insights.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Property insights
            </p>
            <p className="text-xs text-gray-400 mb-4">Tap any insight to highlight that area on the map</p>
            <div className="space-y-3">
              {insights.map((insight, i) => {
                const isActive = activeInsightIndex === i;
                const borderColor =
                  insight.type === 'positive'    ? '#97C459' :
                  insight.type === 'warning'     ? '#F59E0B' :
                                                   '#38BDF8';
                const bgActive =
                  insight.type === 'positive'    ? '#EAF3DE' :
                  insight.type === 'warning'     ? '#FFFBEB' :
                                                   '#F0F9FF';
                return (
                  <button
                    key={i}
                    onClick={() => setActiveInsightIndex(isActive ? null : i)}
                    className="w-full text-left flex gap-3 rounded-xl p-3 transition-all"
                    style={{
                      background: isActive ? bgActive : 'transparent',
                      border: `1.5px solid ${isActive ? borderColor : 'transparent'}`,
                    }}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base ${
                      insight.type === 'positive'    ? 'bg-[#EAF3DE]' :
                      insight.type === 'warning'     ? 'bg-amber-50' :
                                                       'bg-blue-50'
                    }`}>
                      {insight.type === 'positive' ? '🌳' :
                       insight.type === 'warning'  ? '⚠️' : '💡'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">{insight.title}</p>
                        {insight.zoneLabel && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
                            style={{ background: bgActive, color: borderColor }}
                          >
                            {insight.zoneLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{insight.description}</p>
                      {isActive && (
                        <p className="text-xs mt-1.5 font-medium" style={{ color: borderColor }}>
                          ↑ Highlighted on map
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Plan summary */}
        {plan?.summary && (
          <div
            className="rounded-2xl p-5 border text-sm leading-relaxed"
            style={{ backgroundColor: '#EAF3DE', borderColor: '#C0DD97', color: '#27500A' }}
          >
            <p className="font-semibold mb-1" style={{ color: '#27500A' }}>Your plan summary</p>
            <p style={{ color: '#3B6D11' }}>{plan.summary}</p>
          </div>
        )}


        {/* Action plan — grouped by month (Naturalist/Conservationist) or season (Steward) or flat (Free) */}
        <ActionPlanSection
          unlockedTasks={freeTasks}
          lockedTasks={lockedTasks}
          tier={tier}
        />

        {/* Upgrade CTA */}
        {/* Upgrade CTA — only shown for free/steward, points at correct next tier */}
        {(tier === 'free' || tier === 'steward') && (
          <Link
            href="/upgrade"
            className="block rounded-2xl p-5 border transition-colors hover:brightness-95"
            style={{ backgroundColor: '#EAF3DE', borderColor: '#97C459' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: '#27500A' }}>
                  {tier === 'free' ? 'Unlock your full yearly action plan' : 'Get more out of your land'}
                </p>
                <p className="text-xs mt-1" style={{ color: '#3B6D11' }}>
                  {tier === 'free'
                    ? 'Upgrade to Steward for $9.99/mo — a full seasonal calendar, species ID, land health score, and more.'
                    : 'Upgrade to Naturalist for $19.99/mo — monthly task calendars, impact scores on every task, and up to 3 properties.'}
                </p>
              </div>
              <span className="text-xl ml-4" style={{ color: '#3B6D11' }}>→</span>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
