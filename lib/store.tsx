'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useUser } from '@clerk/nextjs';
import type { PropertyProfile, ActionPlan, ActionTask, Goal, SubscriptionTier, TaskStep } from '@/types';
import { monthKey, monthNumOf } from '@/lib/months';

import { TIER_PROPERTY_LIMITS } from '@/lib/tiers';

// Re-exported so existing imports keep working; the source of truth is lib/tiers.ts
export { TIER_PROPERTY_LIMITS };

// A single saved property with its plan and context
export interface PropertyEntry {
  property: PropertyProfile;
  plan:     ActionPlan;
  insights: Insight[];
  boundary: number[][][] | null;
}

export type AnalyzeStage = 'idle' | 'analyzing' | 'planning' | 'saving';

export type InsightZone = 'full' | 'north' | 'south' | 'east' | 'west' | 'center' | 'perimeter';

export interface Insight {
  type:       'positive' | 'warning' | 'opportunity';
  title:      string;
  description: string;
  /** Legacy: old insights had a map zone for highlighting. No longer used. */
  zone?:      InsightZone;
  /** Short name for the spot, e.g. "south tree line". */
  zoneLabel?: string;
  /** Plain-language directions to the spot on the ground. */
  where?:     string;
  /** Ordered, concrete steps for the owner. */
  steps?:     string[];
  /** Outline of the spot on the map: closed ring of [lng, lat]. */
  area?:      number[][];
}

// Shape of the global store
interface LandEthicStore {
  // All saved properties
  propertyEntries:  PropertyEntry[];
  activePropertyId: string | null;

  // Onboarding inputs for the property currently being created
  address:  string;
  acreage:  string;
  goals:    Goal[];
  boundary: number[][][] | null;

  // Derived from active entry (kept for backward compat with existing pages)
  property: PropertyProfile | null;
  plan:     ActionPlan | null;
  insights: Insight[];

  // Subscription tier (from Clerk publicMetadata)
  tier:          SubscriptionTier;
  propertyLimit: number;
  canAddProperty: boolean;

  // Loading / error
  isAnalyzing:  boolean;
  /** Which part of the work is running, for the progress screen. */
  analyzeStage: AnalyzeStage;
  analyzeError: string | null;

  // Setters for onboarding inputs
  setAddress:  (v: string) => void;
  setAcreage:  (v: string) => void;
  setGoals:         (v: Goal[]) => void;
  userGoalsText:    string;
  setUserGoalsText: (v: string) => void;
  setBoundary: (v: number[][][] | null) => void;

  // Actions
  analyzeAndPlan:  () => Promise<boolean>;
  regeneratePlan:  () => Promise<boolean>;
  refreshInsights: () => Promise<boolean>;
  /** Naturalist+: carry over unfinished tasks and add this month's new ones. */
  monthlyUpdate:   () => Promise<boolean>;
  completeTask:    (taskId: string) => void;
  /** Conservationist weekly checklist: tick one step of a task. */
  toggleTaskStep:  (taskId: string, stepIndex: number) => void;
  replaceTask:     (taskId: string, newTask: ActionTask) => void;
  switchProperty:  (id: string) => void;
  removeProperty:  (id: string) => void;
  reset:           () => void; // clears onboarding inputs only
  resetAll:        () => void; // wipes everything (sign-out / fresh start)
}

function storageKey(userId: string | null | undefined): string {
  return userId ? `landethic_state_${userId}` : 'landethic_state_guest';
}

const StoreContext = createContext<LandEthicStore | null>(null);

export function useStore(): LandEthicStore {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? null;

  // Read tier from Clerk publicMetadata (falls back to 'free')
  const tier = ((user?.publicMetadata?.tier as SubscriptionTier) ?? 'free') as SubscriptionTier;
  const propertyLimit = TIER_PROPERTY_LIMITS[tier];

  // All saved properties
  const [propertyEntries, setPropertyEntries] = useState<PropertyEntry[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);

  // Onboarding inputs
  const [address,  setAddress]  = useState('');
  const [acreage,  setAcreage]  = useState('');
  const [goals,    setGoals]    = useState<Goal[]>(['wildlife_diversity', 'deer_hunting']);
  const [userGoalsText, setUserGoalsText] = useState('');
  const [boundary, setBoundary] = useState<number[][][] | null>(null);

  // Loading / error
  const [isAnalyzing,  setIsAnalyzing]  = useState(false);
  const [analyzeStage, setAnalyzeStage] = useState<AnalyzeStage>('idle');
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  // Derived from the active entry
  const activeEntry   = propertyEntries.find((e) => e.property.id === activePropertyId) ?? null;
  const property      = activeEntry?.property ?? null;
  const plan          = activeEntry?.plan     ?? null;
  const insights      = activeEntry?.insights ?? [];
  const canAddProperty = propertyEntries.length < propertyLimit;

  // Hydrate onboarding-draft fields from localStorage — transient form state only,
  // not saved entities, so this stays client-side (see propertyEntries fetch below).
  useEffect(() => {
    if (!isLoaded) return;
    if (hydratedFor === userId) return;

    try {
      const raw = localStorage.getItem(storageKey(userId));
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.address)       setAddress(saved.address);
        if (saved.acreage)       setAcreage(saved.acreage);
        if (saved.goals)         setGoals(saved.goals);
        if (saved.userGoalsText) setUserGoalsText(saved.userGoalsText);
      }
    } catch {
      // ignore
    }

    setHydratedFor(userId);
  }, [isLoaded, userId, hydratedFor]);

  // Persist onboarding-draft fields to localStorage
  useEffect(() => {
    if (!isLoaded || hydratedFor !== userId) return;
    if (!address) return;
    try {
      localStorage.setItem(
        storageKey(userId),
        JSON.stringify({ address, acreage, goals, userGoalsText })
      );
    } catch {
      // ignore
    }
  }, [isLoaded, userId, hydratedFor, address, acreage, goals, userGoalsText]);

  // Load saved properties from the server (source of truth — replaces localStorage)
  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      setPropertyEntries([]);
      setActivePropertyId(null);
      return;
    }

    let cancelled = false;
    fetch('/api/properties')
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((data: { entries: PropertyEntry[] }) => {
        if (cancelled) return;
        setPropertyEntries(data.entries);
        setActivePropertyId((prev) =>
          prev && data.entries.some((e) => e.property.id === prev)
            ? prev
            : data.entries[0]?.property.id ?? null
        );
      })
      .catch(() => { /* leave state empty on failure */ });

    return () => { cancelled = true; };
  }, [isLoaded, userId]);

  // Core action: analyze property then generate plan
  const analyzeAndPlan = useCallback(async (): Promise<boolean> => {
    setIsAnalyzing(true);
    setAnalyzeStage('analyzing');
    setAnalyzeError(null);

    try {
      const analyzeRes = await fetch('/api/analyze-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          acreage: acreage ? parseFloat(acreage) : undefined,
          goals,
          userGoalsText: userGoalsText || undefined,
          boundary: boundary ?? undefined,
        }),
      });

      if (!analyzeRes.ok) {
        const err = await analyzeRes.json();
        throw new Error(err.error ?? 'Property analysis failed');
      }

      const analyzeData  = await analyzeRes.json();
      const profile: PropertyProfile = analyzeData.profile;

      setAnalyzeStage('planning');
      const planRes = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, tier, userGoalsText: userGoalsText || undefined, boundary: boundary ?? undefined }),
      });

      if (!planRes.ok) {
        const err = await planRes.json();
        throw new Error(err.error ?? 'Plan generation failed');
      }

      const planData = await planRes.json();
      const newPlan: ActionPlan = planData.plan;
      const newInsights: Insight[] = analyzeData.insights ?? [];

      setAnalyzeStage('saving');
      const saveRes = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, insights: newInsights, boundary: boundary ?? null, plan: newPlan }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error ?? 'Saving property failed');
      }

      const saveData = await saveRes.json();
      const newEntry: PropertyEntry = saveData.entry;

      // Clear flyover flag for the new property (uses the server-issued id)
      try { localStorage.removeItem(`landethic_flyover_${newEntry.property.id}`); } catch { /* ignore */ }

      setPropertyEntries((prev) => [...prev, newEntry]);
      setActivePropertyId(newEntry.property.id);

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setAnalyzeError(msg);
      return false;
    } finally {
      setIsAnalyzing(false);
      setAnalyzeStage('idle');
    }
  }, [address, acreage, goals, userGoalsText, boundary, tier]);

  // Mark a task complete

  // Re-run the property analysis and replace only the insights (profile, score and plan stay)
  const refreshInsights = useCallback(async (): Promise<boolean> => {
    if (!property || !activePropertyId) return false;
    setAnalyzeError(null);
    try {
      const res = await fetch('/api/analyze-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: property.address,
          acreage: property.acreage,
          goals: property.goals,
          userGoalsText: userGoalsText || undefined,
          boundary: activeEntry?.boundary ?? undefined,
          refreshPropertyId: activePropertyId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Updating insights failed');
      }
      const data = await res.json();
      const newInsights: Insight[] = data.insights ?? [];

      const saveRes = await fetch(`/api/properties/${activePropertyId}/insights`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insights: newInsights }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error ?? 'Saving insights failed');
      }

      setPropertyEntries((prev) =>
        prev.map((entry) =>
          entry.property.id === activePropertyId ? { ...entry, insights: newInsights } : entry
        )
      );
      return true;
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Updating insights failed');
      return false;
    }
  }, [property, activePropertyId, activeEntry, userGoalsText]);

  // Regenerate plan only — re-uses the existing property profile (no re-analysis)
  const regeneratePlan = useCallback(async (): Promise<boolean> => {
    if (!property || !activePropertyId) return false;
    setIsAnalyzing(true);
    setAnalyzeStage('planning');
    setAnalyzeError(null);
    try {
      const planRes = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: property,
          tier,
          userGoalsText: userGoalsText || undefined,
          boundary: activeEntry?.boundary ?? undefined,
        }),
      });
      if (!planRes.ok) {
        const err = await planRes.json();
        throw new Error(err.error ?? 'Plan generation failed');
      }
      const planData = await planRes.json();
      const generatedPlan: ActionPlan = planData.plan;

      setAnalyzeStage('saving');
      const saveRes = await fetch(`/api/properties/${activePropertyId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: generatedPlan }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error ?? 'Saving plan failed');
      }
      const saveData = await saveRes.json();
      const newPlan: ActionPlan = saveData.plan;

      setPropertyEntries((prev) =>
        prev.map((entry) => {
          if (entry.property.id !== activePropertyId) return entry;
          return { ...entry, plan: newPlan };
        })
      );
      return true;
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Plan regeneration failed');
      return false;
    } finally {
      setIsAnalyzing(false);
      setAnalyzeStage('idle');
    }
  }, [property, tier, userGoalsText, activePropertyId, activeEntry]);

  // Monthly update — keeps finished tasks, moves unfinished ones up, adds the new month
  const monthlyUpdate = useCallback(async (): Promise<boolean> => {
    if (!activePropertyId) return false;
    setIsAnalyzing(true);
    setAnalyzeStage('planning');
    setAnalyzeError(null);
    try {
      const res = await fetch(`/api/properties/${activePropertyId}/monthly-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: monthKey(monthNumOf(new Date())),
          userGoalsText: userGoalsText || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { plan?: ActionPlan; error?: string };
      if (!res.ok || !data.plan) throw new Error(data.error ?? 'Monthly update failed');
      const newPlan = data.plan;
      setAnalyzeStage('saving');
      setPropertyEntries((prev) =>
        prev.map((entry) => (entry.property.id === activePropertyId ? { ...entry, plan: newPlan } : entry))
      );
      return true;
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Monthly update failed');
      return false;
    } finally {
      setIsAnalyzing(false);
      setAnalyzeStage('idle');
    }
  }, [activePropertyId, userGoalsText]);

  // Tick one checklist step. Finishing every step finishes the task; un-ticking
  // a step of a finished task re-opens it.
  const toggleTaskStep = useCallback((taskId: string, stepIndex: number) => {
    const current = plan?.tasks.find((t) => t.id === taskId);
    if (!current?.steps?.[stepIndex]) return;
    const steps: TaskStep[] = current.steps.map((s, i) => (i === stepIndex ? { ...s, done: !s.done } : s));
    const allDone = steps.every((s) => s.done);
    const completed = allDone ? true : current.completed && steps[stepIndex].done === false ? false : current.completed;

    const apply = (task: Partial<ActionTask>) =>
      setPropertyEntries((prev) =>
        prev.map((entry) => {
          if (entry.property.id !== activePropertyId) return entry;
          return {
            ...entry,
            plan: { ...entry.plan, tasks: entry.plan.tasks.map((t) => (t.id === taskId ? { ...t, ...task } : t)) },
          };
        })
      );

    apply({
      steps,
      completed,
      completedAt: completed ? current.completedAt ?? new Date().toISOString() : undefined,
    });

    fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(completed !== current.completed ? { steps, completed } : { steps }),
    })
      .then((res) => { if (!res.ok) throw new Error('Failed to save'); })
      .catch(() => {
        apply({ steps: current.steps, completed: current.completed, completedAt: current.completedAt });
        setAnalyzeError('Could not save your checklist. Try again.');
      });
  }, [activePropertyId, plan]);

  const completeTask = useCallback((taskId: string) => {
    const current = plan?.tasks.find((t) => t.id === taskId);
    if (!current) return;
    const nextCompleted = !current.completed;

    // Optimistic local toggle — the checkbox flips instantly, independent of the network.
    setPropertyEntries((prev) =>
      prev.map((entry) => {
        if (entry.property.id !== activePropertyId) return entry;
        return {
          ...entry,
          plan: {
            ...entry.plan,
            tasks: entry.plan.tasks.map((t) =>
              t.id === taskId
                ? { ...t, completed: nextCompleted, completedAt: nextCompleted ? new Date().toISOString() : undefined }
                : t
            ),
          },
        };
      })
    );

    fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: nextCompleted }),
    })
      .then((res) => { if (!res.ok) throw new Error('Failed to save'); })
      .catch(() => {
        // Revert the optimistic toggle if the save failed
        setPropertyEntries((prev) =>
          prev.map((entry) => {
            if (entry.property.id !== activePropertyId) return entry;
            return {
              ...entry,
              plan: {
                ...entry.plan,
                tasks: entry.plan.tasks.map((t) =>
                  t.id === taskId ? { ...t, completed: current.completed, completedAt: current.completedAt } : t
                ),
              },
            };
          })
        );
        setAnalyzeError('Could not save task progress. Try again.');
      });
  }, [activePropertyId, plan]);

  const replaceTask = useCallback((taskId: string, newTask: ActionTask) => {
    setPropertyEntries((prev) =>
      prev.map((entry) => {
        if (entry.property.id !== activePropertyId) return entry;
        return {
          ...entry,
          plan: {
            ...entry.plan,
            tasks: entry.plan.tasks.map((t) => (t.id === taskId ? newTask : t)),
          },
        };
      })
    );
  }, [activePropertyId]);

  // Switch the active property
  const switchProperty = useCallback((id: string) => {
    setActivePropertyId(id);
  }, []);

  // Remove a property from the account
  const removeProperty = useCallback((id: string) => {
    fetch(`/api/properties/${id}`, { method: 'DELETE' }).catch(() => { /* best-effort */ });
    setPropertyEntries((prev) => {
      const next = prev.filter((e) => e.property.id !== id);
      return next;
    });
    setActivePropertyId((prev) => {
      if (prev !== id) return prev;
      const remaining = propertyEntries.filter((e) => e.property.id !== id);
      return remaining[0]?.property.id ?? null;
    });
  }, [propertyEntries]);

  // Clear onboarding inputs (start a new analysis)
  const reset = useCallback(() => {
    setAddress('');
    setAcreage('');
    setGoals(['wildlife_diversity', 'deer_hunting']);
    setUserGoalsText('');
    setBoundary(null);
    setAnalyzeError(null);
  }, []);

  // Wipe everything
  const resetAll = useCallback(() => {
    setPropertyEntries([]);
    setActivePropertyId(null);
    setAddress('');
    setAcreage('');
    setGoals(['wildlife_diversity', 'deer_hunting']);
    setUserGoalsText('');
    setBoundary(null);
    setAnalyzeError(null);
    try { localStorage.removeItem(storageKey(userId)); } catch { /* ignore */ }
  }, [userId]);

  return (
    <StoreContext.Provider
      value={{
        propertyEntries,
        activePropertyId,
        address, setAddress,
        acreage, setAcreage,
        goals,   setGoals,
        userGoalsText, setUserGoalsText,
        boundary: activeEntry?.boundary ?? boundary, setBoundary,
        property, plan, insights,
        tier, propertyLimit, canAddProperty,
        isAnalyzing, analyzeStage, analyzeError,
        analyzeAndPlan, regeneratePlan, refreshInsights, monthlyUpdate, completeTask, toggleTaskStep, replaceTask,
        switchProperty, removeProperty,
        reset, resetAll,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
