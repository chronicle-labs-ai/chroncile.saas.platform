import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";

export interface AppendAuditLogParams {
  tenantId: string;
  runId?: string;
  eventId?: string;
  invocationId?: string;
  action: string;
  actor?: string;
  payload?: Record<string, unknown>;
}

export async function appendAuditLog(params: AppendAuditLogParams): Promise<void> {
  const { tenantId, runId, eventId, invocationId, action, actor, payload } = params;

  await prisma.auditLog.create({
    data: {
      tenantId,
      runId: runId ?? undefined,
      eventId: eventId ?? undefined,
      invocationId: invocationId ?? undefined,
      action,
      actor: actor ?? undefined,
      payload: payload != null ? (payload as Prisma.InputJsonValue) : undefined,
    },
  });
}
