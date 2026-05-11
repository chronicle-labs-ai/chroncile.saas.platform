import { NextResponse } from "next/server";

import { auth } from "@/server/auth/auth";
import { fetchEnvironmentSandboxStats } from "@/server/sandbox/daytona";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StatsRequestBody {
  environmentId?: string;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | StatsRequestBody
    | null;
  const environmentId = body?.environmentId?.trim();
  if (!environmentId) {
    return NextResponse.json(
      { error: "environmentId is required" },
      { status: 400 }
    );
  }

  const namespacedId = `${session.user.tenantId ?? "no-tenant"}::${environmentId}`;

  try {
    const stats = await fetchEnvironmentSandboxStats(namespacedId);
    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
