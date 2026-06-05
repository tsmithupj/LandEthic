import Anthropic from '@anthropic-ai/sdk';
import type {
  PropertyProfile,
  ActionTask,
  ActionPlan,
  Goal,
  SubscriptionTier,
} from '@/types';
import { GOAL_LABELS } from '@/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Strip markdown code fences if Claude wraps its response in ```json ... ```
function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
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
}

interface AnalysisOutput {
  profile: Omit<PropertyProfile, 'id' | 'createdAt'>;
  insights: Array<{
    type: 'positive' | 'warning' | 'opportunity';
    title: string;
    description: string;
    zone?: string;
    zoneLabel?: string;
  }>;
  ecosystemScore: number;
}

export async function analyzeProperty(input: AnalysisInput): Promise<AnalysisOutput> {
  const goalList = input.goals.map((g) => GOAL_LABELS[g]).join(', ');

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

INSTRUCTIONS:
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
      "description": "2–3 sentences specific to THIS county, hardiness zone, and acreage",
      "zone": "one of: full | north | south | east | west | center | perimeter",
      "zoneLabel": "short human label e.g. 'wooded ridgeline' or 'open south field'"
    },
    {
      "type": "warning",
      "title": "max 8 words",
      "description": "2–3 sentences about a real challenge common to this region",
      "zone": "one of: full | north | south | east | west | center | perimeter",
      "zoneLabel": "short human label e.g. 'acidic open areas' or 'forest edges'"
    },
    {
      "type": "opportunity",
      "title": "max 8 words",
      "description": "2–3 sentences naming specific native plants or practices for this hardiness zone",
      "zone": "one of: full | north | south | east | west | center | perimeter",
      "zoneLabel": "short human label e.g. 'meadow conversion area' or 'creek corridor'"
    }
  ],
  "ecosystemScore": number
}

For each insight's "zone" field: choose the portion of the property the insight refers to. Use "perimeter" for forest edge / boundary topics, "center" for interior land topics, cardinal directions for topics that apply to a specific part of the property, and "full" only when the insight applies to the entire property equally.`;

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return JSON.parse(stripCodeFences(text)) as AnalysisOutput;
}

// ─── Plan Generation ────────────────────────────────────────────────────────

interface PlanInput {
  profile: PropertyProfile;
  tier: SubscriptionTier;
  userGoalsText?: string;
  currentMonth?: string;
  currentSeason?: string;
}

const TIER_DEPTH: Record<SubscriptionTier, string> = {
  free: 'Generate exactly 5 tasks covering the next 30 days. Simple, one-time actions. All tasks must have tier: "free".',
  steward: 'You MUST generate at least 12 tasks (target 14), one task per month across all 4 seasons of the year. Divide them: 3 Spring, 3 Summer, 4 Fall, 4 Winter. Set each task\'s "season" to its season and "month" to a specific month within that season (e.g., "March 2026" for Spring). For each task include a "photoPrompt" in recommendations: one sentence on what to photograph for species ID. All tasks must have tier: "steward".',
  naturalist: 'You MUST generate exactly 18 tasks — exactly 3 tasks per month for each of the next 6 consecutive months starting from the current month. Set each task\'s "month" field to its exact calendar month (e.g., "June 2026", "July 2026", "August 2026"). Sort all tasks chronologically by month. Include an "impactNote" in recommendations for every task. All tasks must have tier: "naturalist". IMPORTANT: do not stop after 5 tasks. The full response must contain 18 task objects.',
  conservationist: 'You MUST generate exactly 21 tasks — exactly 7 tasks per month for each of the next 3 consecutive months starting from the current month. Set "month" to the exact calendar month. For food plot tasks add specific seed variety names, seeding rates (lbs/acre), and planting windows to recommendations.species. For nesting box tasks add exact height (feet), compass direction, and distance from tree line to recommendations.placement. Include an "impactNote" for every task. All tasks must have tier: "conservationist". IMPORTANT: do not stop early. All 21 task objects must be in the response.',
};

export async function generatePlan(input: PlanInput): Promise<ActionPlan> {
  const { profile, tier } = input;
  const goalList = profile.goals.map((g) => GOAL_LABELS[g]).join(', ');
  const month    = input.currentMonth  ?? new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  const season   = input.currentSeason ?? getCurrentSeason();

  const prompt = `Generate a land management action plan for this property.

PROPERTY:
- Location: ${profile.county}, ${profile.state}
- Acreage: ${profile.acreage} acres (${profile.woodedAcres ?? '?'} wooded, ${profile.openAcres ?? '?'} open)
- Soil type: ${profile.soilType ?? 'unknown'}
- Water features: ${profile.waterFeatures?.join(', ') ?? 'none noted'}
- Owner goals: ${goalList}
- Owner's specific goals (in their own words): ${input.userGoalsText ? input.userGoalsText : 'not provided'}
- Current ecosystem score: ${profile.ecosystemScore ?? 50}/100
- Current month: ${month} (${season})

TIER INSTRUCTIONS: ${TIER_DEPTH[tier]}

Return ONLY this JSON (no markdown):
{
  "summary": "2–3 sentence plain-English overview of this property's biggest opportunities right now",
  "tasks": [
    {
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
      "month": "the specific target month for this task (e.g. \"June 2025\") — use the correct month based on seasonal timing",
      "season": "${season}",
      "tier": "${tier}",
      "completed": false,
      "propertyId": "${profile.id}",
      "locationDescription": "2–4 sentences describing exactly where on the property this task takes place. Use cardinal directions (north, south, northeast, etc.) and reference specific land features the owner would recognize — the tree line, open field, fence row, creek, wet area, slope, etc. Be specific enough that someone standing on the property could walk straight to the right spot. Example: 'In the southern third of your property, along the eastern tree line where the mowed lawn meets the woods. Start at the southeast corner of your open field and work northward along the forest edge for approximately 150 feet.'",
      "recommendations": {
        "species": ["native species names if applicable, else omit"],
        "materials": ["materials/tools if applicable, else omit"],
        "dimensions": "size/area info if applicable, else omit",
        "placement": "specific placement guidance if applicable, else omit",
        "photoPrompt": "Steward/above only: what to photograph for species ID — omit for free tier",
        "impactNote": "Naturalist/above only: one sentence on how this task improves land health score — omit for free/steward"
      }
    }
  ]
}

LOCATION DESCRIPTION RULES:
- Use cardinal directions: north, south, east, west, northeast, etc.
- Reference land features the owner knows: "the tree line", "the open field", "the fence row", "the low wet area", "the slope", "the pond edge".
- Include approximate distances or proportions: "the northern quarter of your property", "within 50 feet of the forest edge", "along the full length of the eastern fence row".
- Never be vague ("somewhere on the property" or "in a suitable area") — always be specific.
- If t- If the task applies to the full property, say "across your whole property" or name the specific feature it applies to everywhere.`;

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 16384,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const raw = JSON.parse(stripCodeFences(text)) as {
    summary: string;
    tasks: Omit<ActionTask, 'id'>[];
  };

  return {
    id: `plan-${Date.now()}`,
    propertyId: profile.id,
    tier,
    generatedAt: new Date().toISOString(),
    summary: raw.summary,
    tasks: raw.tasks.map((t, i) => ({ ...t, id: `task-${i + 1}` })),
  };
}

function getCurrentSeason(): string {
  const month = new Date().getMonth(); // 0–11
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Fall';
  return 'Winter';
}
