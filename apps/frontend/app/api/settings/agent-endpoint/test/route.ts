import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveAgentConfig, invokeAgent } from "@/lib/agent-endpoint";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/** POST: test agent endpoint connection (no config change). */
export async function POST() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const config = await prisma.agentEndpointConfig.findUnique({
    where: { tenantId: session.user.tenantId },
  });

  const resolved = resolveAgentConfig(config);
  if (!resolved) {
    return NextResponse.json(
      { ok: false, error: "Agent endpoint URL not configured" },
      { status: 400 }
    );
  }

  const result = await invokeAgent(resolved, {
    event_id: "test",
    mode: "shadow",
  });

  if (result.ok) {
    return NextResponse.json({ ok: true, status: result.status });
  }
  return NextResponse.json(
    { ok: false, status: result.status, error: result.error ?? "Request failed" },
    { status: 200 }
  );
}
