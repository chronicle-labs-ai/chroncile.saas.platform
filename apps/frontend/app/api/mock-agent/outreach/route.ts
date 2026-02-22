import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/mock-agent/outreach
 * Mock agent for lead-gen workflow. Returns fixed drafts (outreach email).
 * Use this URL in Settings → Agent endpoint to process lead-gen runs.
 */
export async function POST(request: NextRequest) {
  let payload: Record<string, unknown> | null = null;
  try {
    payload = await request.json();
  } catch {
    // optional
  }

  const event = (payload?.event as Record<string, unknown>) ?? {};
  const companyName = (event?.name as string) ?? "Company";
  const domain = (event?.domain as string) ?? "example.com";

  return NextResponse.json({
    drafts: [
      {
        channel: "email",
        subject: `Agent Warmup – safe rollout for AI in your contact center`,
        body: `Hi,\n\nWe help large contact center teams like ${companyName} warm up AI agents with expert review and shadow mode before production.\n\nWould you be open to a short call to see if this fits your roadmap?\n\nBest regards`,
      },
    ],
    proposed_actions: [],
    questions_for_humans: [],
    metadata: { confidence: 0.9, mock: true },
  });
}
