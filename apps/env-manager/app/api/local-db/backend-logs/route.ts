import { NextResponse } from "next/server";
import { getBackendLogs } from "@/backend/local-dev";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tail = parseInt(searchParams.get("tail") ?? "200", 10);

  try {
    const logs = await getBackendLogs(tail);
    return NextResponse.json({ logs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
