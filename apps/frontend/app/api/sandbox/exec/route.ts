import { NextResponse } from "next/server";

import { auth } from "@/server/auth/auth";
import { executeInEnvironmentSandbox } from "@/server/sandbox/daytona";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExecRequestBody {
  environmentId?: string;
  command?: string;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | ExecRequestBody
    | null;
  const environmentId = body?.environmentId?.trim();
  const command = typeof body?.command === "string" ? body.command : "";

  if (!environmentId) {
    return NextResponse.json(
      { error: "environmentId is required" },
      { status: 400 }
    );
  }
  if (!command.trim()) {
    return NextResponse.json(
      { error: "command is required" },
      { status: 400 }
    );
  }

  // Namespace sandboxes per tenant so two workspaces never share one.
  const namespacedId = `${session.user.tenantId ?? "no-tenant"}::${environmentId}`;

  try {
    const result = await executeInEnvironmentSandbox(namespacedId, command);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
