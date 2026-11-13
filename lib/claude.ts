import Anthropic from '@anthropic-ai/sdk';
import type {
  PropertyProfile,
  ActionTask,
  ActionPlan,
  Goal,
  SubscriptionTier,
  FoodPlot,
  NestingBox,
} from '@/types';
import { GOAL_LABELS } from '@/types';
import { photoIntro, photoBlock, AREA_PIXEL_RULES } from '@/lib/satellite';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Strip markdown code fences if Claude wraps its response in ```json ... ```
function stripCodeFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}


// ─── System prompt shared across all calls ─────────────────────────────────
const SYSTEM = `You are LandEthic, a land stewardship guide built for everyday landowners — farmers, hunters, ranchers, wildlife enthusiasts, and conservationists. You help people take better care of their land in a way that benefits everything living on it: the soil, the plants, the insects, the birds, the deer, the turkey, and the water.

Your philosophy: when you take care of the land, the land takes care of everything on it. Healthy soil grows healthy plants. Healthy plants feed insects. Healthy insects feed birds and deer and everything else. Always think about the whole picture, not just one animal or one goal.

Your tone is friendly, practical, and encouraging — like a knowledgeable neighbor who has worked the land their whole life and genuinely wants to help. Be specific to this property's location, soil, and goals. Never give generic advice.

PLAIN LANGUAGE RULES — follow these strictly:
- Write like you are talking to a 6th grader. Short sentences. Simple words.
- Never use jargon without explaining it in plain terms right away.
- Replace words like "riparian," "fauna," "habitat corridor," and "biodiversity" with plain descriptions like "land near the water," "wildlife," "paths animals use to get around," and "variety of plants and animals."
- Task titles must be clear and specific: "Plant native grasses along the fence row" not "Implement warm-season grass establishment."
- Task descriptions must say exactly what to do in plain words. Anyone should be able to read it and know what to go do.
- "whyItMatters" should sound like you are explaining it to a friend: "This gives deer better cover during hunting season and keeps them on your property" not "This enhances cervid habitat retention."
- Location descriptions must reference things the landowner can actually see: "the tree line on the south side," "your lowest wet spot," "the old fence row along the east edge."

When generating impact scores (0-10), be honest and varied. A truly life-changing action earns 9+. A small improvement earns 4-5. Do not cluster everything near 9.

Always respond with valid JSON matching the exact schema requested. No markdown, no prose outside the JSON.`;

// ─── Property Analysis ──────────────────────────────────────────────────────

interface AnalysisInput {
  address: string;
  acreage?: number;
  goals: Goal[];
  userGoalsText?: string;
  soilData?: string;
  county?: string;
  state?: string;
  coordinates?: { lat: number; lng: number };
  hardinessZone?: string;
  /** Base64 satellite photo of the parcel (north up, property line drawn in yellow when known). */
  satelliteImageBase64?: string;
  hasBoundary?: boolean;
}

interface AnalysisOutput {
  profile: Omit<PropertyProfile, 'id' | 'createdAt'>;
  insights: Array<{
    type: 'positive' | 'warning' | 'opportunity';
    title: string;
    description: string;
    zoneLabel?: string;
    where?: string;
    steps?: string[];
    /** Outline of the spot on the satellite photo, as [x, y] pixels (x from left, y from top). */
    areaPixels?: number[][];
  }>;
  ecosystemScore: number;
}

export async function analyzeProperty(input: AnalysisInput): Promise<AnalysisOutput> {
  const goalList = input.goals.map((g) => GOAL_LABELS[g]).join(', ');
  const areaField = input.satelliteImageBase64
    ? `,
      "areaPixels": [[x, y], [x, y], [x, y], [x, y]]`
    : '';

  const prompt = `Analyze this property and return a JSON object with the structure below.

PROPERTY DETAILS:
- Address: ${input.address}
- Approximate acreage: ${input.acreage ?? 'unknown'}
- County: ${input.county ?? 'unknown'}
- State: ${input.state ?? 'unknown'}
- GPS Coordinates: ${input.coordinates ? `${input.coordinates.lat.toFixed(5)}, ${input.coordinates.lng.toFixed(5)}` : 'unknown'}
- USDA Plant Hardiness Zone: ${input.hardinessZone ?? 'unknown — infer from state/county'}
- Soil data (from USDA SSURGO): ${input.soilData ?? 'not available — infer from county soil survey knowledge'}
- Owner's goals: ${goalList}
- Owner's specific goals in their own words: ${input.userGoalsText ? input.userGoalsText : 'not provided'}

${input.satelliteImageBase64 ? `${photoIntro(!!input.hasBoundary)}

` : ''}INSTRUCTIONS:
You have real GPS coordinates and hardiness zone data. Use these to give ACCURATE, LOCATION-SPECIFIC recommendations.
- Name native plants that actually grow in this exact hardiness zone and state.
- Reference the actual climate: frost dates, precipitation patterns, and seasonal conditions for this specific location.
- If soil data is provided, use the real soil series name. Otherwise name the most common soil series for this county based on USDA county soil surveys.
- For wildlife, name species with confirmed range in this county.
- Be specific: say "white oak" not just "oak", say "eastern bluebird" not just "bluebird".

Return ONLY valid JSON (no markdown, no code fences, no extra text):
{
  "profile": {
    "name": "string (short memorable name for this property based on address or region)",
    "address": "string",
    "acreage": number,
    "county": "string",
    "state": "string",
    "goals": ${JSON.stringify(input.goals)},
    "boundary": null,
    "woodedAcres": number,
    "openAcres": number,
    "soilType": "string (specific soil series name for this location)",
    "waterFeatures": ["list only features likely present given acreage and terrain — leave empty array if unlikely"],
    "ecosystemScore": number (0–100, honest baseline for typical land in this county)
  },
  "insights": [
    {
      "type": "positive",
      "title": "max 8 words",
      "description": "2–3 sentences: what you found and why it matters, specific to THIS county, hardiness zone, and acreage",
      "zoneLabel": "2–4 word name for the spot, e.g. 'south tree line' or 'pond edge'",
      "where": "2–3 sentences telling the owner exactly how to find this spot on the ground",
      "steps": ["3–5 concrete steps, see rules below"]${areaField}
    },
    {
      "type": "warning",
      "title": "max 8 words",
      "description": "2–3 sentences about a real problem on this land or common to this region",
      "zoneLabel": "2–4 word name for the spot",
      "where": "2–3 sentences telling the owner exactly how to find this spot on the ground",
      "steps": ["3–5 concrete steps"]${areaField}
    },
    {
      "type": "opportunity",
      "title": "max 8 words",
      "description": "2–3 sentences naming specific native plants or practices for this hardiness zone",
      "zoneLabel": "2–4 word name for the spot",
      "where": "2–3 sentences telling the owner exactly how to find this spot on the ground",
      "steps": ["3–5 concrete steps"]${areaField}
    }
  ],
  "ecosystemScore": number
}

RULES FOR "where" (the owner will walk out and find this spot using only your words):
- Start from something they can see${input.satelliteImageBase64 ? ' in the photo' : ''}: the house, barn, driveway, road, pond, creek, or a tree line.
- Give a compass direction and a rough distance in feet or yards (e.g. "about 150 yards north of the barn").
- Say how big the area is (feet, yards, or acres) and what its edges are (e.g. "the strip between the hay field and the woods, about 30 feet wide, running the full length of the east fence").
- Describe what it looks like now so they know they are in the right place (e.g. "tall grass with scattered cedar trees", "the low spot that stays muddy after rain").
- ${input.satelliteImageBase64 ? 'Only describe features you can actually see in the photo or that the data above supports. If you are unsure about something, tell them how to check it (e.g. "if this spot holds water after a heavy rain...").' : 'No photo is available, so describe spots by what is typical for this kind of land and tell the owner what to look for to find it (e.g. "the lowest corner of your open ground, where water collects after rain").'}

RULES FOR "steps" (each step is one short sentence the owner can act on):
- In order, starting with the first thing to do.
- Include amounts, sizes, spacing, timing, and tools (e.g. "Mow a 15-foot-wide strip along the woods edge in late February", "Plant 25 bare-root American plum seedlings 10 feet apart").
- Name exact native plants or seed mixes with rates where it applies.
- The last step says how they will know it worked or what to check next season.${input.satelliteImageBase64 ? `

${AREA_PIXEL_RULES}` : ''}`;

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 6000,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: input.satelliteImageBase64
        ? [photoBlock(input.satelliteImageBase64), { type: 'text', text: prompt }]
        : prompt,
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return JSON.parse(stripCodeFences(text)) as AnalysisOutput;
}

// ─── Plan Generation ────────────────────────────────────────────────────────

interface PlanInput {
  profile: PropertyProfile;
  tier: SubscriptionTier;
  /** Base64 satellite photo of the parcel (see lib/satellite.ts). */
  satelliteImageBase64?: string;
  hasBoundary?: boolean;
  userGoalsText?: string;
  currentMonth?: string;
  currentSeason?: string;
  /** Tasks the owner already finished (plan upgrades keep them) — build on these, never repeat them. */
  completedTitles?: string[];
}

// Weekly checklist rules (Conservationist): every task gets a week and small check-off steps.
const WEEKLY_RULES = `Weekly checklist: give every task a "week" (1, 2, 3, or 4 — the week of its month to do it). Spread each month's tasks across the 4 weeks (1–2 per week), putting anything time-sensitive or prep work first. Give every task 3–6 "steps": short check-off items in the order they are done, each one a single action with amounts or sizes where it helps (e.g. "Buy 50 lbs of Durana white clover seed", "Disk the plot twice, 4 inches deep").`;

// Naturalist and up: every task comes with how-to steps, and the time and money it takes.
export const HOW_TO_STEPS = `Give every task 3–5 "steps": short how-to actions in the order they are done, each one a single action with amounts or sizes where it helps (e.g. "Mow the plot down to 3 inches", "Spread 2 bags of pelletized lime").`;
export const TIME_AND_COST = `In "recommendations" add "timeNeeded" (honest hands-on time, e.g. "About 2 hours" or "Two weekend mornings") and "costEstimate" (rough out-of-pocket cost in US dollars for supplies, e.g. "$40–60 for seed and lime", or "Free — tools you likely own"). Keep both short.`;

const TIER_DEPTH: Record<SubscriptionTier, string> = {
  free: 'Generate exactly 5 tasks covering the next 30 days. Simple, one-time actions. All tasks must have tier: "free".',
  steward: 'You MUST generate at least 12 tasks (target 14), one task per month across all 4 seasons of the year. Divide them: 3 Spring, 3 Summer, 4 Fall, 4 Winter. Set each task\'s "season" to its season and "month" to a specific month within that season (e.g., "March 2026" for Spring). For each task include a "photoPrompt" in recommendations: one sentence on what to photograph for species ID. All tasks must have tier: "steward".',
  naturalist: `You MUST generate exactly 18 tasks — exactly 3 tasks per month for each of the next 6 consecutive months starting from the current month. Set each task's "month" field to its exact calendar month (e.g., "June 2026", "July 2026", "August 2026"). Sort all tasks chronologically by month. Include an "impactNote" in recommendations for every task. ${HOW_TO_STEPS} ${TIME_AND_COST} All tasks must have tier: "naturalist". IMPORTANT: do not stop after 5 tasks. The full response must contain 18 task objects.`,
  conservationist: `You MUST generate exactly 21 tasks — exactly 7 tasks per month for each of the next 3 consecutive months starting from the current month. Set "month" to the exact calendar month. For food plot tasks add specific seed variety names, seeding rates (lbs/acre), and planting windows to recommendations.species. For nesting box tasks add exact height (feet), compass direction, and distance from tree line to recommendations.placement. Include an "impactNote" for every task. ${WEEKLY_RULES} ${TIME_AND_COST} All tasks must have tier: "conservationist". IMPORTANT: do not stop early. All 21 task objects must be in the response.`,
};

/** JSON shape of one task, shared by plan generation and the monthly update. */
function taskSchema({ tier, propertyId, withArea, monthHint }: {
  tier: SubscriptionTier;
  propertyId: string;
  withArea: boolean;
  monthHint?: string;
}): string {
  const weekly = tier === 'conservationist';
  const detailed = tier === 'naturalist' || tier === 'conservationist';
  return `{
      "id": "task-{n}",
      "title": "clear action title (verb + what + where)",
      "description": "1–2 sentence description of exactly what to do",
      "whyItMatters": "1–2 sentences on the ecological benefit specific to this property",
      "impactScore": number (0.0–10.0, one decimal, be honest and varied),
      "impactBreakdown": {
        "goalAlignment": number (0.0–10.0),
        "ecosystemImpact": number (0.0–10.0),
        "seasonalTiming": number (0.0–10.0),
        "easeCost": number (0.0–10.0)
      },
      "tags": ["2–4 short tags"],
      "month": "${monthHint ?? 'the specific target month for this task (e.g. June 2026) — use the correct month based on seasonal timing'}",
      "season": "the season of this task's month: Spring, Summer, Fall, or Winter",${weekly ? `
      "week": number 1–4 (the week of its month to do this task),` : ''}${detailed ? `
      "steps": ["${weekly ? '3–6' : '3–5'} short how-to steps, in order"],` : ''}
      "tier": "${tier}",
      "completed": false,
      "propertyId": "${propertyId}",
      "locationDescription": "2–4 sentences describing exactly where on the property this task takes place. Use cardinal directions (north, south, northeast, etc.) and reference specific land features the owner would recognize — the tree line, open field, fence row, creek, wet area, slope, etc. Be specific enough that someone standing on the property could walk straight to the right spot. Example: 'In the southern third of your property, along the eastern tree line where the mowed lawn meets the woods. Start at the southeast corner of your open field and work northward along the forest edge for approximately 150 feet.'",
      "recommendations": {
        "species": ["native species names if applicable, else omit"],
        "materials": ["materials/tools if applicable, else omit"],
        "dimensions": "size/area info if applicable, else omit",
        "placement": "specific placement guidance if applicable, else omit",
        "photoPrompt": "Steward/above only: what to photograph for species ID — omit for free tier",
        "impactNote": "Naturalist/above only: one sentence on how this task improves land health score — omit for free/steward"${detailed ? `,
        "timeNeeded": "short hands-on time estimate",
        "costEstimate": "short supply cost estimate in US dollars"` : ''}
      }${withArea ? `,
      "areaPixels": [[x, y], [x, y], [x, y], [x, y]]` : ''}
    }`;
}

/** Location rules shared by plan generation and the monthly update. */
function locationRules(withPhoto: boolean): string {
  return `LOCATION DESCRIPTION RULES:
- Use cardinal directions: north, south, east, west, northeast, etc.
- Reference land features the owner knows: "the tree line", "the open field", "the fence row", "the low wet area", "the slope", "the pond edge".
- Include approximate distances or proportions: "the northern quarter of your property", "within 50 feet of the forest edge", "along the full length of the eastern fence row".
- Never be vague ("somewhere on the property" or "in a suitable area") — always be specific.
- If the task applies to the full property, say "across your whole property" or name the specific feature it applies to everywhere.${withPhoto ? `
- Start from something visible in the photo (house, barn, driveway, road, pond, tree line) and give a compass direction and rough distance from it.
- Only pick spots that fit the task on THIS land as the photo shows it. If the task needs woods and there are only a few trees, use the tree line or the woodlot that is actually there, or choose a different task.

${AREA_PIXEL_RULES}` : ''}`;
}

function propertyBlock(profile: PropertyProfile, userGoalsText?: string): string {
  const goalList = profile.goals.map((g) => GOAL_LABELS[g]).join(', ');
  return `PROPERTY:
- Location: ${profile.county}, ${profile.state}
- Acreage: ${profile.acreage} acres (${profile.woodedAcres ?? '?'} wooded, ${profile.openAcres ?? '?'} open)
- Soil type: ${profile.soilType ?? 'unknown'}
- Water features: ${profile.waterFeatures?.join(', ') ?? 'none noted'}
- Owner goals: ${goalList}
- Owner's specific goals (in their own words): ${userGoalsText ? userGoalsText : 'not provided'}
- Current ecosystem score: ${profile.ecosystemScore ?? 50}/100`;
}

/** Make an AI task safe to save: checklist steps as objects, week 1–4, never pre-completed. */
function normalizeTask<T extends Partial<ActionTask>>(t: T, tier: SubscriptionTier, propertyId: string): T {
  const rawSteps = (t as { steps?: unknown }).steps;
  const steps = Array.isArray(rawSteps)
    ? rawSteps
        .map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' ? String((x as { text?: unknown }).text ?? '') : ''))
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 8)
        .map((text) => ({ text, done: false }))
    : undefined;
  const weekNum = Number((t as { week?: unknown }).week);
  return {
    ...t,
    tier,
    propertyId,
    completed: false,
    tags: Array.isArray(t.tags) ? t.tags : [],
    steps: steps?.length ? steps : undefined,
    week: Number.isInteger(weekNum) && weekNum >= 1 && weekNum <= 4 ? weekNum : undefined,
  };
}

function userContent(prompt: string, satelliteImageBase64?: string) {
  return satelliteImageBase64
    ? [photoBlock(satelliteImageBase64), { type: 'text' as const, text: prompt }]
    : prompt;
}

type PaidTier = Exclude<SubscriptionTier, 'free'>;

/** How many tasks a paid plan has, and when — the outline step. */
const TIER_OUTLINE: Record<PaidTier, string> = {
  steward: 'Plan 14 tasks, one per month across all 4 seasons of the next year: 3 Spring, 3 Summer, 4 Fall, 4 Winter. Give each one a specific month within its season (e.g. "March 2027").',
  naturalist: 'Plan exactly 18 tasks: exactly 3 per month for each of the next 6 consecutive months, starting with the current month.',
  conservationist: 'Plan exactly 21 tasks: exactly 7 per month for each of the next 3 consecutive months, starting with the current month. Give every task a "week" (1, 2, 3, or 4) of its month — spread each month across the 4 weeks (1–2 per week), with time-sensitive or prep work first.',
};

/** What every task's write-up includes, by membership — the detail step. */
const TIER_DETAIL: Record<PaidTier, string> = {
  steward: 'For each task include a "photoPrompt" in recommendations: one sentence on what to photograph for species ID.',
  naturalist: `Include an "impactNote" in recommendations for every task. ${HOW_TO_STEPS} ${TIME_AND_COST}`,
  conservationist: `For food plot tasks add specific seed variety names, seeding rates (lbs/acre), and planting windows to recommendations.species. For nesting box tasks add exact height (feet), compass direction, and distance from tree line to recommendations.placement. Include an "impactNote" for every task. Give every task 3–6 "steps": short check-off items in the order they are done, each one a single action with amounts or sizes where it helps (e.g. "Buy 50 lbs of Durana white clover seed", "Disk the plot twice, 4 inches deep"). ${TIME_AND_COST}`,
};

/** Most tasks written in one detail call — several calls run at the same time. */
const DETAIL_BATCH = 7;

// The outline (which jobs, in what order) is the judgment call → Opus.
// Writing each planned job up in detail → Sonnet: about twice as fast and 40% cheaper.
const OUTLINE_MODEL = 'claude-opus-4-6';
const DETAIL_MODEL = 'claude-sonnet-4-6';

interface OutlineTask { title: string; month: string; season?: string; week?: number }

function planIntro(input: PlanInput, month: string, season: string, withPhoto: boolean): string {
  return `${propertyBlock(input.profile, input.userGoalsText)}
- Current month: ${month} (${season})
${withPhoto ? `
${photoIntro(!!input.hasBoundary)}
` : ''}
${input.completedTitles?.length ? `TASKS THEY HAVE ALREADY FINISHED (they stay on their plan — never repeat these; where it fits, the next step after one of them is a great task):
${input.completedTitles.slice(0, 40).map((t) => `- ${t}`).join('\n')}

` : ''}`;
}

async function askJson<T>(prompt: string, maxTokens: number, image?: string, model = OUTLINE_MODEL): Promise<T> {
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: SYSTEM,
    messages: [{ role: 'user', content: userContent(prompt, image) }],
  });
  const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
  return JSON.parse(stripCodeFences(text)) as T;
}

/** Group outline tasks into detail batches, keeping each month together where it fits. */
function batchByMonth(tasks: OutlineTask[]): OutlineTask[][] {
  const batches: OutlineTask[][] = [];
  let current: OutlineTask[] = [];
  const months = new Map<string, OutlineTask[]>();
  for (const t of tasks) months.set(t.month, [...(months.get(t.month) ?? []), t]);
  for (const group of months.values()) {
    for (let i = 0; i < group.length; i += DETAIL_BATCH) {
      const part = group.slice(i, i + DETAIL_BATCH);
      if (current.length + part.length > DETAIL_BATCH) { batches.push(current); current = []; }
      current.push(...part);
    }
  }
  if (current.length) batches.push(current);
  return batches;
}

/**
 * Build an action plan.
 *
 * Paid plans are written in two steps so they finish well inside the 5-minute
 * server limit: first a quick outline (summary + every task's title and month),
 * then the full write-ups for a few months at a time, all at once. The outline
 * keeps the batches from repeating each other.
 */
export async function generatePlan(input: PlanInput): Promise<ActionPlan> {
  const { profile, tier } = input;
  const month    = input.currentMonth  ?? new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  const season   = input.currentSeason ?? getCurrentSeason();
  const withPhoto = !!input.satelliteImageBase64;
  const intro = planIntro(input, month, season, withPhoto);
  const finish = (summary: string, tasks: Partial<ActionTask>[]): ActionPlan => ({
    id: `plan-${Date.now()}`,
    propertyId: profile.id,
    tier,
    generatedAt: new Date().toISOString(),
    summary,
    tasks: tasks.map((t, i) => normalizeTask({ ...t, id: `task-${i + 1}` } as ActionTask, tier, profile.id)),
  });

  // Free: 5 quick tasks — one call is plenty fast
  if (tier === 'free') {
    const raw = await askJson<{ summary: string; tasks: Omit<ActionTask, 'id'>[] }>(`Generate a land management action plan for this property.

${intro}TIER INSTRUCTIONS: ${TIER_DEPTH.free}

Return ONLY this JSON (no markdown):
{
  "summary": "2–3 sentence plain-English overview of this property's biggest opportunities right now",
  "tasks": [
    ${taskSchema({ tier, propertyId: profile.id, withArea: withPhoto })}
  ]
}

${locationRules(withPhoto)}`, 8000, input.satelliteImageBase64);
    return finish(raw.summary, raw.tasks);
  }

  const paid = tier as PaidTier;
  const weekly = paid === 'conservationist';

  // ── Step 1: the outline ────────────────────────────────────────────────
  const outline = await askJson<{ summary: string; tasks: OutlineTask[] }>(`Plan a land management action plan for this property.

${intro}PLAN SHAPE: ${TIER_OUTLINE[paid]}
Pick the jobs that do the most for this owner's goals on THIS land, in a sensible order (prep before planting, each job in its right season). No two tasks may be the same job.

Return ONLY this JSON (no markdown):
{
  "summary": "2–3 sentence plain-English overview of this property's biggest opportunities right now",
  "tasks": [
    { "title": "clear action title (verb + what + where)", "month": "exact month, e.g. ${month}", "season": "Spring, Summer, Fall, or Winter"${weekly ? ', "week": 1' : ''} }
  ]
}`, 3000, input.satelliteImageBase64);

  const planned = (outline.tasks ?? []).filter((t) => t && typeof t.title === 'string' && t.title.trim() && typeof t.month === 'string');
  if (!planned.length) throw new Error('The plan outline came back empty');
  const allTitles = planned.map((t) => `- ${t.title} (${t.month})`).join('\n');

  // ── Step 2: write the tasks up, a few months at a time, in parallel ─────
  const writeBatch = async (batch: OutlineTask[]): Promise<Partial<ActionTask>[]> => {
    const prompt = `Write the full details for some of the tasks in this landowner's action plan.

${intro}THE WHOLE PLAN (for context — the other tasks are being written separately, so don't overlap with them):
${allTitles}

WRITE THESE ${batch.length} TASKS, in this order, keeping each title and month${weekly ? ' and week' : ''} exactly as given:
${batch.map((t, i) => `${i + 1}. ${t.title} — ${t.month}${weekly && t.week ? ` (week ${t.week})` : ''}`).join('\n')}

DETAIL RULES: ${TIER_DETAIL[paid]} All tasks must have tier: "${tier}".

Return ONLY this JSON (no markdown):
{
  "tasks": [
    ${taskSchema({ tier, propertyId: profile.id, withArea: withPhoto })}
  ]
}

${locationRules(withPhoto)}`;
    const maxTokens = Math.min(12000, 1500 + batch.length * 1000);
    let raw: { tasks?: Partial<ActionTask>[] };
    try {
      raw = await askJson(prompt, maxTokens, input.satelliteImageBase64, DETAIL_MODEL);
    } catch {
      raw = await askJson(prompt, maxTokens, input.satelliteImageBase64, DETAIL_MODEL); // one retry
    }
    const written = Array.isArray(raw.tasks) ? raw.tasks : [];
    // Keep the outline's title, month, season and week — they were planned together
    return batch.map((planned, i) => ({
      ...(written[i] ?? {}),
      title: planned.title,
      month: planned.month,
      season: planned.season ?? written[i]?.season,
      ...(weekly && planned.week ? { week: planned.week } : {}),
    }))
      .filter((t) => typeof t.description === 'string' && t.description.trim());
  };

  const written = (await Promise.all(batchByMonth(planned).map(writeBatch))).flat();
  if (!written.length) throw new Error('No tasks came back from the plan write-up');
  return finish(outline.summary, written);
}

// ─── Monthly Update (Naturalist / Conservationist) ─────────────────────────

interface MonthlyUpdateInput {
  profile: PropertyProfile;
  tier: SubscriptionTier;
  userGoalsText?: string;
  currentMonth: string;           // e.g. "December 2026"
  currentSeason: string;
  /** Months that need new tasks, oldest first (may be empty). */
  newMonths: string[];
  perMonth: number;
  completedTitles: string[];
  carriedOverTitles: string[];
  upcomingTitles: string[];
  satelliteImageBase64?: string;
  hasBoundary?: boolean;
}

export interface MonthlyUpdateOutput {
  note: string;
  tasks: (Omit<ActionTask, 'id'> & { areaPixels?: unknown })[];
}

/**
 * Once a month: a short note on where things stand plus new tasks for the
 * month(s) that just came into the plan's window, built around what the owner
 * actually finished.
 */
export async function generateMonthlyUpdate(input: MonthlyUpdateInput): Promise<MonthlyUpdateOutput> {
  const { profile, tier } = input;
  const withPhoto = !!input.satelliteImageBase64 && input.newMonths.length > 0;
  const total = input.newMonths.length * input.perMonth;
  const list = (items: string[]) => (items.length ? items.map((t) => `- ${t}`).join('\n') : '- none');

  const prompt = `It is the start of ${input.currentMonth} (${input.currentSeason}). Write this landowner's monthly update.

${propertyBlock(profile, input.userGoalsText)}
${withPhoto ? `
${photoIntro(!!input.hasBoundary)}
` : ''}
TASKS THEY HAVE FINISHED SO FAR:
${list(input.completedTitles)}

TASKS THEY DID NOT GET TO LAST MONTH (moved to ${input.currentMonth}):
${list(input.carriedOverTitles)}

TASKS ALREADY PLANNED FOR THE COMING MONTHS (do not repeat these):
${list(input.upcomingTitles)}

WHAT TO WRITE:
1. "note": 2–3 short sentences for the top of their dashboard. Say what their finished work set up, and the one or two things that matter most in ${input.currentMonth} on this land. Warm and plain, like a neighbor checking in. If they finished nothing yet, be encouraging, not guilty.
2. "tasks": ${total > 0
    ? `exactly ${total} new tasks${input.newMonths.length === 1 ? ` for ${input.newMonths[0]}` : ` — exactly ${input.perMonth} for each of these months: ${input.newMonths.join(', ')}`}. Set "month" to that exact month label. Build on what they finished (the next step after it), fill gaps toward their goals, and fit the season. Never repeat a finished, moved, or already-planned task. Include an "impactNote" in recommendations for every task. ${tier === 'conservationist' ? WEEKLY_RULES : HOW_TO_STEPS} ${TIME_AND_COST} All tasks must have tier: "${tier}".`
    : 'an empty array — their plan already covers the coming months.'}

Return ONLY this JSON (no markdown):
{
  "note": "string",
  "tasks": [${total > 0 ? `
    ${taskSchema({ tier, propertyId: profile.id, withArea: withPhoto, monthHint: `one of: ${input.newMonths.join(', ')}` })}
  ` : ''}]
}${total > 0 ? `

${locationRules(withPhoto)}` : ''}`;

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: total > 0 ? Math.min(16384, 2500 + total * 900) : 800,
    system: SYSTEM,
    messages: [{ role: 'user', content: userContent(prompt, withPhoto ? input.satelliteImageBase64 : undefined) }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const raw = JSON.parse(stripCodeFences(text)) as { note?: string; tasks?: MonthlyUpdateOutput['tasks'] };
  const allowed = new Set(input.newMonths);
  return {
    note: typeof raw.note === 'string' ? raw.note.trim() : '',
    tasks: (Array.isArray(raw.tasks) ? raw.tasks : [])
      .map((t) => normalizeTask(t, tier, profile.id))
      // Keep months inside the window; fall back to the first new month
      .map((t) => (t.month && allowed.has(t.month) ? t : { ...t, month: input.newMonths[0] })),
  };
}

// ─── Food Plot + Nesting Box Planner (Conservationist) ─────────────────────

interface HabitatInput {
  profile: PropertyProfile;
  userGoalsText?: string;
  satelliteImageBase64?: string;
  hasBoundary?: boolean;
}

export interface HabitatOutput {
  foodPlotNote?: string;
  foodPlots: Array<Omit<FoodPlot, 'id' | 'area'> & { areaPixels?: unknown }>;
  nestingBoxNote?: string;
  nestingBoxes: Array<Omit<NestingBox, 'id' | 'area'> & { areaPixels?: unknown }>;
}

export async function generateHabitatPlan(input: HabitatInput): Promise<HabitatOutput> {
  const { profile } = input;
  const withPhoto = !!input.satelliteImageBase64;
  const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  const areaField = withPhoto ? `,
      "areaPixels": [[x, y], [x, y], [x, y], [x, y]]` : '';

  const prompt = `Build a food plot plan and a nesting box plan for this property. Today is ${month}.

${propertyBlock(profile, input.userGoalsText)}
${withPhoto ? `
${photoIntro(!!input.hasBoundary)}
` : ''}
FOOD PLOTS:
- Suggest 1–4 food plots that fit this land and the owner's goals. Put them on open ground that can actually be worked: field edges, old pasture, a clearing next to cover. Never inside woods, water, the yard, or on a steep slope.
- Size each plot to the land (a 13-acre property might get two plots of 0.25–0.5 acre; a 100-acre farm can take more and bigger ones). Give "acres" as a number.
- "seedMix": real seed varieties that grow in ${profile.county}, ${profile.state} and this soil (e.g. "Durana white clover", "Winter rye", "Eagle forage soybeans", "Purple top turnips"), with honest seeding rates in lbs per acre when broadcast. 2–5 seeds per plot.
- "plantingWindow": the actual planting dates for this location (e.g. "August 10 – September 1 for the fall planting; frost-seed clover in late February").
- "soilPrep": 3–5 steps in order, starting with a soil test (county extension office), then clearing, liming, and working the ground.
- "limeAndFertilizer": a starting rate to use until the soil test comes back (e.g. "2 tons/acre lime and 300 lbs/acre 19-19-19"), and say the test result wins.
- "maintenance": 2–4 steps for the first year (mowing heights and timing, frost-seeding, weed control).
- If the land truly has no ground for a food plot, return an empty "foodPlots" array and explain why in "foodPlotNote".

NESTING BOXES:
- Suggest 2–5 kinds of boxes for birds (and bats) that live in this county and fit the habitat in the ${withPhoto ? 'photo' : 'property details'}: e.g. eastern bluebird and tree swallow boxes on open ground, wood duck boxes only near water, American kestrel boxes on a pole at a big field edge, eastern screech-owl boxes at a woods edge, bat houses on a pole or building with full sun.
- For each: the box type and entrance hole size, how many, mounting height in feet, which way the hole should face, how far apart, and exactly where they go.
- "tips": 3–5 short steps covering what to mount it on, a predator guard (baffle), and checking the box.
- "putUpBy": the month to have them up for this location. "cleanOut": when to clean them out.

"where" RULES (the owner walks out and finds the spot with only your words):
- Start from something they can see${withPhoto ? ' in the photo' : ''} (house, barn, driveway, road, pond, tree line), give a compass direction and rough distance, and say what the spot looks like now.

Return ONLY this JSON (no markdown):
{
  "foodPlotNote": "1–2 sentences: why these plots, in plain words",
  "foodPlots": [
    {
      "name": "short name, e.g. 'North field clover plot'",
      "acres": number,
      "where": "2–3 sentences",
      "targetWildlife": ["e.g. White-tailed deer", "Wild turkey"],
      "seedMix": [{ "seed": "variety name", "lbsPerAcre": number, "notes": "optional, e.g. 'frost-seed in late February'" }],
      "plantingWindow": "string",
      "soilPrep": ["step", "step", "step"],
      "limeAndFertilizer": "string",
      "maintenance": ["step", "step"],
      "why": "1–2 sentences on what this does for the land and wildlife"${areaField}
    }
  ],
  "nestingBoxNote": "1–2 sentences: why these boxes, in plain words",
  "nestingBoxes": [
    {
      "species": "e.g. Eastern bluebird",
      "boxType": "e.g. Peterson-style box with a 1 1/2-inch round hole",
      "count": number,
      "mountHeight": "e.g. 5 feet",
      "facing": "e.g. East or southeast, toward the field",
      "spacing": "e.g. Pairs 15 feet apart, each pair 300 feet from the next",
      "where": "2–3 sentences",
      "putUpBy": "e.g. Late February",
      "cleanOut": "e.g. Early March, before the first nest",
      "tips": ["step", "step", "step"],
      "why": "1–2 sentences"${areaField}
    }
  ]
}${withPhoto ? `

${AREA_PIXEL_RULES}
- For food plots, trace the plot itself. For nesting boxes, trace a small shape around where that group of boxes goes.` : ''}`;

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 9000,
    system: SYSTEM,
    messages: [{ role: 'user', content: userContent(prompt, input.satelliteImageBase64) }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const raw = JSON.parse(stripCodeFences(text)) as Partial<HabitatOutput>;
  return {
    foodPlotNote: typeof raw.foodPlotNote === 'string' ? raw.foodPlotNote : undefined,
    foodPlots: Array.isArray(raw.foodPlots) ? raw.foodPlots.slice(0, 6) : [],
    nestingBoxNote: typeof raw.nestingBoxNote === 'string' ? raw.nestingBoxNote : undefined,
    nestingBoxes: Array.isArray(raw.nestingBoxes) ? raw.nestingBoxes.slice(0, 8) : [],
  };
}

function getCurrentSeason(): string {
  const month = new Date().getMonth(); // 0–11
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Fall';
  return 'Winter';
}
