import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { ActionTask, PropertyProfile, SubscriptionTier } from '@/types';
import { GOAL_LABELS } from '@/types';
import { auth } from '@clerk/nextjs/server';
import { getUserTier } from '@/lib/tier-server';
import { enforceAiLimit, releaseAiUsage } from '@/lib/rate-limit';
import { cleanSteps, cleanWeek } from '@/lib/db/mappers';
import { fetchSatelliteSnapshot, ringFromPixels, photoIntro, photoBlock, AREA_PIXEL_RULES } from '@/lib/satellite';

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are LandEthic, a land stewardship guide for everyday landowners. You generate practical, specific, location-aware land management tasks.

PLAIN LANGUAGE RULES:
- Write like you are talking to a 6th grader. Short sentences. Simple words.
- Task titles must be clear and specific: verb + what + where.
- Task descriptions say exactly what to do. Anyone should be able to read it and know what to go do.
- "whyItMatters" sounds like explaining to a friend.
- Location descriptions reference things the landowner can actually see.

Always respond with valid JSON only. No markdown, no prose outside the JSON.`;

export async function POST(req: NextRequest) {
  // Swapping tasks is a paid feature — check the real tier server-side.
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tier: SubscriptionTier = await getUserTier();
  if (tier === 'free') {
    return NextResponse.json({ error: 'Task swapping is available on paid plans' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as {
    completedTask: ActionTask;
    property: PropertyProfile;
    existingTasks: ActionTask[];
    boundary?: number[][][];
  };

  const { completedTask, property, existingTasks } = body;
  if (!completedTask || !property?.goals || !Array.isArray(existingTasks)) {
    return NextResponse.json({ error: 'completedTask, property, and existingTasks are required' }, { status: 400 });
  }

  const limited = await enforceAiLimit(userId, 'replace-task', tier);
  if (limited) return limited;
  const goalList = property.goals.map((g) => GOAL_LABELS[g]).join(', ');
  const existingTitles = existingTasks.map((t) => `- ${t.title}`).join('\n');
  const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  const season = getCurrentSeason();

  // Satellite photo so the new task points to a real spot on the land
  const satellite = (body.boundary?.[0]?.length ?? 0) >= 3 ? await fetchSatelliteSnapshot(body.boundary) : null;

  const detailed = tier === 'naturalist' || tier === 'conservationist';
  const prompt = `The landowner has already completed this task on their property:
"${completedTask.title}"

Generate ONE new replacement task for their land management plan. The task must be:
- Different from the completed task and all existing tasks listed below
- Appropriate for ${month} (${season})
- Specific to this property

PROPERTY:
- Location: ${property.county}, ${property.state}
- Acreage: ${property.acreage} acres (${property.woodedAcres ?? '?'} wooded, ${property.openAcres ?? '?'} open)
- Soil: ${property.soilType ?? 'unknown'}
- Water: ${property.waterFeatures?.join(', ') ?? 'none noted'}
- Goals: ${goalList}
- Land health score: ${property.ecosystemScore ?? 50}/100

${satellite ? `${photoIntro(satellite.hasOutline)}

` : ''}EXISTING TASKS (do not suggest these):
${existingTitles}

Return ONLY this JSON (no markdown):
{
  "id": "task-replace-${Date.now()}",
  "title": "clear action title (verb + what + where)",
  "description": "1-2 sentences of exactly what to do",
  "whyItMatters": "1-2 sentences on the ecological benefit specific to this property",
  "impactScore": 7.0,
  "impactBreakdown": {
    "goalAlignment": 7.0,
    "ecosystemImpact": 7.0,
    "seasonalTiming": 7.0,
    "easeCost": 7.0
  },
  "tags": ["tag1", "tag2"],
  "month": "${month}",
  "season": "${season}",
  "tier": "${tier}",${tier === 'conservationist' ? `
  "week": ${Math.min(4, Math.ceil(new Date().getDate() / 7))},` : ''}${detailed ? `
  "steps": ["${tier === 'conservationist' ? '3–6' : '3–5'} short how-to steps, in order, each a single action with amounts or sizes where it helps"],` : ''}
  "completed": false,
  "propertyId": "${property.id}",
  "locationDescription": "2-4 sentences describing exactly where on the property this task takes place. Start from something the owner can see (house, barn, driveway, road, pond, tree line) and give a compass direction and rough distance from it.",
  "recommendations": {
    "species": [],
    "materials": [],
    "dimensions": "",
    "placement": ""${detailed ? `,
    "impactNote": "one sentence on how this task improves land health",
    "timeNeeded": "short hands-on time estimate, e.g. About 2 hours",
    "costEstimate": "short supply cost in US dollars, e.g. $40–60 for seed, or Free"` : ''}
  }${satellite ? `,
  "areaPixels": [[x, y], [x, y], [x, y], [x, y]]` : ''}
}${satellite ? `

${AREA_PIXEL_RULES}` : ''}`;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: satellite ? [photoBlock(satellite.base64), { type: 'text', text: prompt }] : prompt,
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const raw = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const { areaPixels, ...parsed } = JSON.parse(raw) as ActionTask & { areaPixels?: unknown };
    const newTask: ActionTask = parsed;
    const area = ringFromPixels(satellite, areaPixels);
    if (area) newTask.area = area;
    // Ensure the id is unique, and checklist steps are in the saved shape
    newTask.id = `task-replace-${Date.now()}`;
    newTask.tier = tier;
    newTask.completed = false;
    const steps = cleanSteps(newTask.steps);
    if (steps) newTask.steps = steps; else delete newTask.steps;
    const week = cleanWeek(newTask.week);
    if (week) newTask.week = week; else delete newTask.week;

    return NextResponse.json({ task: newTask });
  } catch (err) {
    console.error('[replace-task] error:', err);
    await releaseAiUsage(userId, 'replace-task');
    return NextResponse.json({ error: 'We could not suggest a new task just now. Please try again in a minute.' }, { status: 500 });
  }
}

function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Fall';
  return 'Winter';
}
