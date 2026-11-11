'use client';

import Link from 'next/link';
import { useRef, useState, useEffect, type ComponentType } from 'react';
import { useStore } from '@/lib/store';
import { readImageForUpload } from '@/lib/image';
import AppHeader from '@/components/AppHeader';
import { useRedirectWhenLocked } from '@/components/FreePlan';
import { Icon, Seal, Spinner } from '@/components/brand';

// ── Types ──────────────────────────────────────────────────────────────────

interface SpeciesResult {
  taxonId: number;
  commonName: string;
  scientificName: string;
  iconicTaxon: string;
  photoUrl: string | null;
  score: number;
  wikipedia: string | null;
  conservationStatus: string | null;
}

interface NearbySpecies {
  taxonId: number;
  commonName: string;
  scientificName: string;
  iconicTaxon: string;
  photoUrl: string | null;
  observationCount: number;
  wikipedia: string | null;
}

interface SavedSpeciesId {
  id: string;
  propertyId: string | null;
  thumbnail: string | null;
  commonName: string;
  scientificName: string | null;
  iconicTaxon: string | null;
  score: number | null;
  results: SpeciesResult[];
  createdAt: string;
}

type IconComponent = ComponentType<{ size?: number; className?: string }>;

// Line icons stand in for emoji (Almanac Heritage design).
const ICONIC_ICON: Record<string, IconComponent> = {
  Plantae: Icon.Leaf, Animalia: Icon.Paw, Aves: Icon.Bird, Mammalia: Icon.Antler,
  Reptilia: Icon.Lizard, Amphibia: Icon.Lizard, Insecta: Icon.Bug, Fungi: Icon.Mushroom,
  Arachnida: Icon.Bug, Actinopterygii: Icon.Fish, Mollusca: Icon.Paw, Unknown: Icon.Search,
};

const FILTER_LABELS: Record<string, string> = {
  All: 'All', Plantae: 'Plants', Aves: 'Birds', Mammalia: 'Mammals', Insecta: 'Insects', Animalia: 'Other animals',
};

function TaxonIcon({ iconicTaxon, size = 22, className = '' }: { iconicTaxon: string; size?: number; className?: string }) {
  const C = ICONIC_ICON[iconicTaxon] ?? Icon.Search;
  return <C size={size} className={className} />;
}

// ── MatchList ──────────────────────────────────────────────────────────────

function MatchList({ results }: { results: SpeciesResult[] }) {
  if (results.length === 0) return null;
  return (
    <>
      {results.map((r, i) => (
        <div key={`${r.taxonId}-${i}`} className={`flex items-center gap-3 rounded-xl border p-3 ${i === 0 ? 'border-forest-200 bg-forest-50' : 'border-paper-line'}`}>
          {r.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote iNaturalist thumbnail
            <img src={r.photoUrl} alt={r.commonName} className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-cream-2 text-forest-700">
              <TaxonIcon iconicTaxon={r.iconicTaxon} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{r.commonName}</p>
            <p className="text-xs italic text-ink-soft">{r.scientificName}</p>
            {r.conservationStatus && (
              <span className="mt-1 inline-block rounded bg-rust-100 px-1.5 py-0.5 text-xs text-rust-700">{r.conservationStatus}</span>
            )}
          </div>
          <div className="flex-shrink-0 text-right">
            <p className={`text-sm font-bold ${i === 0 ? 'text-forest-700' : 'text-ink-soft'}`}>{r.score}%</p>
            <p className="text-xs text-ink-faint">match</p>
          </div>
        </div>
      ))}
      {results[0].wikipedia && (
        <a
          href={results[0].wikipedia}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block text-center text-xs font-semibold text-forest-700 underline"
        >
          Learn more about {results[0].commonName}
        </a>
      )}
    </>
  );
}

// ── IdentifyPanel ──────────────────────────────────────────────────────────

function IdentifyPanel({
  lat, lng, propertyId, onSaved,
}: {
  lat?: number;
  lng?: number;
  propertyId?: string;
  onSaved?: (item: SavedSpeciesId) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SpeciesResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    const [full, thumb] = await Promise.all([
      readImageForUpload(file),
      readImageForUpload(file, 320, 0.72), // small copy kept in your history
    ]);
    setPreview(full);
    setThumbnail(thumb.startsWith('data:image/jpeg') ? thumb : null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const identify = async () => {
    if (!preview) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const base64 = preview.split(',')[1];
      const mimeType = preview.split(';')[0].split(':')[1];
      const res = await fetch('/api/identify-species', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType, lat, lng, thumbnail, propertyId }),
      });
      const data = await res.json() as { results?: SpeciesResult[]; saved?: SavedSpeciesId | null; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Identification failed');
      setResults(data.results ?? []);
      if (data.saved) onSaved?.(data.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setThumbnail(null);
    setResults(null);
    setError(null);
  };

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-paper-line px-5 py-4">
        <p className="eyebrow">Identify a species</p>
        <p className="mt-1 text-xs text-ink-soft">Upload or drop a photo of any plant, animal, or fungus on your land</p>
      </div>

      {!preview ? (
        // Drop zone
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
          className="m-4 flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-paper-line p-8 transition-colors hover:border-forest-600 hover:bg-forest-50 sm:p-10"
        >
          <Seal size={56}><Icon.Camera size={26} /></Seal>
          <p className="text-center text-sm font-semibold text-ink">Drop a photo here or tap to upload</p>
          <p className="text-center text-xs text-ink-soft">JPG, PNG, HEIC — any photo from your phone or camera</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          />
        </div>
      ) : (
        <div className="space-y-4 p-4">
          {/* Preview */}
          <div className="relative overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
            <img src={preview} alt="Your upload" className="max-h-64 w-full object-cover" />
            <button
              onClick={reset}
              aria-label="Remove photo"
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-cream/90 text-ink-soft hover:bg-cream"
            >
              ✕
            </button>
          </div>

          {/* Identify button */}
          {!results && !loading && (
            <button onClick={identify} className="btn-primary w-full !text-sm">
              Identify this species <Icon.Arrow size={16} />
            </button>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-ink-soft">
              <Spinner /> Looking at your photo&hellip;
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-rust-600/40 bg-rust-100 px-4 py-3 text-sm text-rust-700">
              {error}
            </div>
          )}

          {/* Results */}
          {results && results.length > 0 && (
            <div className="space-y-2">
              <p className="eyebrow">Top matches</p>
              <MatchList results={results} />
              <button onClick={reset} className="btn-outline mt-1 w-full !py-2.5 !text-sm">
                Identify another photo
              </button>
            </div>
          )}

          {results && results.length === 0 && (
            <div className="py-4 text-center text-sm text-ink-soft">
              <p>We couldn&apos;t confidently identify this species.</p>
              <p className="mt-1 text-xs text-ink-faint">Try a closer photo with good lighting.</p>
              <button onClick={reset} className="mt-3 text-xs font-semibold text-forest-700 underline">Try another photo</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── RecentIds ──────────────────────────────────────────────────────────────

function formatWhen(iso: string, withTime = false) {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

function RecentIds({
  items, loading, onRemove,
}: {
  items: SavedSpeciesId[];
  loading: boolean;
  onRemove: (id: string) => Promise<void>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const open = items.find((it) => it.id === openId) ?? null;

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-paper-line px-5 py-4">
        <p className="eyebrow">Your recent identifications</p>
        <p className="mt-1 text-xs text-ink-soft">
          Everything you&apos;ve identified, newest first. Tap one to see the details again.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-soft">
          <Spinner /> Loading your identifications&hellip;
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="px-6 py-10 text-center">
          <div className="mb-3"><Seal size={48}><Icon.Camera size={20} /></Seal></div>
          <p className="text-sm text-ink-soft">Your identifications will show up here.</p>
          <p className="mt-1 text-xs text-ink-faint">Identify a photo above to start your field log.</p>
        </div>
      )}

      {/* Details for the selected identification */}
      {open && (
        <div className="space-y-3 border-b border-paper-line bg-cream-2 p-4">
          <div className="flex gap-4">
            {open.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element -- stored data URL thumbnail
              <img src={open.thumbnail} alt={open.commonName} className="h-28 w-28 flex-shrink-0 rounded-xl object-cover sm:h-32 sm:w-32" />
            ) : (
              <div className="flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-xl bg-cream text-forest-700">
                <TaxonIcon iconicTaxon={open.iconicTaxon ?? 'Unknown'} size={36} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold leading-tight text-ink">{open.commonName}</p>
              {open.scientificName && <p className="text-sm italic text-ink-soft">{open.scientificName}</p>}
              <p className="mt-2 text-xs text-ink-faint">Identified {formatWhen(open.createdAt, true)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => setOpenId(null)}
                  className="rounded-lg border border-paper-line bg-cream px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper-line"
                >
                  Close
                </button>
                <button
                  onClick={async () => {
                    setRemoving(true);
                    await onRemove(open.id);
                    setRemoving(false);
                    setOpenId(null);
                  }}
                  disabled={removing}
                  className="rounded-lg border border-rust-600/40 px-3 py-1.5 text-xs font-semibold text-rust-700 hover:bg-rust-100 disabled:opacity-60"
                >
                  {removing ? 'Removing…' : 'Remove from history'}
                </button>
              </div>
            </div>
          </div>
          {open.results.length > 0 && (
            <div className="space-y-2">
              <p className="eyebrow">Top matches</p>
              <MatchList results={open.results} />
            </div>
          )}
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-4">
          {items.map((it) => {
            const isOpen = it.id === openId;
            return (
              <button
                key={it.id}
                onClick={() => setOpenId(isOpen ? null : it.id)}
                aria-pressed={isOpen}
                className={`flex flex-col overflow-hidden rounded-xl border bg-cream text-left transition-colors ${
                  isOpen ? 'border-forest-700 ring-2 ring-forest-700/30' : 'border-paper-line hover:border-forest-600'
                }`}
              >
                {it.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element -- stored data URL thumbnail
                  <img src={it.thumbnail} alt={it.commonName} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-cream-2 text-forest-700">
                    <TaxonIcon iconicTaxon={it.iconicTaxon ?? 'Unknown'} size={28} />
                  </div>
                )}
                <div className="p-2">
                  <p className="line-clamp-2 text-xs font-semibold leading-tight text-ink">{it.commonName}</p>
                  <p className="mt-1 text-[11px] text-ink-faint">
                    {formatWhen(it.createdAt)}
                    {typeof it.score === 'number' ? ` · ${Math.round(it.score)}%` : ''}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── NearbyGrid ─────────────────────────────────────────────────────────────

function NearbyGrid({ lat, lng }: { lat: number; lng: number }) {
  const [species, setSpecies] = useState<NearbySpecies[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  const FILTERS = ['All', 'Plantae', 'Aves', 'Mammalia', 'Insecta', 'Animalia'];

  useEffect(() => {
    fetch(`/api/nearby-species?lat=${lat}&lng=${lng}&radius=20`)
      .then((r) => r.json())
      .then((d: { species?: NearbySpecies[] }) => setSpecies(d.species ?? []))
      .catch(() => setSpecies([]))
      .finally(() => setLoading(false));
  }, [lat, lng]);

  const filtered = filter === 'All' ? species : species.filter((s) => s.iconicTaxon === filter);

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-paper-line px-5 py-4">
        <p className="eyebrow">Recently spotted near your land</p>
        <p className="mt-1 text-xs text-ink-soft">Research-grade iNaturalist observations within 20 km</p>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              filter === f
                ? 'border-forest-700 bg-forest-700 text-cream'
                : 'border-paper-line bg-cream-2 text-ink-soft hover:bg-paper-line'
            }`}
          >
            {f !== 'All' && <TaxonIcon iconicTaxon={f} size={13} />}
            {FILTER_LABELS[f] ?? f}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-soft">
          <Spinner /> Loading nearby species&hellip;
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="py-10 text-center text-sm text-ink-soft">No {filter === 'All' ? '' : (FILTER_LABELS[filter] ?? filter).toLowerCase() + ' '}observations found nearby.</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
          {filtered.slice(0, 24).map((s) => (
            <a
              key={s.taxonId}
              href={s.wikipedia ?? `https://www.inaturalist.org/taxa/${s.taxonId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col overflow-hidden rounded-xl border border-paper-line bg-cream transition-colors hover:border-forest-600"
            >
              {s.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote iNaturalist photo
                <img src={s.photoUrl} alt={s.commonName} className="h-24 w-full object-cover" />
              ) : (
                <div className="flex h-24 w-full items-center justify-center bg-cream-2 text-forest-700">
                  <TaxonIcon iconicTaxon={s.iconicTaxon} size={30} />
                </div>
              )}
              <div className="p-2.5">
                <p className="text-xs font-semibold leading-tight text-ink">{s.commonName}</p>
                <p className="text-xs italic leading-tight text-ink-faint">{s.scientificName}</p>
                <p className="mt-1 text-xs text-ink-faint">{s.observationCount} obs.</p>
              </div>
            </a>
          ))}
        </div>
      )}

      <p className="pb-4 text-center text-xs text-ink-faint">
        Data from{' '}
        <a href="https://www.inaturalist.org" target="_blank" rel="noopener noreferrer" className="underline">
          iNaturalist
        </a>
        {' '}· CC BY-NC
      </p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

/** Rough center of the saved boundary ring, used when the profile has no coordinates. */
function boundaryCenter(boundary: number[][][] | null): { lat: number; lng: number } | null {
  const ring = boundary?.[0];
  if (!ring || ring.length === 0) return null;
  const lngs = ring.map((c) => c[0]);
  const lats = ring.map((c) => c[1]);
  return {
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
  };
}

export default function SpeciesPage() {
  const { property, boundary, tier } = useStore();
  useRedirectWhenLocked();

  const coords =
    (property as { coordinates?: { lat: number; lng: number } } | null)?.coordinates ??
    boundaryCenter(boundary);
  const lat = coords?.lat;
  const lng = coords?.lng;

  const [history, setHistory] = useState<SavedSpeciesId[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    fetch('/api/species-ids')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: SavedSpeciesId[] }) => setHistory(d.items ?? []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [tier]);

  const removeFromHistory = async (id: string) => {
    const res = await fetch(`/api/species-ids/${id}`, { method: 'DELETE' });
    if (res.ok) setHistory((prev) => prev.filter((it) => it.id !== id));
  };

  return (
    <div className="min-h-screen bg-cream-2">
      <AppHeader back={{ href: '/dashboard', label: 'Back to dashboard' }} />

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <div>
          <p className="eyebrow">Field guide</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">Species ID</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Photograph anything on your land and get it identified. Look back at everything you&apos;ve found, and see what&apos;s been spotted near {property?.name ?? 'your property'}.
          </p>
        </div>

        {tier === 'free' && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-forest-200 bg-forest-50 px-4 py-3">
            <p className="text-xs leading-relaxed text-forest-800">
              Your free plan includes <strong>3 photo IDs</strong> to try it out. Steward gives you 20 a month.
            </p>
            <Link href="/upgrade" className="flex-shrink-0 text-xs font-semibold text-forest-700 hover:underline">See plans</Link>
          </div>
        )}
        {(
          <>
            <IdentifyPanel
              lat={lat}
              lng={lng}
              propertyId={property?.id}
              onSaved={(item) => setHistory((prev) => [item, ...prev.filter((p) => p.id !== item.id)])}
            />
            <RecentIds items={history} loading={historyLoading} onRemove={removeFromHistory} />
          </>
        )}

        {lat !== undefined && lng !== undefined ? (
          <NearbyGrid lat={lat} lng={lng} />
        ) : (
          <div className="card p-6 text-center">
            <p className="text-sm text-ink-soft">Nearby species data needs your property location.</p>
            <p className="mt-1 text-xs text-ink-faint">Draw or confirm your property boundary to turn this on.</p>
          </div>
        )}
      </div>
    </div>
  );
}
