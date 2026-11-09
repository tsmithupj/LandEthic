import type { ActionPlan, ActionTask, SubscriptionTier } from '@/types';

// Month helpers shared by the dashboard and the monthly-update route.
// Task months are stored as labels like "November 2026".

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** A month as a sortable number: year * 12 + monthIndex. */
export type MonthNum = number;

export function monthNumOf(date: Date): MonthNum {
  return date.getFullYear() * 12 + date.getMonth();
}

/** "YYYY-MM" for a month number. */
export function monthKey(m: MonthNum): string {
  return `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
}

export function parseMonthKey(key: unknown): MonthNum | null {
  if (typeof key !== 'string') return null;
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return null;
  return parseInt(match[1], 10) * 12 + (month - 1);
}

/** "November 2026" for a month number. */
export function monthLabel(m: MonthNum): string {
  return `${MONTH_NAMES[m % 12]} ${Math.floor(m / 12)}`;
}

/** Parse a task's month label ("June 2026", "Jun 2026", "2026-06"). */
export function parseMonthLabel(label: string | undefined | null): MonthNum | null {
  if (!label) return null;
  const fromKey = parseMonthKey(label.trim());
  if (fromKey !== null) return fromKey;
  const parts = label.trim().split(/\s+/);
  if (parts.length === 2) {
    const idx = MONTH_NAMES.findIndex((n) => n.toLowerCase().startsWith(parts[0].toLowerCase().slice(0, 3)));
    const year = parseInt(parts[1], 10);
    if (idx !== -1 && !isNaN(year)) return year * 12 + idx;
  }
  const d = new Date(label);
  return isNaN(d.getTime()) ? null : monthNumOf(d);
}

export function seasonOf(m: MonthNum): string {
  const idx = m % 12;
  if (idx >= 2 && idx <= 4) return 'Spring';
  if (idx >= 5 && idx <= 7) return 'Summer';
  if (idx >= 8 && idx <= 10) return 'Fall';
  return 'Winter';
}

/** Week of the month, 1–4 (days 22+ count as week 4). */
export function weekOfMonth(date: Date): number {
  return Math.min(4, Math.ceil(date.getDate() / 7));
}

/** How far ahead each month-by-month plan reaches, and how many tasks per month. */
export const MONTHLY_PLAN: Partial<Record<SubscriptionTier, { months: number; perMonth: number }>> = {
  naturalist:      { months: 6, perMonth: 3 },
  conservationist: { months: 3, perMonth: 7 },
};

export function hasMonthlyUpdates(tier: SubscriptionTier): boolean {
  return !!MONTHLY_PLAN[tier];
}

/**
 * True when this plan is ready for its monthly update: the member is on a
 * month-by-month tier, the plan was built for that tier, and it hasn't been
 * built or updated yet this calendar month.
 */
export function monthlyUpdateDue(plan: ActionPlan | null, tier: SubscriptionTier, now = new Date()): boolean {
  if (!plan || !hasMonthlyUpdates(tier) || plan.tier !== tier) return false;
  const current = monthNumOf(now);
  if (plan.lastMonthlyUpdate && parseMonthKey(plan.lastMonthlyUpdate) === current) return false;
  const built = new Date(plan.generatedAt);
  if (!isNaN(built.getTime()) && monthNumOf(built) === current) return false;
  return true;
}

/**
 * The week (1–4) a task belongs to. Uses the task's own `week` when it has one;
 * otherwise spreads that month's tasks evenly across the 4 weeks in plan order.
 */
export function taskWeek(task: ActionTask, monthTasks: ActionTask[]): number {
  if (task.week && task.week >= 1 && task.week <= 4) return task.week;
  const i = Math.max(0, monthTasks.findIndex((t) => t.id === task.id));
  return Math.min(4, Math.floor((i * 4) / Math.max(1, monthTasks.length)) + 1);
}

/**
 * What a monthly update changes, given the plan's tasks:
 *  - overdue: unfinished tasks from past months (move into this month),
 *  - newMonths: months in the plan's window with nothing planned yet,
 *  - completed / upcoming: context for writing the new tasks.
 */
export function planMonthlyUpdate<T extends { id: string; month?: string | null; completed: boolean }>(
  taskList: T[],
  current: MonthNum,
  windowMonths: number,
) {
  const monthOf = new Map(taskList.map((t) => [t.id, parseMonthLabel(t.month)]));
  const overdue = taskList.filter((t) => {
    const m = monthOf.get(t.id);
    return !t.completed && m != null && m < current;
  });
  const newMonths = Array.from({ length: windowMonths }, (_, i) => current + i).filter((m) => {
    const planned = taskList.filter((t) => monthOf.get(t.id) === m).length;
    return planned + (m === current ? overdue.length : 0) === 0;
  });
  const upcoming = taskList.filter((t) => {
    const m = monthOf.get(t.id);
    return !t.completed && m != null && m >= current;
  });
  return { overdue, newMonths, upcoming };
}
