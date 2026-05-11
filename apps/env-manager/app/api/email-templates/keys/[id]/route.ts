import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/data/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const UpdateSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    variables: z
      .array(
        z.object({
          key: z.string(),
          type: z.enum(["string", "number"]),
          description: z.string().optional(),
          sampleValue: z.string().optional(),
        })
      )
      .optional(),
    category: z.enum(["transactional", "auth", "notification"]).optional(),
  });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.emailTemplateKey.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.emailTemplateKey.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const existing = await prisma.emailTemplateKey.findUnique({
    where: { id },
    include: { assignments: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.assignments.length > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete: template key has active assignments. Remove assignments first.",
      },
      { status: 409 }
    );
  }

  await prisma.emailTemplateKey.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
