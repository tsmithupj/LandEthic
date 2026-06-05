import { NextRequest, NextResponse } from 'next/server';
import type { GeneratePlanRequest, GeneratePlanResponse, PropertyProfile } from '@/types';
import { generatePlan } from '@/lib/claude';

export async function POST(req: NextRequest) {
  try {
    const body: GeneratePlanRequest & { profile: PropertyProfile } = await req.json();

    if (!body.profile || !body.tier) {
      return NextResponse.json({ error: 'profile and tier are required' }, { status: 400 });
    }

    const plan = await generatePlan({
      profile: body.profile,
      tier:    body.tier,
      userGoalsText: (body as { userGoalsText?: string }).userGoalsText,
    });

    const response: GeneratePlanResponse = { plan };
    return NextResponse.json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[generate-plan] ERROR:', msg);
    return NextResponse.json(
      { error: `Plan generation failed: ${msg}` },
      { status: 500 }
    );
  }
}
