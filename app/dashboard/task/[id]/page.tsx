'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useState, useRef } from 'react';
import { useStore } from '@/lib/store';
import type { ActionTask } from '@/types';

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
      <span className="text-xs text-gray-500 w-32 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(value / 10) * 100}%`, backgroundColor: '#639922' }}
        />
      </div>
      <span className="text-xs font-semibold w-8 text-right" style={{ color: '#3B6D11' }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { plan, property, boundary, address, tier, completeTask, replaceTask } = useStore();
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
  const { userGoalsText } = useStore();

  const task = plan?.tasks.find((t) => t.id === id);

  if (!task) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Task not found.</p>
          <Link href="/dashboard" className="text-sm text-[#3B6D11] underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const ecoScore   = property?.ecosystemScore ?? 50;
  const scoreDelta = Math.round(task.impactScore / 2.5);
  const canReplace = tier !== 'free';

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
          tier,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { task: ActionTask };
      replaceTask(task.id, data.task);
      router.push('/dashboard');
    } catch {
      setReplaceError("Couldn't generate a new task. Try again.");
      setReplacing(false);
    }
  };

  const handleIdentifyFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setIdPreview(e.target?.result as string);
    reader.readAsDataURL(file);
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
      if (data.error) throw new Error(data.error);
      setChatMessages([...newMessages, { role: 'assistant', content: data.reply ?? '' }]);
    } catch (err) {
      setChatMessages([...newMessages, { role: 'assistant', content: 'Sorry, something went wrong. Try again.' }]);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1.5"
          >
            &larr; Back to plan
          </Link>
          <Link href="/" className="text-base font-semibold">
            <span style={{ color: '#3B6D11' }}>Land</span>Ethic.io
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Satellite overview map */}
        <div className="rounded-2xl overflow-hidden">
          <DashboardMap
            boundary={boundary}
            address={address}
            propertyName={property?.name ?? ''}
            acreage={property?.acreage}
            county={property?.county}
            state={property?.state}
            height={300}
            autoFlyover={false}
          />
        </div>

        {/* Title + score */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-lg font-semibold text-gray-900 leading-snug flex-1">
              {task.title}
            </h1>
            <div className="text-center flex-shrink-0">
              <p className="text-3xl font-semibold" style={{ color: '#3B6D11' }}>
                {task.impactScore.toFixed(1)}
              </p>
              <p className="text-xs text-gray-400">/ 10 impact</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {task.tags.map((t) => (
              <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                {t}
              </span>
            ))}
          </div>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">{task.description}</p>
          <div className="rounded-xl p-4" style={{ backgroundColor: '#EAF3DE' }}>
            <p className="text-sm font-medium mb-1" style={{ color: '#27500A' }}>
              Why it matters
            </p>
            <p className="text-sm leading-relaxed" style={{ color: '#3B6D11' }}>
              {task.whyItMatters}
            </p>
          </div>
        </div>

        {/* Where to do it */}
        {task.locationDescription && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">&#128205;</span>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Where to do this
              </p>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              {task.locationDescription}
            </p>
          </div>
        )}

        {/* Impact score breakdown */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            How this was scored
          </p>
          <div className="space-y-3">
            <ScoreBar label="Fits your goals"    value={task.impactBreakdown.goalAlignment} />
            <ScoreBar label="Good for the land"  value={task.impactBreakdown.ecosystemImpact} />
            <ScoreBar label="Right time of year" value={task.impactBreakdown.seasonalTiming} />
            <ScoreBar label="Effort and cost"    value={task.impactBreakdown.easeCost} />
          </div>
          <p className="text-xs text-gray-400 mt-4 leading-relaxed">
            Finishing this task should move your land health score from{' '}
            <strong>{ecoScore} to {ecoScore + scoreDelta}</strong>.
          </p>
        </div>

        {/* What to do */}
        {task.recommendations && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
              What to do
            </p>
            <div className="space-y-3 text-sm text-gray-600">
              {task.recommendations.species?.length ? (
                <div>
                  <span className="font-medium text-gray-900">Recommended species: </span>
                  {task.recommendations.species.join(', ')}
                </div>
              ) : null}
              {task.recommendations.materials?.length ? (
                <div>
                  <span className="font-medium text-gray-900">Materials: </span>
                  {task.recommendations.materials.join(', ')}
                </div>
              ) : null}
              {task.recommendations.dimensions ? (
                <div>
                  <span className="font-medium text-gray-900">Size / area: </span>
                  {task.recommendations.dimensions}
                </div>
              ) : null}
              {task.recommendations.placement ? (
                <div>
                  <span className="font-medium text-gray-900">Placement: </span>
                  {task.recommendations.placement}
                </div>
              ) : null}
              {task.recommendations.impactNote ? (
                <div className="rounded-lg px-3 py-2.5 mt-1" style={{ backgroundColor: '#EAF3DE' }}>
                  <span className="font-medium" style={{ color: '#27500A' }}>Land health impact: </span>
                  <span style={{ color: '#3B6D11' }}>{task.recommendations.impactNote}</span>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Photo prompt + inline ID (Steward+) */}
        {task.recommendations?.photoPrompt && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">📷</span>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                What to photograph
              </p>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              {task.recommendations.photoPrompt}
            </p>

            {/* Inline species ID */}
            {!idPreview ? (
              <button
                onClick={() => idFileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-[#639922] hover:text-[#3B6D11] transition-colors"
              >
                <span>📷</span> Upload a photo to identify this species
              </button>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden">
                  <img src={idPreview} alt="Upload" className="w-full max-h-48 object-cover" />
                  <button
                    onClick={() => { setIdPreview(null); setIdResults(null); setIdError(null); }}
                    className="absolute top-2 right-2 bg-white/90 rounded-full w-7 h-7 flex items-center justify-center text-gray-600 shadow"
                  >✕</button>
                </div>
                {!idResults && !idLoading && (
                  <button onClick={handleIdentify} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#3B6D11' }}>
                    Identify species →
                  </button>
                )}
                {idLoading && (
                  <div className="flex items-center justify-center gap-2 py-3 text-sm text-gray-400">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Checking iNaturalist&hellip;
                  </div>
                )}
                {idError && <p className="text-xs text-red-500 text-center">{idError}</p>}
                {idResults && idResults.length > 0 && (
                  <div className="space-y-2">
                    {idResults.slice(0, 3).map((r, i) => (
                      <div key={r.taxonId} className={`flex items-center gap-3 p-2.5 rounded-xl ${i === 0 ? 'bg-[#EAF3DE]' : 'bg-gray-50'}`}>
                        {r.photoUrl && <img src={r.photoUrl} alt={r.commonName} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{r.commonName}</p>
                          <p className="text-xs text-gray-400 italic">{r.scientificName}</p>
                        </div>
                        <span className="text-sm font-bold flex-shrink-0" style={{ color: i === 0 ? '#3B6D11' : '#888' }}>{r.score}%</span>
                      </div>
                    ))}
                    <p className="text-xs text-center text-gray-400 pt-1">
                      <a href="/dashboard/species" className="text-[#3B6D11] underline">Open full Species ID page →</a>
                    </p>
                  </div>
                )}
              </div>
            )}
            <input ref={idFileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleIdentifyFile(e.target.files[0]); }} />
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 pb-6">
          <div className="flex gap-3">
            <button
              onClick={handleComplete}
              className="flex-1 py-3.5 rounded-xl text-sm font-semibold transition-colors"
              style={task.completed
                ? { backgroundColor: '#EAF3DE', color: '#3B6D11', border: '1.5px solid #97C459' }
                : { backgroundColor: '#3B6D11', color: 'white' }}
            >
              {task.completed ? '✓ Mark as incomplete' : 'Mark as complete'}
            </button>
            <Link
              href="/dashboard"
              className="px-5 py-3.5 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Defer
            </Link>
          </div>

          {/* Already done — replace task (paid tiers only) */}
          {canReplace && !task.completed && (
            <div>
              <button
                onClick={handleAlreadyDone}
                disabled={replacing}
                className="w-full py-3 rounded-xl text-sm font-medium border transition-colors disabled:opacity-60"
                style={{
                  borderColor: '#C0DD97',
                  color: '#3B6D11',
                  backgroundColor: replacing ? '#EAF3DE' : 'white',
                }}
              >
                {replacing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Finding a new task for your land&hellip;
                  </span>
                ) : (
                  '✓ Already done — suggest something else'
                )}
              </button>
              {replaceError && (
                <p className="text-xs text-red-500 mt-1.5 text-center">{replaceError}</p>
              )}
            </div>
          )}

          {/* Upsell nudge for free tier */}
          {!canReplace && !task.completed && (
            <Link
              href="/upgrade"
              className="flex items-center justify-between w-full px-4 py-3 rounded-xl border text-sm"
              style={{ borderColor: '#C0DD97', backgroundColor: '#EAF3DE' }}
            >
              <span style={{ color: '#27500A' }}>
                <span className="font-semibold">Already done this?</span> Upgrade to swap it for a fresh task.
              </span>
              <span style={{ color: '#3B6D11' }}>&rarr;</span>
            </Link>
          )}
        </div>

        {/* Ask a question chat panel */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
          <button
            onClick={() => setChatOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">💬</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">Ask a question about this task</p>
                <p className="text-xs text-gray-400">Get specific answers about your soil, tools, timing, and technique</p>
              </div>
            </div>
            <span className="text-gray-400 text-sm">{chatOpen ? '▲' : '▼'}</span>
          </button>

          {chatOpen && (
            <div className="border-t border-gray-50">
              {/* Quick question chips */}
              {chatMessages.length === 0 && (
                <div className="px-4 pt-3 pb-2 flex flex-wrap gap-2">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendChat(q)}
                      disabled={chatLoading}
                      className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:bg-[#EAF3DE] disabled:opacity-40"
                      style={{ borderColor: '#C0DD97', color: '#3B6D11' }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Message bubbles */}
              {chatMessages.length > 0 && (
                <div className="px-4 py-3 space-y-3 max-h-80 overflow-y-auto">
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          m.role === 'user'
                            ? 'text-white rounded-br-sm'
                            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                        }`}
                        style={m.role === 'user' ? { backgroundColor: '#3B6D11' } : {}}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Input */}
              <div className="px-4 pb-4 pt-2 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="Ask anything about this task…"
                  disabled={chatLoading}
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#639922] disabled:opacity-50"
                />
                <button
                  onClick={() => sendChat()}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: '#3B6D11' }}
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
