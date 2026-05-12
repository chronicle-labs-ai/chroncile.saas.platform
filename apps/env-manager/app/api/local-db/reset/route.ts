import { NextResponse } from "next/server";
import { resetPostgres, runMigrations, restartBackend } from "@/backend/local-dev";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const shouldMigrate = body.migrate === true;
    const shouldRestartBackend = body.restartBackend === true;

    const container = await resetPostgres();

    let migrationResult = null;
    if (shouldMigrate) {
      migrationResult = await runMigrations();
    }

    let backendResult = null;
    if (shouldRestartBackend) {
      backendResult = await restartBackend();
    }

    return NextResponse.json({
      status: "reset-complete",
      container,
      migrations: migrationResult
        ? {
            success: migrationResult.results.every((r) => r.success),
            versionAfter: migrationResult.after.overallVersion,
            results: migrationResult.results,
          }
        : null,
      backend: backendResult,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
