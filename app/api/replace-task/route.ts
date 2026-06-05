import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { ActionTask, PropertyProfile, SubscriptionTier } from '@/types';
import { GOAL_LABELS } from '@/types';

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
  const body = await req.json() as {
    completedTask: ActionTask;
    property: PropertyProfile;
    existingTasks: ActionTask[];
    tier: SubscriptionTier;
  };

  const { completedTask, property, existingTasks, tier } = body;
  const goalList = property.goals.map((g) => GOAL_LABELS[g]).join(', ');
  const existingTitles = existingTasks.map((t) => `- ${t.title}`).join('\n');
  const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  const season = getCurrentSeason();

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

EXISTING TASKS (do not suggest these):
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
  "tier": "${tier}",
  "completed": false,
  "propertyId": "${property.id}",
  "locationDescription": "2-4 sentences describing exactly where on the property this task takes place. Use cardinal directions and reference features the owner can see.",
  "recommendations": {
    "species": [],
    "materials": [],
    "dimensions": "",
    "placement": ""
  }
}`;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const raw = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const newTask = JSON.parse(raw) as ActionTask;
    // Ensure the id is unique
    newTask.id = `task-replace-${Date.now()}`;

    return NextResponse.json({ task: newTask });
  } catch (err) {
    console.error('[replace-task] error:', err);
    return NextResponse.json({ error: 'Failed to generate replacement task' }, { status: 500 });
  }
}

function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Fall';
  return 'Winter';
}
