import { NextResponse } from "next/server";
import { getSandboxStore } from "@/lib/sandbox/repository";

export const dynamic = "force-dynamic";

/* POST /api/sandbox/[id]/ingest — receive agent events/actions */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const store = await getSandboxStore();
    const sandbox = await store.getById(id);

    if (!sandbox) {
      return NextResponse.json(
        { error: "Sandbox not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { type } = body as { type?: string };

    if (type === "action") {
      // Record an agent action
      const action = await store.recordAgentAction(id, {
        sandbox_id: id,
        agent_id: body.agent_id ?? "unknown",
        action_type: body.action_type ?? "unknown",
        event_id: body.event_id ?? "",
        timestamp: body.timestamp ?? new Date().toISOString(),
        payload: body.payload,
      });
      return NextResponse.json({ action }, { status: 201 });
    }

    // Default: ingest an event
    const event = {
      event_id: body.event_id ?? `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sandbox_id: id,
      source: body.source ?? "agent",
      source_event_id: body.source_event_id,
      event_type: body.event_type ?? "agent.event",
      occurred_at: body.occurred_at ?? new Date().toISOString(),
      ingested_at: new Date().toISOString(),
      subject: body.subject,
      actor: body.actor,
      payload: body.payload,
    };

    await store.ingestAgentEvent(id, event);
    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    console.error("Ingest error:", err);
    return NextResponse.json(
      { error: "Failed to ingest event" },
      { status: 500 }
    );
  }
}
