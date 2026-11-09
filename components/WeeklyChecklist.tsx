'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { monthLabel, monthNumOf, parseMonthLabel, taskWeek, weekOfMonth } from '@/lib/months';
import { TIER_ORDER } from '@/lib/tiers';
import type { ActionTask } from '@/types';
import { Icon } from '@/components/brand';

/** Tick-off list of a task's steps (used on the dashboard and the task page). */
export function StepList({ task, compact = false }: { task: ActionTask; compact?: boolean }) {
  const { toggleTaskStep } = useStore();
  if (!task.steps?.length) return null;
  return (
    <ul className={compact ? 'mt-2 space-y-1' : 'space-y-2'}>
      {task.steps.map((step, i) => (
        <li key={i}>
          <button
            onClick={() => toggleTaskStep(task.id, i)}
            className={`flex w-full items-start gap-2.5 rounded-lg text-left transition-colors hover:bg-cream-2 ${compact ? 'px-1.5 py-1' : 'px-2 py-1.5'}`}
            aria-pressed={step.done}
          >
            <span
              className={`mt-px flex flex-shrink-0 items-center justify-center rounded border-[1.5px] transition-colors ${
                compact ? 'h-4 w-4' : 'h-[18px] w-[18px]'
              } ${step.done ? 'border-forest-600 bg-forest-600 text-cream' : 'border-paper-line bg-cream'}`}
            >
              {step.done && <Icon.Check size={compact ? 10 : 12} />}
            </span>
            <span className={`${compact ? 'text-xs' : 'text-sm'} leading-relaxed ${step.done ? 'text-ink-faint line-through' : 'text-ink'}`}>
              {step.text}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Conservationist "This week" card: this month's tasks split into weeks 1–4,
 * each with its own check-off steps.
 */
export default function WeeklyChecklist() {
  const { plan, tier, completeTask, regeneratePlan, isAnalyzing } = useStore();
  const now = new Date();
  const current = monthNumOf(now);
  const thisWeek = weekOfMonth(now);
  const [week, setWeek] = useState(thisWeek);

  const monthTasks = useMemo(
    () =>
      (plan?.tasks ?? []).filter(
        (t) => parseMonthLabel(t.month) === current && TIER_ORDER.indexOf(t.tier) <= TIER_ORDER.indexOf(tier)
      ),
    [plan, current, tier]
  );
  const byWeek = useMemo(() => {
    const map = new Map<number, ActionTask[]>([[1, []], [2, []], [3, []], [4, []]]);
    for (const t of monthTasks) map.get(taskWeek(t, monthTasks))!.push(t);
    return map;
  }, [monthTasks]);

  if (!plan) return null;

  const weekTasks = byWeek.get(week) ?? [];
  const stepsTotal = weekTasks.reduce((n, t) => n + (t.steps?.length ?? 0), 0);
  const stepsDone = weekTasks.reduce((n, t) => n + (t.steps?.filter((s) => s.done).length ?? 0), 0);
  const tasksDone = weekTasks.filter((t) => t.completed).length;
  const hasSteps = monthTasks.some((t) => t.steps?.length);
  const month = monthLabel(current).split(' ')[0];

  return (
    <div className="card overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-paper-line px-4 py-4 sm:px-5">
        <div>
          <p className="eyebrow">This week</p>
          <p className="mt-1 font-display text-lg font-bold text-ink">
            Week {week} of {month}
            {week === thisWeek && <span className="ml-2 align-middle text-xs font-semibold text-forest-700">now</span>}
          </p>
        </div>
        <p className="mt-1 text-right text-xs text-ink-soft">
          {stepsTotal > 0 ? `${stepsDone} of ${stepsTotal} steps` : `${tasksDone} of ${weekTasks.length} tasks`}
          <br />
          done
        </p>
      </div>

      {/* Week tabs */}
      <div className="flex gap-1.5 border-b border-paper-line bg-cream-2 px-4 py-2.5 sm:px-5" role="tablist">
        {[1, 2, 3, 4].map((w) => {
          const list = byWeek.get(w) ?? [];
          const allDone = list.length > 0 && list.every((t) => t.completed);
          return (
            <button
              key={w}
              role="tab"
              aria-selected={week === w}
              onClick={() => setWeek(w)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                week === w
                  ? 'border-forest-700 bg-forest-700 text-cream'
                  : 'border-paper-line bg-cream text-ink-soft hover:bg-paper-line'
              }`}
            >
              <span className="inline-flex items-center gap-1">
                {allDone && <Icon.Check size={11} />}
                Week {w}
              </span>
              <span className={`block text-[10px] font-medium ${week === w ? 'text-forest-200' : 'text-ink-faint'}`}>
                {list.length} {list.length === 1 ? 'task' : 'tasks'}
              </span>
            </button>
          );
        })}
      </div>

      {weekTasks.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink-soft sm:px-5">
          {monthTasks.length === 0
            ? `No tasks for ${month} yet. Get your monthly update above to fill in this month.`
            : 'Nothing planned for this week. Look ahead and get a head start on next week.'}
        </p>
      ) : (
        <div className="divide-y divide-paper-line">
          {weekTasks.map((task) => (
            <div key={task.id} className="px-4 py-4 sm:px-5">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => completeTask(task.id)}
                  aria-label={task.completed ? 'Mark as not done' : 'Mark as done'}
                  className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-[1.5px] transition-colors ${
                    task.completed ? 'border-forest-700 bg-forest-700 text-cream' : 'border-paper-line bg-cream hover:border-forest-600'
                  }`}
                >
                  {task.completed && <Icon.Check size={13} />}
                </button>
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/task/${task.id}`} className="group block">
                    <p className={`text-sm font-semibold leading-snug ${task.completed ? 'text-ink-faint line-through' : 'text-ink group-hover:text-forest-700'}`}>
                      {task.title}
                    </p>
                  </Link>
                  {task.steps?.length ? (
                    <StepList task={task} compact />
                  ) : (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-soft">{task.description}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasSteps && monthTasks.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-paper-line bg-cream-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-xs leading-relaxed text-ink-soft">
            Rebuild your plan to get step-by-step checklists for every task. Tasks you checked off will reset.
          </p>
          <button
            onClick={() => regeneratePlan()}
            disabled={isAnalyzing}
            className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-lg bg-forest-700 px-3 py-2 text-xs font-semibold text-cream transition-colors hover:bg-forest-800 disabled:opacity-60"
          >
            <Icon.Refresh size={14} /> Rebuild plan
          </button>
        </div>
      )}
    </div>
  );
}
