import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { appendAuditLog } from "@/lib/audit-log";
import prisma from "@/lib/db";
import type { LeadGenLead } from "@/lib/lead-gen-mock-data";

export const dynamic = "force-dynamic";

function generateEventId(): string {
  return `01${Date.now().toString(36).toUpperCase().padStart(24, "0").slice(-24)}`;
}

/**
 * POST /api/lead-gen/create-runs
 * Creates one run per lead with workflowId "lead-gen". Idempotency via invocationId = lead_gen_${lead.id}.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  let body: { leads: LeadGenLead[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { leads } = body;
  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json(
      { error: "Body must include a non-empty array 'leads'" },
      { status: 400 }
    );
  }

  let created = 0;
  const errors: string[] = [];

  for (const lead of leads) {
    const id = lead?.id ?? `unknown_${created}`;
    const invocationId = `lead_gen_${id}`;
    const eventId = generateEventId();

    try {
      await prisma.run.create({
        data: {
          tenantId,
          eventId,
          invocationId,
          workflowId: "lead-gen",
          mode: "shadow",
          status: "pending",
          eventSnapshot: (lead ?? {}) as unknown as Prisma.InputJsonValue,
        },
      });
      await appendAuditLog({
        tenantId,
        eventId,
        invocationId,
        action: "run_created",
        payload: { mode: "shadow", workflowId: "lead-gen", source: "lead-gen" },
      });
      created++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Unique constraint") || message.includes("invocationId")) {
        // Idempotent: already exists, skip
        continue;
      }
      errors.push(`${id}: ${message}`);
    }
  }

  return NextResponse.json({
    created,
    total: leads.length,
    ...(errors.length > 0 && { errors }),
  });
}
