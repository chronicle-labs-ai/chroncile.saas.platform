import { NextResponse } from "next/server";
import { runMigrations } from "@/backend/local-dev";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const targets = body.targets as ("sqlx" | "prisma")[] | undefined;

    const result = await runMigrations(targets);
    const allSucceeded = result.results.every((r) => r.success);

    return NextResponse.json(
      {
        success: allSucceeded,
        versionBefore: result.before.overallVersion,
        versionAfter: result.after.overallVersion,
        statusBefore: result.before.overallStatus,
        statusAfter: result.after.overallStatus,
        results: result.results,
      },
      { status: allSucceeded ? 200 : 207 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
