'use client';

import Link from 'next/link';
import { useRef, useState, useEffect } from 'react';
import { useStore } from '@/lib/store';

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

const ICONIC_EMOJI: Record<string, string> = {
  Plantae: '🌿', Animalia: '🐾', Aves: '🐦', Mammalia: '🦌',
  Reptilia: '🦎', Amphibia: '🐸', Insecta: '🐛', Fungi: '🍄',
  Arachnida: '🕷️', Actinopterygii: '🐟', Mollusca: '🐌', Unknown: '🔍',
};

function getEmoji(iconicTaxon: string) {
  return ICONIC_EMOJI[iconicTaxon] ?? '🔍';
}

// ── IdentifyPanel ──────────────────────────────────────────────────────────

function IdentifyPanel({ lat, lng }: { lat?: number; lng?: number }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SpeciesResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
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
        body: JSON.stringify({ imageBase64: base64, mimeType, lat, lng }),
      });
      const data = await res.json() as { results?: SpeciesResult[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Identification failed');
      setResults(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setResults(null);
    setError(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Identify a species</p>
        <p className="text-xs text-gray-400 mt-0.5">Upload or drop a photo of any plant, animal, or fungus on your land</p>
      </div>

      {!preview ? (
        // Drop zone
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="m-4 border-2 border-dashed border-gray-200 rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-[#639922] hover:bg-[#EAF3DE] transition-colors"
        >
          <span className="text-4xl">📷</span>
          <p className="text-sm font-medium text-gray-700">Drop a photo here or tap to upload</p>
          <p className="text-xs text-gray-400">JPG, PNG, HEIC — any photo from your phone or camera</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          />
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Preview */}
          <div className="relative rounded-xl overflow-hidden">
            <img src={preview} alt="Upload preview" className="w-full max-h-64 object-cover" />
            <button
              onClick={reset}
              className="absolute top-2 right-2 bg-white/90 rounded-full w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-white shadow"
            >
              ✕
            </button>
          </div>

          {/* Identify button */}
          {!results && !loading && (
            <button
              onClick={identify}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: '#3B6D11' }}
            >
              Identify this species →
            </button>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Checking iNaturalist database&hellip;
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error.includes('INATURALIST_API_TOKEN') ? (
                <>
                  <p className="font-semibold mb-1">iNaturalist API token not set</p>
                  <p>Add your token to <code className="bg-red-100 px-1 rounded">.env.local</code> as <code className="bg-red-100 px-1 rounded">INATURALIST_API_TOKEN</code></p>
                  <p className="mt-1">Get it at <span className="underline">inaturalist.org/users/api_token</span></p>
                </>
              ) : error}
            </div>
          )}

          {/* Results */}
          {results && results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Top matches</p>
              {results.map((r, i) => (
                <div key={r.taxonId} className={`flex items-center gap-3 p-3 rounded-xl border ${i === 0 ? 'border-[#97C459] bg-[#EAF3DE]' : 'border-gray-100'}`}>
                  {r.photoUrl ? (
                    <img src={r.photoUrl} alt={r.commonName} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">
                      {getEmoji(r.iconicTaxon)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{r.commonName}</p>
                    <p className="text-xs text-gray-500 italic">{r.scientificName}</p>
                    {r.conservationStatus && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 mt-0.5 inline-block">{r.conservationStatus}</span>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold" style={{ color: i === 0 ? '#3B6D11' : '#5F5E5A' }}>{r.score}%</p>
                    <p className="text-xs text-gray-400">match</p>
                  </div>
                </div>
              ))}
              {results[0].wikipedia && (
                <a
                  href={results[0].wikipedia}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-xs text-[#3B6D11] underline mt-1"
                >
                  Learn more about {results[0].commonName} →
                </a>
              )}
              <button onClick={reset} className="w-full py-2.5 rounded-xl text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 mt-1">
                Identify another photo
              </button>
            </div>
          )}

          {results && results.length === 0 && (
            <div className="text-center py-4 text-sm text-gray-500">
              <p>iNaturalist couldn&apos;t confidently identify this species.</p>
              <p className="text-xs mt-1 text-gray-400">Try a closer photo with good lighting.</p>
              <button onClick={reset} className="mt-3 text-xs text-[#3B6D11] underline">Try another photo</button>
            </div>
          )}
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
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Recently spotted near your land</p>
        <p className="text-xs text-gray-400 mt-0.5">Research-grade iNaturalist observations within 20 km</p>
      </div>

      {/* Filter pills */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
              filter === f ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            style={filter === f ? { backgroundColor: '#3B6D11' } : {}}
          >
            {f === 'All' ? 'All' : `${getEmoji(f)} ${f}`}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-sm text-gray-400 gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Loading nearby species&hellip;
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-center py-10 text-sm text-gray-400">No {filter === 'All' ? '' : filter + ' '}observations found nearby.</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
          {filtered.slice(0, 24).map((s) => (
            <a
              key={s.taxonId}
              href={s.wikipedia ?? `https://www.inaturalist.org/taxa/${s.taxonId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col rounded-xl overflow-hidden border border-gray-100 hover:shadow-sm transition-shadow"
            >
              {s.photoUrl ? (
                <img src={s.photoUrl} alt={s.commonName} className="w-full h-24 object-cover" />
              ) : (
                <div className="w-full h-24 bg-gray-50 flex items-center justify-center text-3xl">
                  {getEmoji(s.iconicTaxon)}
                </div>
              )}
              <div className="p-2.5">
                <p className="text-xs font-semibold text-gray-800 leading-tight">{s.commonName}</p>
                <p className="text-xs text-gray-400 italic leading-tight">{s.scientificName}</p>
                <p className="text-xs text-gray-400 mt-1">{s.observationCount} obs.</p>
              </div>
            </a>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-gray-400 pb-4">
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

export default function SpeciesPage() {
  const { property } = useStore();

  const lat = (property as { coordinates?: { lat: number; lng: number } } | null)?.coordinates?.lat;
  const lng = (property as { coordinates?: { lat: number; lng: number } } | null)?.coordinates?.lng;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            &larr; Back to dashboard
          </Link>
          <Link href="/" className="text-base font-semibold">
            <span style={{ color: '#3B6D11' }}>Land</span>Ethic.io
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Species ID</h1>
          <p className="text-sm text-gray-500 mt-1">
            Photograph anything on your land and get it identified instantly. See what&apos;s been spotted near {property?.name ?? 'your property'}.
          </p>
        </div>

        <IdentifyPanel lat={lat} lng={lng} />

        {lat && lng ? (
          <NearbyGrid lat={lat} lng={lng} />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <p className="text-sm text-gray-500">Nearby species data requires your property location.</p>
            <p className="text-xs text-gray-400 mt-1">Re-run your property analysis to enable this.</p>
          </div>
        )}
      </div>
    </div>
  );
}
