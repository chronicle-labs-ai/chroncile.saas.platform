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
    _note: null as string | null,
  };

  if (!env.flyAppUrl) {
    return NextResponse.json(stats);
  }

  const serviceSecret = process.env.SERVICE_SECRET;

  try {
    // Call the admin stats endpoint (requires SERVICE_SECRET header)
    const statsRes = await fetch(
      `${env.flyAppUrl}/api/platform/admin/stats`,
      {
        headers: {
          "x-service-secret": serviceSecret ?? "",
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(8_000),
      }
    );

    if (statsRes.ok) {
      const data = await statsRes.json();
      stats.tenants = data.tenants ?? null;
      stats.users = data.users ?? null;
      stats.events = data.events ?? null;
      stats.runs = data.runs ?? null;
      stats.connections = data.connections ?? null;
      stats._note = data._note ?? null;
      return NextResponse.json(stats);
    }

    // Fall back to health check to confirm backend is reachable
    const healthRes = await fetch(`${env.flyAppUrl}/health`, {
      signal: AbortSignal.timeout(5_000),
    });

    if (healthRes.ok) {
      stats._note = "Backend reachable — set SERVICE_SECRET to enable metrics";
    }
  } catch {
    // backend unreachable
  }

  return NextResponse.json(stats);
}
