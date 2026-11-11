import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { ActionTask, PropertyProfile } from '@/types';
import { GOAL_LABELS } from '@/types';
import { auth } from '@clerk/nextjs/server';
import { getUserTier } from '@/lib/tier-server';
import { enforceAiLimit, releaseAiUsage } from '@/lib/rate-limit';

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Keep each chat request bounded: only the most recent turns, each trimmed.
// (Pricing analysis: worst case ~$0.02 per question instead of ~$0.05.)
const MAX_TURNS = 8;
const MAX_CHARS_PER_TURN = 1200;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    task: ActionTask;
    property: PropertyProfile;
    userGoalsText?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
  };

  const { task, property, userGoalsText } = body;
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS_PER_TURN) }));
  // The API expects the conversation to start with a user turn.
  while (messages.length && messages[0].role !== 'user') messages.shift();

  if (!task || !property?.goals || !messages.length) {
    return NextResponse.json({ error: 'task, property, and messages are required' }, { status: 400 });
  }

  const limited = await enforceAiLimit(userId, 'task-chat', await getUserTier());
  if (limited) return limited;

  const goalList = property.goals.map((g) => GOAL_LABELS[g]).join(', ');
  const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  const system = `You are LandEthic, a practical land stewardship advisor. You are helping a landowner understand and complete a specific task on their property. Answer their questions in plain, friendly language — like a knowledgeable neighbor who farms and hunts and knows the land. Be specific to their property, soil, and location.

PROPERTY:
- Name: ${property.name}
- Location: ${property.county}, ${property.state}
- Size: ${property.acreage} acres (${property.woodedAcres ?? '?'} wooded, ${property.openAcres ?? '?'} open)
- Soil: ${property.soilType ?? 'unknown'}
- Water features: ${property.waterFeatures?.join(', ') ?? 'none noted'}
- Goals: ${goalList}
${userGoalsText ? `- Owner notes: ${userGoalsText}` : ''}
- Current month: ${month}

CURRENT TASK THE OWNER IS WORKING ON:
Title: ${task.title}
Description: ${task.description}
Why it matters: ${task.whyItMatters}
${task.locationDescription ? `Where on the property: ${task.locationDescription}` : ''}
${task.recommendations?.species?.length ? `Recommended species: ${task.recommendations.species.join(', ')}` : ''}
${task.recommendations?.materials?.length ? `Materials: ${task.recommendations.materials.join(', ')}` : ''}
${task.recommendations?.dimensions ? `Size/area: ${task.recommendations.dimensions}` : ''}
${task.recommendations?.placement ? `Placement: ${task.recommendations.placement}` : ''}

RULES:
- Keep answers short — 2 to 4 sentences unless a step-by-step is genuinely needed
- Write like you are talking to a farmer who is standing in the field right now
- Be specific to their soil type, county, and season — never give generic advice
- If they ask how to do something, give the actual steps, not a vague overview
- Never use jargon without immediately explaining it in plain words`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system,
      messages,
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : '';
    return NextResponse.json({ reply });
  } catch (err) {
    await releaseAiUsage(userId, 'task-chat');
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[task-chat] error:', msg);
    return NextResponse.json({ error: 'Sorry, we could not answer just now. Please try again in a minute.' }, { status: 500 });
  }
}
