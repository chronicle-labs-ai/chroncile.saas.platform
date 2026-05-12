import { NextResponse } from "next/server";
import { getLocalDbStatus } from "@/backend/local-dev";

export async function GET() {
  try {
    const status = await getLocalDbStatus();
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
