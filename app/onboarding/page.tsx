'use client';

import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import DrawablePropertyMap from '@/components/DrawablePropertyMap';
import AddressSearch from '@/components/AddressSearch';
import { locateAddress, type Place } from '@/lib/places';
import dynamic from 'next/dynamic';
import type { Goal } from '@/types';
import { TIER_LABELS } from '@/lib/pricing';
import AppHeader from '@/components/AppHeader';
import WaitScreen from '@/components/WaitScreen';
import { Icon, Seal, Spinner } from '@/components/brand';
import { ReportLink } from '@/components/ReportProblem';

const ParcelConfirmMap = dynamic(() => import('@/components/ParcelConfirmMap'), { ssr: false });

type IconComponent = ComponentType<{ size?: number; className?: string }>;

// Goal options — line icons stand in for emoji (Almanac Heritage design)
const GOALS: { id: Goal; label: string; icon: IconComponent }[] = [
  { id: 'wildlife_diversity', label: 'Wildlife diversity', icon: Icon.Paw },
  { id: 'deer_hunting',       label: 'Deer hunting',       icon: Icon.Antler },
  { id: 'bird_sanctuary',     label: 'Bird sanctuary',     icon: Icon.Bird },
  { id: 'pollinator_habitat', label: 'Pollinator habitat', icon: Icon.Flower },
  { id: 'soil_restoration',   label: 'Soil restoration',   icon: Icon.Sprout },
  { id: 'turkey_habitat',     label: 'Turkey habitat',     icon: Icon.Turkey },
  { id: 'native_plants',      label: 'Native plants',      icon: Icon.Leaf },
  { id: 'water_quality',      label: 'Water quality',      icon: Icon.Drop },
];

const STEP_NAMES = ['Address', 'Boundary', 'Goals', 'Your plan'];

// Step indicator
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-7">
      <div className="mb-2 flex items-center justify-between">
        <span className="eyebrow">Step {current + 1} of {total}</span>
        <span className="text-xs font-medium text-ink-soft">{STEP_NAMES[current]}</span>
      </div>
      <div className="flex items-center gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i < current ? 'bg-forest-700' : i === current ? 'bg-forest-600' : 'bg-paper-line'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function Note({ tone, children }: { tone: 'forest' | 'rust' | 'teal'; children: ReactNode }) {
  const tones = {
    forest: 'border-forest-600 bg-forest-50 text-forest-800',
    rust:   'border-rust-600 bg-rust-100 text-rust-700',
    teal:   'border-teal-700 bg-teal-50 text-teal-700',
  };
  return (
    <div className={`mb-5 rounded-r-xl border-l-[3px] p-3.5 text-xs leading-relaxed ${tones[tone]}`}>
      {children}
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-paper-line bg-white px-4 py-3 text-sm text-ink placeholder-ink-faint focus:border-transparent focus:outline-none focus:ring-2 focus:ring-forest-600';

// Step 1: Address
interface StepAddressProps {
  onNext: () => void;
  loading: boolean;
}

function StepAddress({ onNext, loading }: StepAddressProps) {
  const { address, setAddress, location, setLocation, acreage, setAcreage } = useStore();
  // The suggestion they picked (for the confirmation line); falls back to the saved spot
  const [pickedPlace, setPickedPlace] = useState<Place | null>(null);
  const picked: Place | null = location
    ? pickedPlace?.address === address
      ? pickedPlace
      : { ...location, id: 'saved', label: address, detail: '', address, kind: 'saved' }
    : null;
  const where = picked
    ? picked.kind === 'coordinates'
      ? picked.detail
      : [picked.county ? `${picked.county} County` : null, picked.state].filter(Boolean).join(', ')
    : '';

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (address.trim() && !loading) onNext(); }}>
      <h2 className="mb-2 text-2xl font-bold text-ink">
        Tell us about your property
      </h2>
      <p className="mb-7 text-sm leading-relaxed text-ink-soft">
        We pull up a satellite view of your land and map your property lines straight from your address.
        No screenshots needed.
      </p>
      <div className="space-y-5">
        <div>
          <label htmlFor="address" className="mb-1.5 block text-sm font-semibold text-ink">
            Property address
          </label>
          <AddressSearch
            id="address"
            value={address}
            onChange={(text) => {
              setAddress(text);
              // Typing again means the picked spot no longer matches
              if (location) setLocation(null);
            }}
            onPick={(place) => {
              setPickedPlace(place);
              setAddress(place.address);
              setLocation({ lng: place.lng, lat: place.lat, county: place.county, state: place.state });
            }}
            picked={picked}
            className={inputClass}
          />
          {picked ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-forest-700">
              <Icon.Check size={13} /> Got it{where ? ` — ${where}` : ''}. The map will start right there.
            </p>
          ) : (
            <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
              Pick your address from the list as you type. No street address for your land? Paste its GPS
              coordinates instead, like <span className="whitespace-nowrap font-medium text-ink-soft">40.44062, -79.99589</span>{' '}
              (in Google Maps, press and hold on your land to copy them).
            </p>
          )}
        </div>
        <div>
          <label htmlFor="acreage" className="mb-1.5 block text-sm font-semibold text-ink">
            Approximate acreage{' '}
            <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <input
            id="acreage"
            type="text"
            inputMode="decimal"
            value={acreage}
            onChange={(e) => setAcreage(e.target.value)}
            placeholder="e.g. 120"
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-ink-faint">
            We will try to figure this out from your property lines. Enter it here if you already know it.
          </p>
        </div>
      </div>
      <button type="submit" disabled={!address.trim() || loading} className="btn-primary mt-8 w-full">
        {loading ? (
          <>
            <Spinner /> Looking up your property…
          </>
        ) : (
          <>
            Find my property <Icon.Arrow size={18} />
          </>
        )}
      </button>
    </form>
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
  const { address: storeAddress, location, acreage, setAcreage, boundary, setBoundary } = useStore();

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
        <h2 className="mb-2 text-2xl font-bold text-ink">
          Is this your property?
        </h2>
        <p className="mb-5 text-sm leading-relaxed text-ink-soft">
          We found this boundary from public records. Take a look and make sure it covers the right land.
        </p>

        <ParcelConfirmMap coordinates={suggested.coordinates} className="mb-4" />

        <Note tone="forest">
          We estimated about <strong>{suggested.acres.toFixed(1)} acres</strong> from this boundary.{' '}
          {acreage ? `You entered ${acreage} acres.` : 'If that looks right, go ahead and confirm.'}
        </Note>

        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <button onClick={onBack} className="btn-outline !px-5 !py-3 !text-sm">
            Back
          </button>
          <button onClick={() => setMode('draw')} className="btn-outline !px-5 !py-3 !text-sm">
            Draw it myself
          </button>
          <button onClick={handleAcceptSuggested} className="btn-primary flex-1 !py-3 !text-sm">
            Yes, that is my land <Icon.Arrow size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Draw mode
  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-ink">
        Draw your property boundary
      </h2>
      <p className="mb-4 text-sm leading-relaxed text-ink-soft">
        Tap the corners of your property on the satellite map to trace your boundary.
        The map will start centered on your address.
      </p>

      {mismatch && (
        <Note tone="rust">
          The boundary we found did not match the acreage you entered, so we need you to draw it yourself.
          Tap the corners of your land on the map below.
        </Note>
      )}

      {!mismatch && !suggested && (
        <Note tone="teal">
          We could not find public records for your property, so trace it yourself.
          Tap at least 3 corners of your land on the map below.
        </Note>
      )}

      <DrawablePropertyMap
        address={storeAddress}
        center={location ? [location.lng, location.lat] : undefined}
        onBoundaryChange={handleBoundaryChange}
        className="mb-5"
      />

      {canProceedDraw ? (
        <Note tone="forest">Boundary saved. Your acreage estimate has been updated.</Note>
      ) : (
        <Note tone="rust">
          Tap at least 3 points on the map to trace your property boundary, then hit <strong>Confirm boundary</strong>.
        </Note>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <button
          onClick={() => {
            if (suggested && !mismatch) {
              setMode('confirm');
            } else {
              onBack();
            }
          }}
          className="btn-outline !px-5 !py-3 !text-sm"
        >
          Back
        </button>
        <button onClick={onNext} disabled={!canProceedDraw} className="btn-primary flex-1 !py-3 !text-sm">
          Confirm boundary <Icon.Arrow size={16} />
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
      <h2 className="mb-2 text-2xl font-bold text-ink">
        What are your goals for this land?
      </h2>
      <p className="mb-6 text-sm leading-relaxed text-ink-soft">
        Pick everything that fits. This is how we figure out which tasks matter most for your land.
      </p>
      <div className="mb-7 grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-2">
        {GOALS.map((g) => {
          const sel = goals.includes(g.id);
          const GoalIcon = g.icon;
          return (
            <button
              key={g.id}
              onClick={() => toggle(g.id)}
              aria-pressed={sel}
              className={`flex items-center gap-3 rounded-xl border-[1.5px] px-3.5 py-3 text-left transition-all ${
                sel
                  ? 'border-forest-700 bg-forest-50'
                  : 'border-paper-line bg-cream hover:bg-cream-2'
              }`}
            >
              <span className={sel ? 'text-forest-700' : 'text-ink-soft'}>
                <GoalIcon size={20} />
              </span>
              <span className={`text-sm font-semibold ${sel ? 'text-forest-800' : 'text-ink'}`}>
                {g.label}
              </span>
              <span
                className={`ml-auto flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                  sel ? 'border-forest-700 bg-forest-700 text-cream' : 'border-paper-line'
                }`}
              >
                {sel && <Icon.Check size={11} />}
              </span>
            </button>
          );
        })}
      </div>
      {/* Free-text goals */}
      <div className="mb-6">
        <label htmlFor="goals-text" className="mb-1.5 block text-sm font-semibold text-ink">
          Anything specific you want to work on? <span className="font-normal text-ink-faint">(optional)</span>
        </label>
        <textarea
          id="goals-text"
          value={userGoalsText}
          onChange={(e) => setUserGoalsText(e.target.value)}
          rows={3}
          placeholder="e.g. I want to plant food plots but don't know where to start. I'd love to add more white oaks and learn the best spots to put them. We also have a wet area I've been ignoring."
          className={`${inputClass} resize-none`}
        />
        <p className="mt-1.5 text-xs text-ink-faint">The more detail you give, the more specific your action plan will be.</p>
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <button onClick={onBack} className="btn-outline !px-5 !py-3 !text-sm">
          Back
        </button>
        <button onClick={onNext} disabled={goals.length === 0} className="btn-primary flex-1 !py-3 !text-sm">
          Build my plan <Icon.Arrow size={16} />
        </button>
      </div>
    </div>
  );
}

// Step 4: Generating — the full-screen WaitScreen shows progress; this card
// only shows what is behind it, plus the error state if something fails.

function StepGenerating({ error, onRetry, onBack }: { error: string | null; onRetry: () => void; onBack: () => void }) {
  if (error) {
    return (
      <div className="py-6 text-center">
        <div className="mb-5"><Seal tone="rust" size={60}><Icon.Warning size={26} /></Seal></div>
        <h2 className="mb-3 text-xl font-bold text-ink">Something went wrong</h2>
        <p className="mb-3 rounded-xl border border-rust-600/40 bg-rust-100 px-4 py-3 text-sm text-rust-700">{error}</p>
        <div className="mb-6"><ReportLink error={error} /></div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <button onClick={onBack} className="btn-outline !py-3 !text-sm">Change my goals</button>
          <button onClick={onRetry} className="btn-primary !py-3 !text-sm">
            <Icon.Refresh size={16} /> Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-10 text-center">
      <div className="mb-5"><Seal size={60}><Icon.Compass size={28} /></Seal></div>
      <h2 className="mb-1 text-2xl font-bold text-ink">Analyzing your property</h2>
      <p className="flex items-center justify-center gap-2 text-sm text-ink-soft"><Spinner /> Almost there&hellip;</p>
    </div>
  );
}

// Property limit wall — shown when a tier is at its limit
function PropertyLimitWall({ tier }: { tier: keyof typeof TIER_LABELS }) {
  const router = useRouter();

  // Free and Steward both cap at 1 property — next unlock is Naturalist (3 properties)
  const upgradeTarget = tier === 'naturalist' ? 'Conservationist' : 'Naturalist';
  const upgradeDetail =
    tier === 'naturalist'
      ? 'Conservationist lets you manage up to 10 properties on one account.'
      : 'Naturalist lets you manage up to 3 properties on one account.';

  return (
    <div className="py-6 text-center">
      <div className="mb-5"><Seal size={60}><Icon.Lock size={24} /></Seal></div>
      <h2 className="mb-2 text-xl font-bold text-ink">You are at your property limit</h2>
      <p className="mb-2 text-sm leading-relaxed text-ink-soft">
        Your {TIER_LABELS[tier]} plan supports{' '}
        {tier === 'free' || tier === 'steward' ? '1 property' : tier === 'naturalist' ? '3 properties' : '10 properties'}.{' '}
        {upgradeDetail}
      </p>
      <p className="mb-6 text-xs text-ink-faint">
        Upgrade to {upgradeTarget} to keep adding land to your account.
      </p>
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <button onClick={() => router.push('/dashboard')} className="btn-outline flex-1 !py-3 !text-sm">
          Back to dashboard
        </button>
        <button onClick={() => router.push('/upgrade')} className="btn-primary flex-1 !py-3 !text-sm">
          Upgrade to {upgradeTarget}
        </button>
      </div>
    </div>
  );
}

// Main onboarding page

export default function OnboardingPage() {
  const router = useRouter();
  const {
    address, acreage, location, setLocation,
    analyzeAndPlan, analyzeError, isAnalyzing, analyzeStage,
    tier, canAddProperty, access,
  } = useStore();

  // Free plan (or a cancelled plan) has ended — adding a property needs a plan first
  useEffect(() => {
    if (access?.locked) router.replace('/upgrade');
  }, [access?.locked, router]);

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
      // Didn't pick a suggestion? Find the best match for what they typed.
      let spot = location;
      if (!spot) {
        spot = await locateAddress(address, process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
        if (spot) setLocation(spot);
      }
      const res = await fetch('/api/parcel-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, ...(spot ? { lat: spot.lat, lng: spot.lng } : {}) }),
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
    // The WaitScreen sends the user to the dashboard when they are ready
    // (right away, or after the clip they are watching if they choose).
    await analyzeAndPlan();
  };

  // All tiers at their limit get the same upgrade wall
  let cardContent: ReactNode;
  if (!canAddProperty && step < 3) {
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
        {step === 3 && (
          <StepGenerating
            error={analyzeError}
            onRetry={handleGoalsNext}
            onBack={() => setStep(2)}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream-2">
      <AppHeader width="max-w-5xl" />
      <WaitScreen
        active={step === 3 && isAnalyzing}
        failed={!!analyzeError}
        stage={analyzeStage}
        flow="new"
        onDone={() => router.push('/dashboard')}
      />
      <div className="flex flex-1 items-start justify-center px-4 py-6 sm:py-10">
        <div className="card w-full max-w-lg p-5 sm:p-8">
          {cardContent}
        </div>
      </div>
    </div>
  );
}
