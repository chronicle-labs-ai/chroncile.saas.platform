import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/data/db";

export async function GET() {
  const keys = await prisma.emailTemplateKey.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      assignments: {
        include: { environment: { select: { id: true, name: true } } },
      },
    },
  });
  return NextResponse.json(keys);
}

const CreateSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  variables: z.array(
    z.object({
      key: z.string(),
      type: z.enum(["string", "number"]),
      description: z.string().optional(),
      sampleValue: z.string().optional(),
    })
  ),
  category: z
    .enum(["transactional", "auth", "notification"])
    .default("transactional"),
});

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.emailTemplateKey.findUnique({
    where: { key: parsed.data.key },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Template key "${parsed.data.key}" already exists` },
      { status: 409 }
    );
  }

  const templateKey = await prisma.emailTemplateKey.create({
    data: {
      key: parsed.data.key,
      name: parsed.data.name,
      description: parsed.data.description,
      variables: parsed.data.variables,
      category: parsed.data.category,
    },
  });

  return NextResponse.json(templateKey, { status: 201 });
}
