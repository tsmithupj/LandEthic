import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { ActionTask, PropertyProfile } from '@/types';
import { GOAL_LABELS } from '@/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    task: ActionTask;
    property: PropertyProfile;
    userGoalsText?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
  };

  const { task, property, userGoalsText, messages } = body;

  if (!task || !property || !messages?.length) {
    return NextResponse.json({ error: 'task, property, and messages are required' }, { status: 400 });
  }

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
      max_tokens: 1024,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : '';
    return NextResponse.json({ reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[task-chat] error:', msg);
    return NextResponse.json({ error: `Chat failed: ${msg}` }, { status: 500 });
  }
}
