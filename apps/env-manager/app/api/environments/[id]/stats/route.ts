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

  if (!env.flyAppUrl) return NextResponse.json(stats);

  const serviceSecret = process.env.SERVICE_SECRET;
  const serviceUserId = process.env.SERVICE_USER_ID;

  try {
    // Try the new admin stats endpoint first (available after latest deploy)
    if (serviceSecret) {
      const adminRes = await fetch(`${env.flyAppUrl}/api/platform/admin/stats`, {
        headers: { "x-service-secret": serviceSecret },
        signal: AbortSignal.timeout(8_000),
      });
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

    // Fall back: exchange SERVICE_SECRET for a JWT, then call dashboard stats
    if (serviceSecret && serviceUserId) {
      const exchangeRes = await fetch(
        `${env.flyAppUrl}/api/platform/auth/token-exchange`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_secret: serviceSecret,
            user_id: serviceUserId,
            email: "service@chronicle-labs.com",
            name: "Service Account",
            tenant_id: serviceUserId,
            tenant_name: "Chronicle Labs",
            tenant_slug: "chronicle-labs",
          }),
          signal: AbortSignal.timeout(8_000),
        }
      );

      if (exchangeRes.ok) {
        const { token } = await exchangeRes.json();
        const dashRes = await fetch(
          `${env.flyAppUrl}/api/platform/dashboard/stats`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(8_000),
          }
        );
        if (dashRes.ok) {
          const data = await dashRes.json();
          // serde rename_all = camelCase on the backend
          stats.runs = data.totalRuns ?? null;
          stats.connections = data.totalConnections ?? null;
          return NextResponse.json(stats);
        }
      }
    }

    // Confirm backend is at least reachable
    const healthRes = await fetch(`${env.flyAppUrl}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (healthRes.ok) {
      stats._note = "Add SERVICE_SECRET + SERVICE_USER_ID to .env to enable metrics";
    }
  } catch {
    // backend unreachable — all nulls returned
  }

  return NextResponse.json(stats);
}
