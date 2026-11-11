'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useState, useRef, useMemo, type ReactNode } from 'react';
import { useStore } from '@/lib/store';
import { readImageForUpload } from '@/lib/image';
import type { ActionTask } from '@/types';
import AppHeader from '@/components/AppHeader';
import { StepList } from '@/components/WeeklyChecklist';
import { clipToProperty } from '@/lib/geo';
import { useRedirectWhenLocked } from '@/components/FreePlan';
import { Icon, Spinner } from '@/components/brand';

const DashboardMap = dynamic(() => import('@/components/DashboardMap'), { ssr: false });

interface SpeciesIdResult {
  taxonId: number;
  commonName: string;
  scientificName: string;
  iconicTaxon: string;
  photoUrl: string | null;
  score: number;
  wikipedia: string | null;
  conservationStatus: string | null;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 flex-shrink-0 text-xs text-ink-soft">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-2">
        <div
          className="h-full rounded-full bg-forest-600 transition-all duration-500"
          style={{ width: `${(value / 10) * 100}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs font-semibold text-forest-700">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function Section({ icon, title, children }: { icon?: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-2">
        {icon && <span className="text-forest-700">{icon}</span>}
        <p className="eyebrow">{title}</p>
      </div>
      {children}
    </div>
  );
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { plan, property, boundary, address, tier, completeTask, replaceTask, userGoalsText } = useStore();
  useRedirectWhenLocked();
  const [replacing, setReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [idLoading, setIdLoading] = useState(false);
  const [idResults, setIdResults] = useState<SpeciesIdResult[] | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const idFileRef = useRef<HTMLInputElement>(null);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const task = plan?.tasks.find((t) => t.id === id);

  // Outline of where the work happens, drawn on the map (memoized so the map
  // only re-frames when the task's area actually changes)
  const taskArea = task?.area;
  const workArea = useMemo(
    () => (taskArea && clipToProperty(taskArea, boundary) ? { ring: taskArea, color: '#FF8A3D', label: 'Work area' } : null),
    [taskArea, boundary]
  );

  if (!task) {
    return (
      <div className="min-h-screen bg-cream-2">
        <AppHeader back={{ href: '/dashboard', label: 'Back to plan' }} width="max-w-2xl" />
        <div className="px-4 py-20 text-center">
          <p className="mb-4 text-ink-soft">We couldn&apos;t find that task.</p>
          <Link href="/dashboard" className="text-sm font-semibold text-forest-700 underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const ecoScore   = property?.ecosystemScore ?? 50;
  const scoreDelta = Math.round(task.impactScore / 2.5);
  const canReplace = tier !== 'free';
  const canIdentify = tier !== 'free';

  const handleComplete = () => {
    completeTask(task.id);
    router.push('/dashboard');
  };

  const handleAlreadyDone = async () => {
    if (!property || !plan) return;
    setReplacing(true);
    setReplaceError(null);
    try {
      const res = await fetch('/api/replace-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedTask: task,
          property,
          existingTasks: plan.tasks.filter((t) => t.id !== task.id),
          boundary: boundary ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({})) as { task?: ActionTask; error?: string };
      if (!res.ok || !data.task) throw new Error(data.error ?? "Couldn't suggest a new task. Try again.");
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.task),
      });
      replaceTask(task.id, data.task);
      router.push('/dashboard');
    } catch (err) {
      setReplaceError(err instanceof Error ? err.message : "Couldn't suggest a new task. Try again.");
      setReplacing(false);
    }
  };

  const handleIdentifyFile = async (file: File) => {
    setIdPreview(await readImageForUpload(file));
  };

  const handleIdentify = async () => {
    if (!idPreview) return;
    setIdLoading(true);
    setIdError(null);
    setIdResults(null);
    try {
      const base64 = idPreview.split(',')[1];
      const mimeType = idPreview.split(';')[0].split(':')[1];
      const res = await fetch('/api/identify-species', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      const data = await res.json() as { results?: SpeciesIdResult[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Identification failed');
      setIdResults(data.results ?? []);
    } catch (err) {
      setIdError(err instanceof Error ? err.message : 'Identification failed');
    } finally {
      setIdLoading(false);
    }
  };

  const sendChat = async (text?: string) => {
    const msg = text ?? chatInput.trim();
    if (!msg || !property) return;
    const newMessages = [...chatMessages, { role: 'user' as const, content: msg }];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await fetch('/api/task-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, property, userGoalsText, messages: newMessages }),
      });
      const data = await res.json() as { reply?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Sorry, something went wrong. Try again.');
      setChatMessages([...newMessages, { role: 'assistant', content: data.reply ?? '' }]);
    } catch (err) {
      setChatMessages([
        ...newMessages,
        { role: 'assistant', content: err instanceof Error ? err.message : 'Sorry, something went wrong. Try again.' },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const QUICK_QUESTIONS = [
    'How do I prepare the soil for this?',
    'What tools do I need?',
    'When is the best time of year to do this?',
    'How much will this cost roughly?',
  ];

  const when = task.week && task.month ? `Week ${task.week} · ${task.month}` : task.month ?? task.season;

  return (
    <div className="min-h-screen bg-cream-2">
      <AppHeader back={{ href: '/dashboard', label: 'Back to plan' }} width="max-w-2xl" />

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">

        {/* Satellite overview map */}
        <div className="overflow-hidden rounded-2xl">
          <DashboardMap
            boundary={boundary}
            address={address}
            propertyName={property?.name ?? ''}
            acreage={property?.acreage}
            county={property?.county}
            state={property?.state}
            height={280}
            autoFlyover={false}
            highlight={workArea}
          />
        </div>

        {/* Title + score */}
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {when && <p className="eyebrow mb-2">{when}</p>}
              <h1 className="text-xl font-bold leading-snug text-ink sm:text-2xl">
                {task.title}
              </h1>
            </div>
            <div className="flex-shrink-0 rounded-xl border border-forest-200 bg-forest-50 px-3 py-2 text-center">
              <p className="font-display text-3xl font-bold leading-none text-forest-700">
                {task.impactScore.toFixed(1)}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-forest-700">/ 10 impact</p>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {task.tags.map((t) => (
              <span key={t} className="tag">{t}</span>
            ))}
          </div>
          <p className="mb-4 text-sm leading-relaxed text-ink-soft">{task.description}</p>
          <div className="rounded-xl border-l-[3px] border-forest-600 bg-forest-50 p-4">
            <p className="mb-1 font-display text-sm font-bold text-forest-800">Why it matters</p>
            <p className="text-sm leading-relaxed text-forest-800">{task.whyItMatters}</p>
          </div>
        </div>

        {/* Weekly checklist steps (Conservationist) */}
        {task.steps?.length ? (
          <Section icon={<Icon.Check size={15} />} title={`Checklist · ${task.steps.filter((st) => st.done).length} of ${task.steps.length} done`}>
            <StepList task={task} />
            <p className="mt-3 text-xs text-ink-faint">Check off every step and the task is marked done for you.</p>
          </Section>
        ) : null}

        {/* Where to do it */}
        {task.locationDescription && (
          <Section icon={<Icon.Pin size={16} />} title="Where to do this">
            <p className="text-sm leading-relaxed text-ink">{task.locationDescription}</p>
            {workArea ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-rust-700">
                <span className="inline-block h-3 w-3 rounded-sm border-2 border-dashed" style={{ borderColor: '#FF8A3D', background: 'rgba(255,138,61,0.35)' }} />
                Outlined in orange on the map above
              </p>
            ) : (
              <p className="mt-3 text-xs text-ink-faint">
                Plans built from now on outline each task&apos;s spot on the map. Rebuild your plan from the dashboard to add it here.
              </p>
            )}
          </Section>
        )}

        {/* Impact score breakdown */}
        <Section icon={<Icon.Bolt size={14} />} title="How this was scored">
          <div className="mt-1 space-y-3">
            <ScoreBar label="Fits your goals"    value={task.impactBreakdown.goalAlignment} />
            <ScoreBar label="Good for the land"  value={task.impactBreakdown.ecosystemImpact} />
            <ScoreBar label="Right time of year" value={task.impactBreakdown.seasonalTiming} />
            <ScoreBar label="Effort and cost"    value={task.impactBreakdown.easeCost} />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-soft">
            Finishing this task should move your land health score from{' '}
            <strong className="text-ink">{ecoScore} to {Math.min(100, ecoScore + scoreDelta)}</strong>.
          </p>
        </Section>

        {/* What to do */}
        {task.recommendations && (
          <Section icon={<Icon.Sprout size={16} />} title="What to do">
            <div className="space-y-3 text-sm text-ink-soft">
              {task.recommendations.species?.length ? (
                <div>
                  <span className="font-semibold text-ink">Recommended species: </span>
                  {task.recommendations.species.join(', ')}
                </div>
              ) : null}
              {task.recommendations.materials?.length ? (
                <div>
                  <span className="font-semibold text-ink">Materials: </span>
                  {task.recommendations.materials.join(', ')}
                </div>
              ) : null}
              {task.recommendations.dimensions ? (
                <div>
                  <span className="font-semibold text-ink">Size / area: </span>
                  {task.recommendations.dimensions}
                </div>
              ) : null}
              {task.recommendations.placement ? (
                <div>
                  <span className="font-semibold text-ink">Placement: </span>
                  {task.recommendations.placement}
                </div>
              ) : null}
              {task.recommendations.impactNote ? (
                <div className="mt-1 rounded-lg bg-forest-50 px-3 py-2.5">
                  <span className="font-semibold text-forest-800">Land health impact: </span>
                  <span className="text-forest-800">{task.recommendations.impactNote}</span>
                </div>
              ) : null}
            </div>
          </Section>
        )}

        {/* Photo prompt + inline ID (Steward+) */}
        {task.recommendations?.photoPrompt && (
          <Section icon={<Icon.Camera size={16} />} title="What to photograph">
            <p className="mb-4 text-sm leading-relaxed text-ink">
              {task.recommendations.photoPrompt}
            </p>

            {!canIdentify ? (
              <Link
                href="/upgrade"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-paper-line py-3 text-sm text-ink-soft transition-colors hover:border-forest-600 hover:text-forest-700"
              >
                <Icon.Lock size={14} /> Species ID from photos is on the Steward plan
              </Link>
            ) : !idPreview ? (
              <button
                onClick={() => idFileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-paper-line py-3 text-sm text-ink-soft transition-colors hover:border-forest-600 hover:text-forest-700"
              >
                <Icon.Camera size={16} /> Upload a photo to identify this species
              </button>
            ) : (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
                  <img src={idPreview} alt="Your upload" className="max-h-48 w-full object-cover" />
                  <button
                    onClick={() => { setIdPreview(null); setIdResults(null); setIdError(null); }}
                    aria-label="Remove photo"
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-cream/90 text-ink-soft"
                  >✕</button>
                </div>
                {!idResults && !idLoading && (
                  <button onClick={handleIdentify} className="btn-primary w-full !py-2.5 !text-sm">
                    Identify species <Icon.Arrow size={16} />
                  </button>
                )}
                {idLoading && (
                  <div className="flex items-center justify-center gap-2 py-3 text-sm text-ink-soft">
                    <Spinner /> Looking at your photo&hellip;
                  </div>
                )}
                {idError && <p className="text-center text-xs text-rust-700">{idError}</p>}
                {idResults && idResults.length === 0 && (
                  <p className="text-center text-xs text-ink-soft">We couldn&apos;t confidently identify this one. Try a closer photo in good light.</p>
                )}
                {idResults && idResults.length > 0 && (
                  <div className="space-y-2">
                    {idResults.slice(0, 3).map((r, i) => (
                      <div key={r.taxonId} className={`flex items-center gap-3 rounded-xl border p-2.5 ${i === 0 ? 'border-forest-200 bg-forest-50' : 'border-paper-line bg-cream-2'}`}>
                        {r.photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element -- remote iNaturalist thumbnail
                          <img src={r.photoUrl} alt={r.commonName} className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink">{r.commonName}</p>
                          <p className="text-xs italic text-ink-faint">{r.scientificName}</p>
                        </div>
                        <span className={`flex-shrink-0 text-sm font-bold ${i === 0 ? 'text-forest-700' : 'text-ink-faint'}`}>{r.score}%</span>
                      </div>
                    ))}
                    <p className="pt-1 text-center text-xs">
                      <Link href="/dashboard/species" className="font-semibold text-forest-700 underline">Open the full Species ID page</Link>
                    </p>
                  </div>
                )}
              </div>
            )}
            <input ref={idFileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleIdentifyFile(e.target.files[0]); }} />
          </Section>
        )}

        {/* Actions */}
        <div className="space-y-3 pb-2">
          <div className="flex gap-3">
            <button
              onClick={handleComplete}
              className={task.completed ? 'btn-outline flex-1' : 'btn-primary flex-1'}
            >
              <Icon.Check size={16} />
              {task.completed ? 'Mark as not done' : 'Mark as complete'}
            </button>
            <Link href="/dashboard" className="btn-outline !px-5">
              Defer
            </Link>
          </div>

          {/* Already done — replace task (paid tiers only) */}
          {canReplace && !task.completed && (
            <div>
              <button
                onClick={handleAlreadyDone}
                disabled={replacing}
                className="flex w-full items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-forest-200 bg-cream py-3 text-sm font-semibold text-forest-700 transition-colors hover:bg-forest-50 disabled:opacity-70"
              >
                {replacing ? (
                  <>
                    <Spinner /> Finding a new task for your land&hellip;
                  </>
                ) : (
                  'Already done — suggest something else'
                )}
              </button>
              {replaceError && (
                <p className="mt-1.5 text-center text-xs text-rust-700">{replaceError}</p>
              )}
            </div>
          )}

          {/* Upsell nudge for free tier */}
          {!canReplace && !task.completed && (
            <Link
              href="/upgrade"
              className="flex w-full items-center justify-between gap-3 rounded-xl border-[1.5px] border-rust-600 bg-rust-100 px-4 py-3 text-sm text-rust-700"
            >
              <span>
                <span className="font-semibold">Already done this?</span> Upgrade to swap it for a fresh task.
              </span>
              <Icon.Arrow size={16} className="flex-shrink-0" />
            </Link>
          )}
        </div>

        {/* Ask a question chat panel */}
        <div className="card mb-6 overflow-hidden">
          <button
            onClick={() => setChatOpen((o) => !o)}
            aria-expanded={chatOpen}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-cream-2"
          >
            <div className="flex items-center gap-3">
              <span className="text-forest-700"><Icon.Chat size={20} /></span>
              <div>
                <p className="text-sm font-semibold text-ink">Ask a question about this task</p>
                <p className="text-xs text-ink-soft">Get specific answers about your soil, tools, timing, and technique</p>
              </div>
            </div>
            <span className={`text-ink-faint transition-transform ${chatOpen ? '-rotate-90' : 'rotate-90'}`}>
              <Icon.Arrow size={14} />
            </span>
          </button>

          {chatOpen && (
            <div className="border-t border-paper-line">
              {/* Quick question chips */}
              {chatMessages.length === 0 && (
                <div className="flex flex-wrap gap-2 px-4 pb-2 pt-3">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendChat(q)}
                      disabled={chatLoading}
                      className="rounded-full border border-forest-200 px-3 py-1.5 text-xs text-forest-700 transition-colors hover:bg-forest-50 disabled:opacity-40"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Message bubbles */}
              {chatMessages.length > 0 && (
                <div className="max-h-80 space-y-3 overflow-y-auto px-4 py-3">
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          m.role === 'user'
                            ? 'rounded-br-sm bg-forest-700 text-cream'
                            : 'rounded-bl-sm bg-cream-2 text-ink'
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-cream-2 px-4 py-3">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint" style={{ animationDelay: '0ms' }} />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint" style={{ animationDelay: '150ms' }} />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2 px-4 pb-4 pt-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="Ask anything about this task…"
                  disabled={chatLoading}
                  className="min-w-0 flex-1 rounded-xl border border-paper-line bg-white px-4 py-2.5 text-sm focus:border-forest-600 focus:outline-none disabled:opacity-50"
                />
                <button
                  onClick={() => sendChat()}
                  disabled={chatLoading || !chatInput.trim()}
                  className="btn-primary !rounded-xl !px-4 !py-2.5 !text-sm"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
