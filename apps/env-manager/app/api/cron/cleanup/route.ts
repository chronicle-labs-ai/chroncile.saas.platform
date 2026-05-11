import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/data/db";
import { destroyEnvironment } from "@/backend/environments/lifecycle";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expired = await prisma.environment.findMany({
    where: {
      type: "EPHEMERAL",
      status: "RUNNING",
      expiresAt: { lt: new Date() },
    },
  });

  const results = await Promise.allSettled(
    expired.map(async (env: { id: string; name: string }) => {
      await prisma.environment.update({
        where: { id: env.id },
        data: { status: "DESTROYING" },
      });
      await destroyEnvironment(env.id);
      return env.name;
    })
  );

  const summary = results.map((r, i) => ({
    name: expired[i].name,
    status: r.status,
    ...(r.status === "rejected" ? { error: String(r.reason) } : {}),
  }));

  return NextResponse.json({ expired: expired.length, results: summary });
}

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}
