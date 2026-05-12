import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/data/db";

export async function GET() {
  const assignments = await prisma.emailTemplateAssignment.findMany({
    include: {
      templateKey: { select: { id: true, key: true, name: true } },
      environment: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(assignments);
}

const UpsertSchema = z.object({
  templateKeyId: z.string().min(1),
  environmentId: z.string().nullable().default(null),
  resendTemplateId: z.string().min(1),
});

export async function PUT(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { templateKeyId, environmentId, resendTemplateId } = parsed.data;

  const templateKey = await prisma.emailTemplateKey.findUnique({
    where: { id: templateKeyId },
  });
  if (!templateKey) {
    return NextResponse.json(
      { error: "Template key not found" },
      { status: 404 }
    );
  }

  if (environmentId) {
    const env = await prisma.environment.findUnique({
      where: { id: environmentId },
    });
    if (!env) {
      return NextResponse.json(
        { error: "Environment not found" },
        { status: 404 }
      );
    }
  }

  const existing = environmentId
    ? await prisma.emailTemplateAssignment.findUnique({
        where: {
          templateKeyId_environmentId: { templateKeyId, environmentId },
        },
      })
    : await prisma.emailTemplateAssignment.findFirst({
        where: { templateKeyId, environmentId: null },
      });

  let assignment;
  if (existing) {
    assignment = await prisma.emailTemplateAssignment.update({
      where: { id: existing.id },
      data: { resendTemplateId },
    });
  } else {
    assignment = await prisma.emailTemplateAssignment.create({
      data: { templateKeyId, environmentId, resendTemplateId },
    });
  }

  return NextResponse.json(assignment);
}
