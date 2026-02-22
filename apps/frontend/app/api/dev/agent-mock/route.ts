import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/dev/agent-mock
 * Simulates an agent endpoint for local testing.
 * Use this URL in Settings → Agent endpoint to test "Test connection" and "Send pending to agent".
 */
export async function POST(request: NextRequest) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // Test connection sends minimal payload
  }

  const payload = body as Record<string, unknown> | null;
  const eventId = payload?.event_id ?? "unknown";
  const mode = payload?.mode ?? "shadow";

  return NextResponse.json({
    ok: true,
    mock: true,
    message: "Agent mock received request",
    received: {
      event_id: eventId,
      mode,
      run_id: payload?.run_id ?? null,
      invocation_id: payload?.invocation_id ?? null,
    },
  });
}
