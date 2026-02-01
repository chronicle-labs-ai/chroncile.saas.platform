import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

const EVENTS_MANAGER_URL = process.env.EVENTS_MANAGER_URL || "http://localhost:8080";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const now = new Date();
    const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const startIso = startOfTodayUtc.toISOString();
    const endIso = now.toISOString();

    const baseUrl = `${EVENTS_MANAGER_URL}/api/events/query?tenant_id=${encodeURIComponent(tenantId)}`;
    const [connectionsCount, eventsResponse, eventsTodayResponse] = await Promise.all([
      prisma.connection.count({
        where: { tenantId, status: "active" },
      }),
      fetch(`${baseUrl}&limit=1000`, { cache: "no-store" }).then((res) =>
        res.ok ? res.json() : { count: 0 }
      ),
      fetch(
        `${baseUrl}&start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}&limit=1000`,
        { cache: "no-store" }
      ).then((res) => (res.ok ? res.json() : { count: 0 })),
    ]);

    const eventsCount = typeof eventsResponse?.count === "number" ? eventsResponse.count : 0;
    const eventsTodayCount =
      typeof eventsTodayResponse?.count === "number" ? eventsTodayResponse.count : 0;

    return NextResponse.json({
      eventsCount,
      connectionsCount,
      eventsTodayCount,
      sessionsCount: 0,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    return NextResponse.json(
      { eventsCount: 0, connectionsCount: 0, eventsTodayCount: 0, sessionsCount: 0 },
      { status: 200 }
    );
  }
}
