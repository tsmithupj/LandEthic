'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { coordinatePlace, nearestTown, parseCoordinates, searchPlaces, type Place } from '@/lib/places';
import { Icon, Spinner } from '@/components/brand';

interface Props {
  id?: string;
  value: string;
  /** Every keystroke. */
  onChange: (text: string) => void;
  /** A suggestion was picked (address, town, or GPS spot). */
  onPick: (place: Place) => void;
  /** The suggestion currently picked, if the text still matches it. */
  picked: Place | null;
  className?: string;
}

const WAIT_MS = 250;

/**
 * Address box with suggestions as you type (Mapbox), and GPS coordinates
 * (e.g. 40.44062, -79.99589) turned into a spot named after the nearest town.
 */
export default function AddressSearch({ id, value, onChange, onPick, picked, className = '' }: Props) {
  const listId = useId();
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [searched, setSearched] = useState('');
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const text = value.trim();
  const isPicked = !!picked && picked.address === value;

  useEffect(() => {
    if (!token || isPicked || text.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setFailed(false);
      try {
        const coords = parseCoordinates(text);
        const found = coords
          ? [coordinatePlace(coords, await nearestTown(coords.lat, coords.lng, token, ctrl.signal).catch(() => null))]
          : await searchPlaces(text, token, { signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        setResults(found);
        setActive(coords ? 0 : -1);
        setSearched(text);
      } catch {
        if (!ctrl.signal.aborted) { setResults([]); setFailed(true); }
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, WAIT_MS);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [text, token, isPicked]);

  const choose = (p: Place) => {
    onPick(p);
    setOpen(false);
    setResults([]);
    setActive(-1);
  };

  const showList = open && !isPicked && text.length >= 3 && (results.length > 0 || (!searching && searched === text && !failed));

  return (
    <div className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
          {isPicked ? <Icon.Pin size={16} className="text-forest-700" /> : <Icon.Search size={16} />}
        </span>
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
          onKeyDown={(e) => {
            if (!showList || !results.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % results.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i <= 0 ? results.length - 1 : i - 1)); }
            else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(results[active]); }
            else if (e.key === 'Escape') { setOpen(false); }
          }}
          placeholder="Start typing your address, or paste GPS coordinates"
          autoComplete="off"
          spellCheck={false}
          className={`${className} !pl-10 ${searching ? '!pr-10' : ''}`}
        />
        {searching && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint"><Spinner className="h-4 w-4" /></span>
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-80 overflow-auto rounded-xl border border-paper-line bg-cream py-1 shadow-xl"
          onMouseDown={(e) => e.preventDefault() /* keep the box focused while tapping a suggestion */}
        >
          {results.length === 0 ? (
            <li className="px-4 py-3 text-xs leading-relaxed text-ink-soft">
              No matches yet. Try just the road and town (e.g. &ldquo;Ridge Road, Somerset PA&rdquo;), or paste GPS
              coordinates for your land.
            </li>
          ) : (
            results.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => { if (blurTimer.current) clearTimeout(blurTimer.current); choose(p); }}
                className={`flex cursor-pointer items-start gap-2.5 px-4 py-2.5 ${i === active ? 'bg-forest-50' : ''}`}
              >
                <span className="mt-0.5 flex-shrink-0 text-forest-700">
                  {p.kind === 'coordinates' ? <Icon.Compass size={16} /> : <Icon.Pin size={16} />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{p.label}</span>
                  {p.detail && <span className="block truncate text-xs text-ink-soft">{p.detail}</span>}
                </span>
              </li>
            ))
          )}
        </ul>
      )}

      {failed && open && !isPicked && (
        <p className="mt-1.5 text-xs text-ink-faint">Suggestions aren&apos;t loading right now. You can still type your full address.</p>
      )}
    </div>
  );
}
