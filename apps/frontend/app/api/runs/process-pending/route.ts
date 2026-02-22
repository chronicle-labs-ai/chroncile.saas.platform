import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { appendAuditLog } from "@/lib/audit-log";
import { resolveAgentConfig, invokeAgent } from "@/lib/agent-endpoint";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/runs/process-pending
 * Fetch pending runs (status === "pending", agentResponse === null), invoke agent for each, update run.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  const configRow = await prisma.agentEndpointConfig.findUnique({
    where: { tenantId },
  });
  const config = resolveAgentConfig(configRow);
  if (!config) {
    return NextResponse.json(
      { error: "Agent endpoint not configured" },
      { status: 400 }
    );
  }

  const runs = await prisma.run.findMany({
    where: {
      tenantId,
      status: "pending",
      agentResponse: { equals: Prisma.DbNull },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const run of runs) {
    const payload = {
      tenant_id: tenantId,
      workflow_id: run.workflowId ?? null,
      event: run.eventSnapshot ?? null,
      event_id: run.eventId,
      invocation_id: run.invocationId,
      run_id: run.id,
      mode: run.mode,
    };

    const result = await invokeAgent(config, payload);

    if (result.ok) {
      await prisma.run.update({
        where: { id: run.id },
        data: {
          agentRequest: payload as Prisma.InputJsonValue,
          agentResponse:
            result.data != null
              ? (result.data as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          status: "pending_review",
        },
      });
      await appendAuditLog({
        tenantId,
        runId: run.id,
        eventId: run.eventId,
        invocationId: run.invocationId,
        action: "agent_invoked",
        payload: { status: result.status },
      });
      processed++;
    } else {
      const errorMessage = result.error ?? "Unknown error";
      await prisma.run.update({
        where: { id: run.id },
        data: {
          agentRequest: payload as Prisma.InputJsonValue,
          agentResponse: { error: errorMessage } as Prisma.InputJsonValue,
          status: "failed",
        },
      });
      await appendAuditLog({
        tenantId,
        runId: run.id,
        eventId: run.eventId,
        invocationId: run.invocationId,
        action: "agent_failed",
        payload: { error: errorMessage, status: result.status },
      });
      failed++;
      errors.push(`${run.id}: ${errorMessage}`);
    }
  }

  return NextResponse.json({
    processed,
    failed,
    ...(errors.length > 0 && { errors }),
  });
}
