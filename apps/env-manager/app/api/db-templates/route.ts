import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/data/db";
import { ensureBuiltInTemplates } from "@/backend/environments/seed-templates";

export async function GET(request: NextRequest) {
  const appUrl = new URL(request.url).origin;
  await ensureBuiltInTemplates(appUrl);

  const templates = await prisma.dbTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(templates);
}

const CreateSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  mode: z.enum(["FLY_DB", "ENVIRONMENT", "SEED_ONLY"]),
  flyDbName: z.string().optional(),
  sourceEnvId: z.string().optional(),
  seedSqlUrl: z.string().min(1).optional().or(z.literal("")),
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

  const { mode, flyDbName, sourceEnvId } = parsed.data;

  // Resolve relative seed URLs to absolute using the request origin
  let seedSqlUrl = parsed.data.seedSqlUrl || null;
  if (seedSqlUrl && seedSqlUrl.startsWith("/")) {
    const origin = new URL(request.url).origin;
    seedSqlUrl = `${origin}${seedSqlUrl}`;
  }

  if (mode === "FLY_DB" && !flyDbName) {
    return NextResponse.json(
      { error: "flyDbName required for FLY_DB mode" },
      { status: 400 }
    );
  }
  if (mode === "ENVIRONMENT" && !sourceEnvId) {
    return NextResponse.json(
      { error: "sourceEnvId required for ENVIRONMENT mode" },
      { status: 400 }
    );
  }

  if (mode === "ENVIRONMENT" && sourceEnvId) {
    const env = await prisma.environment.findUnique({
      where: { id: sourceEnvId },
    });
    if (!env)
      return NextResponse.json(
        { error: "Source environment not found" },
        { status: 404 }
      );
    if (!env.flyDbName)
      return NextResponse.json(
        { error: "Source environment has no database" },
        { status: 400 }
      );
  }

  const template = await prisma.dbTemplate.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      mode: parsed.data.mode,
      flyDbName: parsed.data.flyDbName || null,
      sourceEnvId: parsed.data.sourceEnvId || null,
      seedSqlUrl,
    },
  });

  return NextResponse.json(template, { status: 201 });
}
