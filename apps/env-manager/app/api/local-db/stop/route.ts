import { NextResponse } from "next/server";
import { stopPostgres } from "@/backend/local-dev";

export async function POST() {
  try {
    const status = await stopPostgres();
    return NextResponse.json({ status: "stopped", container: status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
