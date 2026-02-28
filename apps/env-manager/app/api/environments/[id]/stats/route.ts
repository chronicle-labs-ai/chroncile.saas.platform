import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const env = await prisma.environment.findUnique({ where: { id } });
  if (!env) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stats = {
    tenants: null as number | null,
    users: null as number | null,
    events: null as number | null,
    runs: null as number | null,
    connections: null as number | null,
  };

  if (!env.flyAppUrl) {
    return NextResponse.json(stats);
  }

  try {
    const res = await fetch(`${env.flyAppUrl}/api/platform/dashboard/stats`, {
      signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      const data = await res.json();
      stats.tenants = data.tenants ?? data.tenantCount ?? null;
      stats.users = data.users ?? data.userCount ?? null;
      stats.events = data.events ?? data.eventCount ?? null;
      stats.runs = data.runs ?? data.runCount ?? null;
      stats.connections = data.connections ?? data.connectionCount ?? null;
    }
  } catch {
    // stats unavailable
  }

  return NextResponse.json(stats);
}
