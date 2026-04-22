import { NextResponse } from "next/server";

const BACKEND_URL = process.env.LOCAL_BACKEND_URL ?? "http://localhost:8080";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/platform/metrics`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend returned ${res.status}` },
        { status: 502 },
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backend unreachable" },
      { status: 502 },
    );
  }
}
