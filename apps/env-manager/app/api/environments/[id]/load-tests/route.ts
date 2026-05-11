import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/data/db";
import { launchCloudTest, getTestRun } from "@/backend/integrations/k6-client";

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  vus: z.number().int().min(1).max(1000),
  duration: z.string().regex(/^\d+(s|m|h)$/),
  rampUp: z.string().regex(/^(none|\d+(s|m))$/),
  endpoints: z.array(z.string().min(1)).min(1),
});

const K6_STATUS_TO_LOCAL: Record<string, string> = {
  created: "queued",
  queued: "queued",
  initializing: "initializing",
  running: "running",
  processing_metrics: "running",
  completed: "finished",
  aborted: "aborted",
};

type StressTestRow = {
  id: string;
  k6TestRunId: string | null;
  status: string;
  startedAt: Date | null;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const env = await prisma.environment.findUnique({ where: { id } });
  if (!env) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tests = await prisma.stressTest.findMany({
    where: { environmentId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const refreshed = await Promise.all(
    tests.map(async (test: StressTestRow) => {
      if (
        !test.k6TestRunId ||
        test.status === "finished" ||
        test.status === "aborted" ||
        test.status === "error"
      ) {
        return test;
      }

      try {
        const run = await getTestRun(Number(test.k6TestRunId));
        const newStatus = K6_STATUS_TO_LOCAL[run.status] ?? test.status;

        const updates: Record<string, unknown> = {
          status: newStatus,
        };
        if (run.ended) {
          updates.finishedAt = new Date(run.ended);
        }
        if (run.status === "running" && !test.startedAt) {
          updates.startedAt = new Date(
            run.status_details?.entered ?? new Date().toISOString()
          );
        }

        if (newStatus !== test.status || run.ended) {
          const updated = await prisma.stressTest.update({
            where: { id: test.id },
            data: updates,
          });
          return updated;
        }
      } catch {
        // k6 API unreachable — return stale data
      }
      return test;
    })
  );

  return NextResponse.json(refreshed);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const env = await prisma.environment.findUnique({ where: { id } });
  if (!env) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (env.status !== "RUNNING") {
    return NextResponse.json(
      { error: "Environment is not running" },
      { status: 400 }
    );
  }
  if (!env.flyAppUrl) {
    return NextResponse.json(
      { error: "Environment has no backend URL" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, vus, duration, rampUp, endpoints } = parsed.data;

  const activeTest = await prisma.stressTest.findFirst({
    where: {
      environmentId: id,
      status: { in: ["queued", "initializing", "running"] },
    },
  });
  if (activeTest) {
    return NextResponse.json(
      { error: "A load test is already running for this environment" },
      { status: 409 }
    );
  }

  const config = { vus, duration, rampUp, endpoints };

  const record = await prisma.stressTest.create({
    data: {
      environmentId: id,
      name,
      status: "queued",
      config,
    },
  });

  try {
    const result = await launchCloudTest({
      name: `${env.name} — ${name}`,
      backendUrl: env.flyAppUrl,
      frontendUrl: env.vercelUrl,
      config,
    });

    const updated = await prisma.stressTest.update({
      where: { id: record.id },
      data: {
        k6TestRunId: String(result.testRunId),
        k6Url: result.k6Url,
        status: "initializing",
      },
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (err) {
    await prisma.stressTest.update({
      where: { id: record.id },
      data: {
        status: "error",
        resultSummary: {
          error: err instanceof Error ? err.message : String(err),
        },
      },
    });

    return NextResponse.json(
      {
        error: "Failed to start k6 Cloud test",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
