'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from '@/lib/store';
import type { FoodPlot, HabitatPlan, NestingBox } from '@/types';
import AppHeader from '@/components/AppHeader';
import { Icon, Seal, Spinner } from '@/components/brand';

const DashboardMap = dynamic(() => import('@/components/DashboardMap'), { ssr: false });

type Kind = 'food' | 'boxes';

// Bright colors that read well on a satellite photo
const COLORS: Record<Kind, string[]> = {
  food:  ['#F2C14E', '#97C459', '#F08A3E', '#2BD4A0', '#E86AA6', '#6AB7E8'],
  boxes: ['#6AB7E8', '#F2C14E', '#E86AA6', '#2BD4A0', '#F08A3E', '#97C459', '#C49BF2', '#FFFFFF'],
};

const COPY: Record<Kind, { title: string; eyebrow: string; intro: string; empty: string; building: string; other: { href: string; label: string } }> = {
  food: {
    eyebrow: 'Food plot planner',
    title: 'Food plots for your land',
    intro: 'Where to put each plot, what to plant, how much seed to buy, and how to get the ground ready.',
    empty: 'We will study the satellite photo of your land, find the open ground that can be worked, and pick seeds that grow well in your county.',
    building: 'Studying your land and picking seeds…',
    other: { href: '/dashboard/nesting-boxes', label: 'Nesting box planner' },
  },
  boxes: {
    eyebrow: 'Nesting box planner',
    title: 'Nesting boxes for your land',
    intro: 'Which birds (and bats) to build for, what kind of box, how high, which way it faces, and exactly where it goes.',
    empty: 'We will study the satellite photo of your land and pick the birds and bats that fit your fields, woods edges, and water.',
    building: 'Studying your land and picking spots…',
    other: { href: '/dashboard/food-plots', label: 'Food plot planner' },
  },
};

const colorFor = (kind: Kind, i: number) => COLORS[kind][i % COLORS[kind].length];

function fmtLbs(n: number): string {
  if (n >= 10) return `${Math.round(n)}`;
  return `${Math.round(n * 10) / 10}`;
}

function Label({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-forest-700">
      {icon}
      {children}
    </p>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="mt-1.5 space-y-1.5">
      {items.map((step, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink">
          <span className="mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-forest-50 text-[10px] font-bold text-forest-700">
            {i + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function NumberBadge({ n, color }: { n: number; color: string }) {
  return (
    <span
      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow"
      style={{ background: color, textShadow: '0 0 2px rgba(0,0,0,0.45)' }}
    >
      {n}
    </span>
  );
}

function MapButton({ active, disabled, onClick }: { active: boolean; disabled: boolean; onClick: () => void }) {
  if (disabled) return null;
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`mt-2.5 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'border-forest-700 bg-forest-700 text-cream' : 'border-forest-200 bg-forest-50 text-forest-700 hover:bg-forest-200/40'
      }`}
    >
      <Icon.Pin size={13} />
      {active ? 'Showing on map' : 'Show on map'}
    </button>
  );
}

function FoodPlotCard({ plot, n, color, active, onShow }: {
  plot: FoodPlot; n: number; color: string; active: boolean; onShow: () => void;
}) {
  return (
    <div className={`card p-5 transition-shadow ${active ? 'ring-2 ring-forest-600' : ''}`}>
      <div className="flex items-start gap-3">
        <NumberBadge n={n} color={color} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="font-display text-lg font-bold leading-snug text-ink">{plot.name}</h2>
            <span className="text-sm font-semibold text-ink-soft">
              {plot.acres} {plot.acres === 1 ? 'acre' : 'acres'}
            </span>
          </div>
          {plot.targetWildlife.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {plot.targetWildlife.map((w) => <span key={w} className="tag">{w}</span>)}
            </div>
          )}
        </div>
      </div>

      {plot.where && (
        <div className="mt-4">
          <Label icon={<Icon.Pin size={12} />}>Where</Label>
          <p className="mt-1 text-sm leading-relaxed text-ink">{plot.where}</p>
          <MapButton active={active} disabled={!plot.area} onClick={onShow} />
        </div>
      )}

      {plot.seedMix.length > 0 && (
        <div className="mt-4">
          <Label icon={<Icon.Sprout size={12} />}>Seed mix</Label>
          <div className="mt-1.5 overflow-hidden rounded-xl border border-paper-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream-2 text-[11px] uppercase tracking-wider text-ink-faint">
                <tr>
                  <th className="px-3 py-2 font-bold">Seed</th>
                  <th className="px-3 py-2 text-right font-bold">Per acre</th>
                  <th className="px-3 py-2 text-right font-bold">This plot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {plot.seedMix.map((s) => (
                  <tr key={s.seed} className="align-top">
                    <td className="px-3 py-2 text-ink">
                      <span className="font-semibold">{s.seed}</span>
                      {s.notes && <span className="mt-0.5 block text-xs text-ink-soft">{s.notes}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-ink-soft">{fmtLbs(s.lbsPerAcre)} lbs</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-ink">
                      {fmtLbs(s.lbsPerAcre * plot.acres)} lbs
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {plot.plantingWindow && (
        <div className="mt-4">
          <Label icon={<Icon.Sun size={12} />}>When to plant</Label>
          <p className="mt-1 text-sm leading-relaxed text-ink">{plot.plantingWindow}</p>
        </div>
      )}

      {plot.soilPrep.length > 0 && (
        <div className="mt-4">
          <Label icon={<Icon.Check size={12} />}>Get the ground ready</Label>
          <Steps items={plot.soilPrep} />
        </div>
      )}

      {plot.limeAndFertilizer && (
        <div className="mt-4 rounded-xl border border-paper-line bg-cream-2 p-3">
          <p className="text-xs font-bold text-ink">Lime and fertilizer</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{plot.limeAndFertilizer}</p>
        </div>
      )}

      {plot.maintenance.length > 0 && (
        <div className="mt-4">
          <Label icon={<Icon.Leaf size={12} />}>First-year care</Label>
          <Steps items={plot.maintenance} />
        </div>
      )}

      {plot.why && (
        <div className="mt-4 rounded-xl border-l-[3px] border-forest-600 bg-forest-50 p-3">
          <p className="text-sm leading-relaxed text-forest-800">{plot.why}</p>
        </div>
      )}
    </div>
  );
}

function NestingBoxCard({ box, n, color, active, onShow }: {
  box: NestingBox; n: number; color: string; active: boolean; onShow: () => void;
}) {
  const facts: [string, string | undefined][] = [
    ['Mount height', box.mountHeight],
    ['Hole faces', box.facing],
    ['Spacing', box.spacing],
    ['Put up by', box.putUpBy],
    ['Clean out', box.cleanOut],
  ];
  return (
    <div className={`card p-5 transition-shadow ${active ? 'ring-2 ring-forest-600' : ''}`}>
      <div className="flex items-start gap-3">
        <NumberBadge n={n} color={color} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="font-display text-lg font-bold leading-snug text-ink">{box.species}</h2>
            <span className="text-sm font-semibold text-ink-soft">
              {box.count} {box.count === 1 ? 'box' : 'boxes'}
            </span>
          </div>
          {box.boxType && <p className="mt-1 text-sm text-ink-soft">{box.boxType}</p>}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {facts.filter(([, v]) => !!v).map(([k, v]) => (
          <div key={k} className="rounded-xl border border-paper-line bg-cream-2 px-3 py-2">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{k}</dt>
            <dd className="mt-0.5 text-sm font-semibold leading-snug text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      {box.where && (
        <div className="mt-4">
          <Label icon={<Icon.Pin size={12} />}>Where</Label>
          <p className="mt-1 text-sm leading-relaxed text-ink">{box.where}</p>
          <MapButton active={active} disabled={!box.area} onClick={onShow} />
        </div>
      )}

      {box.tips.length > 0 && (
        <div className="mt-4">
          <Label icon={<Icon.Check size={12} />}>How to put it up</Label>
          <Steps items={box.tips} />
        </div>
      )}

      {box.why && (
        <div className="mt-4 rounded-xl border-l-[3px] border-forest-600 bg-forest-50 p-3">
          <p className="text-sm leading-relaxed text-forest-800">{box.why}</p>
        </div>
      )}
    </div>
  );
}

/** Shopping list across every plot: total pounds of each seed. */
function SeedShoppingList({ plots }: { plots: FoodPlot[] }) {
  const totals = new Map<string, number>();
  for (const p of plots) for (const s of p.seedMix) totals.set(s.seed, (totals.get(s.seed) ?? 0) + s.lbsPerAcre * p.acres);
  if (!totals.size) return null;
  const acres = plots.reduce((a, p) => a + p.acres, 0);
  return (
    <div className="card p-5">
      <p className="eyebrow">Seed shopping list</p>
      <p className="mt-1 text-xs text-ink-soft">
        For all {plots.length} {plots.length === 1 ? 'plot' : 'plots'} ({Math.round(acres * 100) / 100} acres). Buy about 10% extra to cover thin spots.
      </p>
      <ul className="mt-3 divide-y divide-paper-line">
        {Array.from(totals.entries()).map(([seed, lbs]) => (
          <li key={seed} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="text-ink">{seed}</span>
            <span className="font-semibold text-ink">{fmtLbs(lbs)} lbs</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HabitatPlanner({ kind }: { kind: Kind }) {
  const { property, tier, boundary, address, userGoalsText, activePropertyId } = useStore();
  const [habitat, setHabitat] = useState<HabitatPlan | null | undefined>(undefined);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const copy = COPY[kind];
  const unlocked = tier === 'conservationist';

  useEffect(() => {
    if (!unlocked || !activePropertyId) return;
    let cancelled = false;
    setHabitat(undefined);
    setSelected(null);
    fetch(`/api/properties/${activePropertyId}/habitat`)
      .then((res) => (res.ok ? res.json() : { habitat: null }))
      .then((data: { habitat: HabitatPlan | null }) => { if (!cancelled) setHabitat(data.habitat); })
      .catch(() => { if (!cancelled) setHabitat(null); });
    return () => { cancelled = true; };
  }, [unlocked, activePropertyId]);

  const items: (FoodPlot | NestingBox)[] = useMemo(
    () => (habitat ? (kind === 'food' ? habitat.foodPlots : habitat.nestingBoxes) : []),
    [habitat, kind]
  );
  const colorOf = (i: number) => colorFor(kind, i);

  const features = useMemo(
    () => items.flatMap((it, i) => (it.area && it.area.length >= 4 ? [{ ring: it.area, color: colorFor(kind, i), number: i + 1 }] : [])),
    [items, kind]
  );
  const highlight = useMemo(() => {
    const i = items.findIndex((it) => it.id === selected);
    const it = items[i];
    if (!it?.area) return null;
    return { ring: it.area, color: colorFor(kind, i), label: 'name' in it ? it.name : it.species };
  }, [items, selected, kind]);

  const build = async () => {
    if (!activePropertyId) return;
    setBuilding(true);
    setError(null);
    try {
      const res = await fetch(`/api/properties/${activePropertyId}/habitat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userGoalsText: userGoalsText || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { habitat?: HabitatPlan; error?: string };
      if (!res.ok || !data.habitat) throw new Error(data.error ?? 'Could not build your plan. Try again in a minute.');
      setHabitat(data.habitat);
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build your plan. Try again in a minute.');
    } finally {
      setBuilding(false);
    }
  };

  const show = (id: string) => {
    const next = selected === id ? null : id;
    setSelected(next);
    if (next) mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const header = <AppHeader back={{ href: '/dashboard', label: 'Back to dashboard' }} />;

  // ── Locked (below Conservationist) ──────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-cream-2">
        {header}
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <Seal size={64} tone="rust">{kind === 'food' ? <Icon.Sprout size={28} /> : <Icon.Bird size={28} />}</Seal>
          <p className="eyebrow mt-5">{copy.eyebrow}</p>
          <h1 className="mt-2 text-2xl font-bold text-ink">{copy.title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
            {copy.intro} Part of the Conservationist plan, along with weekly checklists and unlimited properties.
          </p>
          <Link href="/upgrade" className="btn-primary mt-6 !text-sm">See plans <Icon.Arrow size={16} /></Link>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-cream-2">
        {header}
        <div className="px-6 py-20 text-center">
          <p className="text-sm text-ink-soft">Add a property first, then come back to plan it.</p>
          <Link href="/onboarding" className="btn-primary mt-5 !text-sm">Get started <Icon.Arrow size={16} /></Link>
        </div>
      </div>
    );
  }

  const note = habitat ? (kind === 'food' ? habitat.foodPlotNote : habitat.nestingBoxNote) : undefined;
  const builtOn = habitat ? new Date(habitat.generatedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '';

  return (
    <div className="min-h-screen bg-cream-2">
      {header}
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:py-8">
        {/* Title */}
        <div className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="eyebrow">{copy.eyebrow} · {property.name}</p>
              <h1 className="mt-1.5 text-xl font-bold leading-snug text-ink sm:text-2xl">{copy.title}</h1>
            </div>
            <Link href={copy.other.href} className="inline-flex items-center gap-1 text-xs font-semibold text-forest-700 hover:text-forest-800">
              {copy.other.label} <Icon.Arrow size={13} />
            </Link>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{copy.intro}</p>
          {note && <p className="mt-3 rounded-xl bg-forest-50 p-3 text-sm leading-relaxed text-forest-800">{note}</p>}
          {habitat && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-paper-line pt-3">
              <p className="text-xs text-ink-faint">Built {builtOn} from the satellite photo of your land</p>
              <button
                onClick={build}
                disabled={building}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
              >
                {building ? <Spinner className="h-3.5 w-3.5" /> : <Icon.Refresh size={14} />}
                {building ? 'Rebuilding…' : 'Rebuild'}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-rust-600/40 bg-rust-100 px-4 py-3 text-sm text-rust-700">{error}</div>
        )}

        {/* Loading saved plan */}
        {habitat === undefined && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-soft">
            <Spinner /> Loading…
          </div>
        )}

        {/* Nothing built yet */}
        {habitat === null && (
          <div className="card p-6 text-center">
            <Seal size={56}>{kind === 'food' ? <Icon.Sprout size={24} /> : <Icon.Bird size={24} />}</Seal>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ink-soft">{copy.empty}</p>
            <p className="mx-auto mt-2 max-w-md text-xs text-ink-faint">
              This builds your food plot and nesting box plans together and takes about a minute.
            </p>
            <button onClick={build} disabled={building} className="btn-primary mt-5 !text-sm">
              {building ? <><Spinner className="h-4 w-4" /> {copy.building}</> : <>Build my plan <Icon.Arrow size={16} /></>}
            </button>
          </div>
        )}

        {habitat && (
          <>
            <div ref={mapRef} className="scroll-mt-24">
              <DashboardMap
                boundary={boundary}
                address={address}
                propertyName={property.name}
                acreage={property.acreage}
                county={property.county}
                state={property.state}
                propertyId={property.id}
                autoFlyover={false}
                height={300}
                features={features}
                highlight={highlight}
              />
              {features.length > 0 && (
                <p className="mt-2 text-xs text-ink-soft">Numbers on the map match the cards below. Tap &ldquo;Show on map&rdquo; to zoom to one.</p>
              )}
            </div>

            {items.length === 0 ? (
              <div className="card p-6 text-center text-sm text-ink-soft">
                {kind === 'food'
                  ? 'We did not find ground on this property that suits a food plot.'
                  : 'We did not find good spots for nesting boxes on this property.'}
              </div>
            ) : kind === 'food' ? (
              <>
                {(items as FoodPlot[]).map((plot, i) => (
                  <FoodPlotCard key={plot.id} plot={plot} n={i + 1} color={colorOf(i)} active={selected === plot.id} onShow={() => show(plot.id)} />
                ))}
                <SeedShoppingList plots={items as FoodPlot[]} />
              </>
            ) : (
              <>
                <p className="px-1 text-sm text-ink-soft">
                  {(items as NestingBox[]).reduce((a, b) => a + b.count, 0)} boxes in {items.length} {items.length === 1 ? 'group' : 'groups'}.
                </p>
                {(items as NestingBox[]).map((box, i) => (
                  <NestingBoxCard key={box.id} box={box} n={i + 1} color={colorOf(i)} active={selected === box.id} onShow={() => show(box.id)} />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
