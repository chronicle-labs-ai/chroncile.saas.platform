import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const EVENTS_MANAGER_URL = process.env.EVENTS_MANAGER_URL || "http://localhost:8080";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const startIso = start.toISOString();
  const endIso = now.toISOString();

  try {
    const url = `${EVENTS_MANAGER_URL}/api/events/query?tenant_id=${encodeURIComponent(tenantId)}&start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}&limit=20`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ events: [] }, { status: 200 });
    }
    const data = await res.json();
    const events = Array.isArray(data.events) ? data.events : [];
    return NextResponse.json({ events });
  } catch (err) {
    console.error("Dashboard activity error:", err);
    return NextResponse.json({ events: [] }, { status: 200 });
  }
}
