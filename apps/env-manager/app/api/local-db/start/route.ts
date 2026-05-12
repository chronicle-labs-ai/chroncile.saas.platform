import { NextResponse } from "next/server";
import { startPostgres } from "@/backend/local-dev";

export async function POST() {
  try {
    const status = await startPostgres();
    return NextResponse.json({ status: "started", container: status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
