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
import type { PropertyProfile, ActionPlan, ActionTask, Goal, SubscriptionTier } from '@/types';

// Property limits per tier
export const TIER_PROPERTY_LIMITS: Record<SubscriptionTier, number> = {
  free:             1,
  steward:          1,
  naturalist:       3,
  conservationist:  Infinity,
};

// A single saved property with its plan and context
export interface PropertyEntry {
  property: PropertyProfile;
  plan:     ActionPlan;
  insights: Insight[];
  boundary: number[][][] | null;
}

export type InsightZone = 'full' | 'north' | 'south' | 'east' | 'west' | 'center' | 'perimeter';

export interface Insight {
  type:       'positive' | 'warning' | 'opportunity';
  title:      string;
  description: string;
  zone?:      InsightZone;
  zoneLabel?: string;
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
  completeTask:    (taskId: string) => void;
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
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  // Derived from the active entry
  const activeEntry   = propertyEntries.find((e) => e.property.id === activePropertyId) ?? null;
  const property      = activeEntry?.property ?? null;
  const plan          = activeEntry?.plan     ?? null;
  const insights      = activeEntry?.insights ?? [];
  const canAddProperty = propertyEntries.length < propertyLimit;

  // Hydrate from localStorage
  useEffect(() => {
    if (!isLoaded) return;
    if (hydratedFor === userId) return;

    try {
      const key = storageKey(userId);
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw);

        // Support both old single-property format and new multi-property format
        if (saved.propertyEntries) {
          setPropertyEntries(saved.propertyEntries);
          setActivePropertyId(saved.activePropertyId ?? saved.propertyEntries[0]?.property.id ?? null);
        } else if (saved.property && saved.plan) {
          // Migrate old format
          const entry: PropertyEntry = {
            property: saved.property,
            plan:     saved.plan,
            insights: saved.insights ?? [],
            boundary: saved.boundary ?? null,
          };
          setPropertyEntries([entry]);
          setActivePropertyId(saved.property.id);
        }

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

  // Persist to localStorage
  useEffect(() => {
    if (!isLoaded || hydratedFor !== userId) return;
    if (!address && propertyEntries.length === 0) return;
    try {
      localStorage.setItem(
        storageKey(userId),
        JSON.stringify({ propertyEntries, activePropertyId, address, acreage, goals, userGoalsText })
      );
    } catch {
      // ignore
    }
  }, [isLoaded, userId, hydratedFor, propertyEntries, activePropertyId, address, acreage, goals, userGoalsText]);

  // Core action: analyze property then generate plan
  const analyzeAndPlan = useCallback(async (): Promise<boolean> => {
    setIsAnalyzing(true);
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

      // Clear flyover flag for the new property
      try { localStorage.removeItem(`landethic_flyover_${profile.id}`); } catch { /* ignore */ }

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

      const newEntry: PropertyEntry = {
        property: profile,
        plan:     newPlan,
        insights: newInsights,
        boundary: boundary ?? null,
      };

      setPropertyEntries((prev) => {
        // Remove any existing entry with the same ID (shouldn't happen, but safe)
        const filtered = prev.filter((e) => e.property.id !== profile.id);
        return [...filtered, newEntry];
      });
      setActivePropertyId(profile.id);

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setAnalyzeError(msg);
      return false;
    } finally {
      setIsAnalyzing(false);
    }
  }, [address, acreage, goals, boundary]);

  // Mark a task complete

  // Regenerate plan only — re-uses the existing property profile (no re-analysis)
  const regeneratePlan = useCallback(async (): Promise<boolean> => {
    if (!property) return false;
    setIsAnalyzing(true);
    setAnalyzeError(null);
    try {
      const planRes = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: property, tier, userGoalsText: userGoalsText || undefined }),
      });
      if (!planRes.ok) {
        const err = await planRes.json();
        throw new Error(err.error ?? 'Plan generation failed');
      }
      const planData = await planRes.json();
      const newPlan: ActionPlan = planData.plan;

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
    }
  }, [property, tier, userGoalsText, activePropertyId]);

  const completeTask = useCallback((taskId: string) => {
    setPropertyEntries((prev) =>
      prev.map((entry) => {
        if (entry.property.id !== activePropertyId) return entry;
        return {
          ...entry,
          plan: {
            ...entry.plan,
            tasks: entry.plan.tasks.map((t) =>
              t.id === taskId
                ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined }
                : t
            ),
          },
        };
      })
    );
  }, [activePropertyId]);

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
        isAnalyzing, analyzeError,
        analyzeAndPlan, regeneratePlan, completeTask, replaceTask,
        switchProperty, removeProperty,
        reset, resetAll,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
