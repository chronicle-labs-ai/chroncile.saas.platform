import { NextResponse } from "next/server";

import { auth } from "@/server/auth/auth";
import {
  startEnvironmentSandbox,
  stopEnvironmentSandbox,
} from "@/server/sandbox/daytona";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LifecycleRequestBody {
  environmentId?: string;
  action?: "start" | "stop";
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | LifecycleRequestBody
    | null;
  const environmentId = body?.environmentId?.trim();
  const action = body?.action;

  if (!environmentId) {
    return NextResponse.json(
      { error: "environmentId is required" },
      { status: 400 }
    );
  }
  if (action !== "start" && action !== "stop") {
    return NextResponse.json(
      { error: "action must be 'start' or 'stop'" },
      { status: 400 }
    );
  }

  const namespacedId = `${session.user.tenantId ?? "no-tenant"}::${environmentId}`;

  try {
    const result =
      action === "start"
        ? await startEnvironmentSandbox(namespacedId)
        : await stopEnvironmentSandbox(namespacedId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
