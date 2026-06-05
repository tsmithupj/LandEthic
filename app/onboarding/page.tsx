'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import DrawablePropertyMap from '@/components/DrawablePropertyMap';
import dynamic from 'next/dynamic';
import type { Goal } from '@/types';

const ParcelConfirmMap = dynamic(() => import('@/components/ParcelConfirmMap'), { ssr: false });

// Goal options
const GOALS: { id: Goal; label: string; icon: string }[] = [
  { id: 'wildlife_diversity', label: 'Wildlife diversity', icon: '🦎' },
  { id: 'deer_hunting',       label: 'Deer hunting',       icon: '🦌' },
  { id: 'bird_sanctuary',     label: 'Bird sanctuary',     icon: '🐦' },
  { id: 'pollinator_habitat', label: 'Pollinator habitat', icon: '🌸' },
  { id: 'soil_restoration',   label: 'Soil restoration',   icon: '🌱' },
  { id: 'turkey_habitat',     label: 'Turkey habitat',     icon: '🦃' },
  { id: 'native_plants',      label: 'Native plants',      icon: '🌿' },
  { id: 'water_quality',      label: 'Water quality',      icon: '💧' },
];

// Step indicator
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
            i < current ? 'bg-[#3B6D11]' : i === current ? 'bg-[#97C459]' : 'bg-gray-200'
          }`}
        />
      ))}
      <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
        {current + 1} / {total}
      </span>
    </div>
  );
}

// Step 1: Address
interface StepAddressProps {
  onNext: () => void;
  loading: boolean;
}

function StepAddress({ onNext, loading }: StepAddressProps) {
  const { address, setAddress, acreage, setAcreage } = useStore();

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">
        Tell us about your property
      </h2>
      <p className="text-gray-500 mb-8 text-sm leading-relaxed">
        We pull up a satellite view of your land and map your property lines straight from your address.
        No screenshots needed.
      </p>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Property address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Rural Route, Maury County, TN 38401"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#639922] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Approximate acreage{' '}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={acreage}
            onChange={(e) => setAcreage(e.target.value)}
            placeholder="e.g. 120"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#639922] focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            We will try to figure this out from your property lines. Enter it here if you already know it.
          </p>
        </div>
      </div>
      <button
        onClick={onNext}
        disabled={!address.trim() || loading}
        className="mt-8 w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
        style={{ backgroundColor: '#3B6D11' }}
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Looking up your property...
          </>
        ) : (
          'Find my property →'
        )}
      </button>
    </div>
  );
}

// Step 2: Boundary confirmation or manual draw

interface SuggestedParcel {
  coordinates: number[][][];
  acres: number;
}

interface StepBoundaryProps {
  onNext: () => void;
  onBack: () => void;
  suggested: SuggestedParcel | null;
  mismatch: boolean;
}

function StepBoundary({ onNext, onBack, suggested, mismatch }: StepBoundaryProps) {
  const { address: storeAddress, acreage, setAcreage, boundary, setBoundary } = useStore();

  // If we have a suggested boundary and no mismatch, start in confirm mode.
  // Otherwise go straight to draw mode.
  const [mode, setMode] = useState<'confirm' | 'draw'>(
    suggested && !mismatch ? 'confirm' : 'draw'
  );

  const handleBoundaryChange = (newBoundary: number[][][] | null, estimatedAcres: number) => {
    setBoundary(newBoundary);
    if (estimatedAcres > 0 && !acreage) {
      setAcreage(estimatedAcres.toFixed(1));
    }
  };

  const handleAcceptSuggested = () => {
    if (!suggested) return;
    setBoundary(suggested.coordinates);
    if (!acreage) setAcreage(suggested.acres.toFixed(1));
    onNext();
  };

  const canProceedDraw = boundary !== null && boundary.length > 0;

  // Confirm mode: show suggested parcel
  if (mode === 'confirm' && suggested) {
    return (
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Is this your property?
        </h2>
        <p className="text-gray-500 mb-5 text-sm leading-relaxed">
          We found this boundary from public records. Take a look and make sure it covers the right land.
        </p>

        <ParcelConfirmMap coordinates={suggested.coordinates} className="mb-4" />

        <div className="bg-green-50 border border-green-100 rounded-xl p-3.5 text-xs text-green-800 mb-5 leading-relaxed">
          We estimated about <strong>{suggested.acres.toFixed(1)} acres</strong> from this boundary.{' '}
          {acreage ? `You entered ${acreage} acres.` : 'If that looks right, go ahead and confirm.'}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="px-5 py-3 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          <button
            onClick={() => setMode('draw')}
            className="px-5 py-3 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Draw it myself
          </button>
          <button
            onClick={handleAcceptSuggested}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-opacity"
            style={{ backgroundColor: '#3B6D11' }}
          >
            Yes, that is my land →
          </button>
        </div>
      </div>
    );
  }

  // Draw mode
  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">
        Draw your property boundary
      </h2>
      <p className="text-gray-500 mb-3 text-sm leading-relaxed">
        Click the corners of your property on the satellite map to trace your boundary.
        The map will start centered on your address.
      </p>

      {mismatch && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 text-xs text-amber-800 mb-4 leading-relaxed">
          The boundary we found did not match the acreage you entered, so we need you to draw it manually.
          Click the corners of your land on the map below.
        </div>
      )}

      {!mismatch && !suggested && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 text-xs text-blue-800 mb-4 leading-relaxed">
          We could not find public records for your property, so trace it yourself.
          Click at least 3 corners of your land on the map below.
        </div>
      )}

      <DrawablePropertyMap
        address={storeAddress}
        onBoundaryChange={handleBoundaryChange}
        className="mb-5"
      />

      {canProceedDraw && (
        <div className="bg-green-50 border border-green-100 rounded-xl p-3.5 text-xs text-green-800 mb-5 leading-relaxed">
          Boundary saved. Your acreage estimate has been updated.
        </div>
      )}

      {!canProceedDraw && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 text-xs text-amber-800 mb-5 leading-relaxed">
          Click at least 3 points on the map to trace your property boundary, then hit <strong>Confirm boundary</strong>.
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => {
            if (suggested && !mismatch) {
              setMode('confirm');
            } else {
              onBack();
            }
          }}
          className="px-5 py-3 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!canProceedDraw}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ backgroundColor: '#3B6D11' }}
        >
          Confirm boundary →
        </button>
      </div>
    </div>
  );
}

// Step 3: Goals
function StepGoals({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { goals, setGoals, userGoalsText, setUserGoalsText } = useStore();

  const toggle = (goal: Goal) => {
    setGoals(
      goals.includes(goal) ? goals.filter((g) => g !== goal) : [...goals, goal]
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">
        What are your goals for this land?
      </h2>
      <p className="text-gray-500 mb-6 text-sm leading-relaxed">
        Pick everything that fits. This is how we figure out which tasks matter most for your land.
      </p>
      <div className="grid grid-cols-2 gap-3 mb-8">
        {GOALS.map((g) => {
          const sel = goals.includes(g.id);
          return (
            <button
              key={g.id}
              onClick={() => toggle(g.id)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all ${
                sel
                  ? 'border-[#639922] bg-[#EAF3DE]'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <span className="text-lg">{g.icon}</span>
              <span className={`text-sm font-medium ${sel ? 'text-[#3B6D11]' : 'text-gray-700'}`}>
                {g.label}
              </span>
              {sel && <span className="ml-auto text-xs font-bold text-[#639922]">✓</span>}
            </button>
          );
        })}
      </div>
      {/* Free-text goals */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Anything specific you want to work on? <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={userGoalsText}
          onChange={(e) => setUserGoalsText(e.target.value)}
          rows={3}
          placeholder="e.g. I want to plant food plots but don\'t know where to start. I\'d love to add more white oaks and learn the best spots to put them. We also have a wet area I\'ve been ignoring."
          className="w-full text-sm text-gray-700 placeholder-gray-400 border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-1 focus:border-[#639922]"
        />
        <p className="text-xs text-gray-400 mt-1.5">The more detail you give, the more specific your action plan will be.</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-5 py-3 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={goals.length === 0}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ backgroundColor: '#3B6D11' }}
        >
          Build my plan →
        </button>
      </div>
    </div>
  );
}

// Step 4: Generating (live progress bar)

const STEPS = [
  { label: 'Looking up your soil and land data',         target: 18 },
  { label: 'Figuring out what lives and grows there',    target: 38 },
  { label: 'Checking animals and plants in your area',   target: 56 },
  { label: 'Building a picture of your land',            target: 74 },
  { label: 'Writing out your action plan',               target: 92 },
];

const TOTAL_MS = 22000;

function StepGenerating({ error }: { error: string | null }) {
  const [pct, setPct]         = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const rafRef                = useRef<number | null>(null);
  const startRef              = useRef<number | null>(null);

  useEffect(() => {
    if (error) return;

    function tick(now: number) {
      if (!startRef.current) startRef.current = now;
      const elapsed = now - startRef.current;
      const linear  = Math.min(elapsed / TOTAL_MS, 1);
      const eased   = 1 - Math.pow(1 - linear, 2.4);
      const next    = Math.min(Math.round(eased * 92), 92);

      setPct(next);
      const newStep = STEPS.findIndex((s) => next < s.target);
      setStepIdx(newStep === -1 ? STEPS.length - 1 : Math.max(0, newStep));

      if (next < 92) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [error]);

  const currentLabel = STEPS[stepIdx]?.label ?? STEPS[STEPS.length - 1].label;

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center bg-red-50">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Something went wrong</h2>
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 mb-6">{error}</p>
        <p className="text-xs text-gray-400">
          Make sure your <code className="bg-gray-100 px-1 rounded">ANTHROPIC_API_KEY</code> is set
          in your <code className="bg-gray-100 px-1 rounded">.env.local</code> file.
        </p>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div
        className="w-14 h-14 mx-auto mb-5 rounded-full flex items-center justify-center"
        style={{ backgroundColor: '#EAF3DE' }}
      >
        <span className="text-2xl">🌿</span>
      </div>

      <h2 className="text-2xl font-semibold text-gray-900 mb-1 text-center">
        Analyzing your property
      </h2>
      <p className="text-gray-400 text-sm mb-8 text-center">
        This usually takes 15 to 30 seconds.
      </p>

      <div className="mb-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-500 truncate pr-3">{currentLabel}...</span>
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

      <p className="text-xs text-center text-gray-400 mt-4">
        We are looking up real data for your specific piece of land. Soil, weather patterns, and local wildlife.
      </p>
    </div>
  );
}

// Property limit wall — shown when a tier is at its limit
function PropertyLimitWall({ tier }: { tier: string }) {
  const router = useRouter();

  // Free and Steward both cap at 1 property — next unlock is Naturalist (3 properties)
  const upgradeTarget = tier === 'naturalist' ? 'Conservationist' : 'Naturalist';
  const upgradeDetail =
    tier === 'naturalist'
      ? 'Conservationist gives you unlimited properties on one account.'
      : 'Naturalist lets you manage up to 3 properties on one account.';

  return (
    <div className="text-center py-8">
      <div
        className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center"
        style={{ backgroundColor: '#EAF3DE' }}
      >
        <span className="text-3xl">🔒</span>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">You are at your property limit</h2>
      <p className="text-sm text-gray-500 mb-2 leading-relaxed">
        Your {tier.charAt(0).toUpperCase() + tier.slice(1)} plan supports{' '}
        {tier === 'free' || tier === 'steward' ? '1 property' : '3 properties'}.{' '}
        {upgradeDetail}
      </p>
      <p className="text-xs text-gray-400 mb-6">
        Upgrade to {upgradeTarget} to keep adding land to your account.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex-1 py-3 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Back to dashboard
        </button>
        <button
          onClick={() => router.push('/upgrade')}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: '#3B6D11' }}
        >
          Upgrade to {upgradeTarget} →
        </button>
      </div>
    </div>
  );
}

// Main onboarding page

export default function OnboardingPage() {
  const router = useRouter();
  const {
    address, acreage,
    analyzeAndPlan, analyzeError,
    tier, canAddProperty,
  } = useStore();

  const [step, setStep] = useState(0);
  const [parcelLoading, setParcelLoading] = useState(false);
  const [suggested, setSuggested] = useState<SuggestedParcel | null>(null);
  const [mismatch, setMismatch] = useState(false);

  const MISMATCH_THRESHOLD = 0.50;

  const handleAddressNext = async () => {
    setParcelLoading(true);
    setSuggested(null);
    setMismatch(false);
    try {
      const res = await fetch('/api/parcel-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      const firstParcel = data?.parcels?.[0];
      if (firstParcel && firstParcel.coordinates?.length) {
        const parcelAcres: number = firstParcel.acreage ?? 0;
        const userAcres = parseFloat(acreage);
        let hasMismatch = false;
        if (!isNaN(userAcres) && userAcres > 0 && parcelAcres > 0) {
          hasMismatch = Math.abs(userAcres - parcelAcres) / parcelAcres > MISMATCH_THRESHOLD;
        }
        setSuggested({ coordinates: firstParcel.coordinates, acres: parcelAcres });
        setMismatch(hasMismatch);
      }
    } catch {
      // Fall through to manual draw
    } finally {
      setParcelLoading(false);
      setStep(1);
    }
  };

  const handleGoalsNext = async () => {
    setStep(3);
    const ok = await analyzeAndPlan();
    if (ok) router.push('/dashboard');
  };

  // All tiers at their limit get the same upgrade wall
  let cardContent: React.ReactNode;
  if (!canAddProperty) {
    cardContent = <PropertyLimitWall tier={tier} />;
  } else {
    cardContent = (
      <>
        <StepIndicator current={step} total={4} />
        {step === 0 && <StepAddress onNext={handleAddressNext} loading={parcelLoading} />}
        {step === 1 && (
          <StepBoundary
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
            suggested={suggested}
            mismatch={mismatch}
          />
        )}
        {step === 2 && <StepGoals onNext={handleGoalsNext} onBack={() => setStep(1)} />}
        {step === 3 && <StepGenerating error={analyzeError} />}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-6 h-14 flex items-center">
        <Link href="/" className="text-base font-semibold">
          <span style={{ color: '#3B6D11' }}>Land</span>Ethic.io
        </Link>
      </div>
      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {cardContent}
        </div>
      </div>
    </div>
  );
}
