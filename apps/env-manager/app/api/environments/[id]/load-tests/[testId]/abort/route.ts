import { NextResponse } from "next/server";
import { prisma } from "@/backend/data/db";
import { abortTestRun } from "@/backend/integrations/k6-client";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; testId: string }> }
) {
  const { id, testId } = await params;

  const test = await prisma.stressTest.findFirst({
    where: { id: testId, environmentId: id },
  });

  if (!test) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    test.status === "finished" ||
    test.status === "aborted" ||
    test.status === "error"
  ) {
    return NextResponse.json({ error: "Test is not active" }, { status: 400 });
  }

  try {
    if (test.k6TestRunId) {
      await abortTestRun(Number(test.k6TestRunId));
    }
  } catch {
    // k6 abort may fail if already finished — still mark locally
  }

  const updated = await prisma.stressTest.update({
    where: { id: testId },
    data: {
      status: "aborted",
      finishedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
