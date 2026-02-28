import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const environments = await prisma.environment.findMany({
    where: { status: "RUNNING" },
  });

  const results = await Promise.allSettled(
    environments.map((env) => pollEnvironment(env))
  );

  const summary = results.map((r, i) => ({
    name: environments[i].name,
    status: r.status,
    ...(r.status === "rejected" ? { error: String(r.reason) } : {}),
  }));

  return NextResponse.json({ polled: environments.length, results: summary });
}

interface EnvironmentRow {
  id: string;
  name: string;
  flyAppUrl: string | null;
  vercelUrl: string | null;
}

async function pollEnvironment(env: EnvironmentRow): Promise<void> {
  let backendStatus: number | null = null;
  let backendMs: number | null = null;
  let frontendStatus: number | null = null;
  let frontendMs: number | null = null;
  let gitSha: string | null = null;

  if (env.flyAppUrl) {
    try {
      const start = Date.now();
      const res = await fetch(`${env.flyAppUrl}/health`, {
        signal: AbortSignal.timeout(10_000),
      });
      backendMs = Date.now() - start;
      backendStatus = res.status;
      if (res.ok) {
        const data = await res.json();
        gitSha = data.gitSha ?? null;
      }
    } catch {
      backendStatus = 0;
    }
  }

  if (env.vercelUrl) {
    try {
      const start = Date.now();
      const res = await fetch(`${env.vercelUrl}/api/system/info`, {
        signal: AbortSignal.timeout(10_000),
      });
      frontendMs = Date.now() - start;
      frontendStatus = res.status;
    } catch {
      frontendStatus = 0;
    }
  }

  const backendHealthy = backendStatus !== null && backendStatus >= 200 && backendStatus < 300;
  const frontendHealthy = frontendStatus !== null && frontendStatus >= 200 && frontendStatus < 300;
  const isHealthy = backendHealthy && frontendHealthy;

  const now = new Date();

  await prisma.$transaction([
    prisma.healthCheck.create({
      data: {
        environmentId: env.id,
        backendStatus,
        frontendStatus,
        backendMs,
        frontendMs,
        gitSha,
      },
    }),
    prisma.environment.update({
      where: { id: env.id },
      data: {
        isHealthy,
        lastHealthAt: now,
        ...(gitSha ? { gitSha } : {}),
      },
    }),
  ]);
}

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}
