import { NextResponse } from "next/server";
import { prisma } from "@/backend/data/db";

const SERVICE_USER_ID =
  process.env.SERVICE_USER_ID ?? "env-manager-service-account";

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

  if (!env.flyAppUrl) return NextResponse.json(stats);

  // Use per-environment secret if stored; fall back to global
  const secret = env.serviceSecret || process.env.SERVICE_SECRET || "";

  try {
    // 1. Try the admin stats endpoint (new, requires latest backend deploy)
    if (secret) {
      const adminRes = await fetch(
        `${env.flyAppUrl}/api/platform/admin/stats`,
        {
          headers: { "x-service-secret": secret },
          signal: AbortSignal.timeout(45_000),
        }
      );
      if (adminRes.ok) {
        const data = await adminRes.json();
        stats.tenants = data.tenants ?? null;
        stats.users = data.users ?? null;
        stats.events = data.events ?? null;
        stats.runs = data.runs ?? null;
        stats.connections = data.connections ?? null;
        stats._note = data._note ?? null;
        return NextResponse.json(stats);
      }
    }

    // 2. Fall back: token-exchange → dashboard/stats (works on all deployed backends)
    if (secret) {
      const exchangeRes = await fetch(
        `${env.flyAppUrl}/api/platform/auth/token-exchange`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_secret: secret,
            user_id: SERVICE_USER_ID,
            email: "service@chronicle-labs.com",
            name: "Service Account",
            tenant_id: SERVICE_USER_ID,
            tenant_name: "Chronicle Labs",
            tenant_slug: "chronicle-labs",
          }),
          signal: AbortSignal.timeout(45_000),
        }
      );

      if (exchangeRes.ok) {
        const { token } = await exchangeRes.json();
        if (token) {
          const dashRes = await fetch(
            `${env.flyAppUrl}/api/platform/dashboard/stats`,
            {
              headers: { Authorization: `Bearer ${token}` },
              signal: AbortSignal.timeout(10_000),
            }
          );
          if (dashRes.ok) {
            const data = await dashRes.json();
            stats.runs = data.totalRuns ?? null;
            stats.connections = data.totalConnections ?? null;
            return NextResponse.json(stats);
          }
        }
      }
    }

    // 3. At least confirm the backend is alive
    const healthRes = await fetch(`${env.flyAppUrl}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (healthRes.ok) {
      stats._note = !secret
        ? "Set serviceSecret on this environment to enable metrics"
        : "Backend reachable but metrics unavailable";
    }
  } catch {
    // backend unreachable
  }

  return NextResponse.json(stats);
}
