import { NextResponse } from "next/server";
import { restartBackend } from "@/backend/local-dev";

export async function POST() {
  try {
    const result = await restartBackend();
    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
