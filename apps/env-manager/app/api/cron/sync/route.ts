import { NextRequest, NextResponse } from "next/server";
import { syncPermanentEnvironments } from "@/backend/environments/sync";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const synced = await syncPermanentEnvironments();

  return NextResponse.json({ synced });
}

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}
