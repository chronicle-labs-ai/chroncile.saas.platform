import { NextResponse } from "next/server";
import { prisma } from "@/backend/data/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "50", 10),
    200
  );

  const env = await prisma.environment.findUnique({ where: { id } });
  if (!env) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const healthChecks = await prisma.healthCheck.findMany({
    where: { environmentId: id },
    orderBy: { checkedAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    environment: {
      id: env.id,
      name: env.name,
      isHealthy: env.isHealthy,
      lastHealthAt: env.lastHealthAt,
    },
    healthChecks,
  });
}
