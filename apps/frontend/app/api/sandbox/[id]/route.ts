import { NextResponse } from "next/server";

import type { UpdateSandboxPayload } from "@/components/sandbox/types";
import { getSandboxStore } from "@/features/sandbox/server/repository";
import { auth } from "@/server/auth/auth";

export const dynamic = "force-dynamic";

async function getScopedSandbox(id: string, tenantId: string) {
  const store = await getSandboxStore();
  await store.list(tenantId);
  const sandbox = await store.getById(id);

  if (!sandbox || sandbox.tenantId !== tenantId) {
    return { store, sandbox: null };
  }

  return { store, sandbox };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { store, sandbox } = await getScopedSandbox(id, session.user.tenantId);
    if (!sandbox) {
      return NextResponse.json({ error: "Sandbox not found" }, { status: 404 });
    }

    const [events, actions] = await Promise.all([
      store.getEvents(id),
      store.getAgentActions(id),
    ]);

    return NextResponse.json({ sandbox, events, actions });
  } catch (error) {
    console.error("Failed to load sandbox:", error);
    return NextResponse.json(
      { error: "Failed to load sandbox" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { store, sandbox } = await getScopedSandbox(id, session.user.tenantId);
    if (!sandbox) {
      return NextResponse.json({ error: "Sandbox not found" }, { status: 404 });
    }

    const payload = (await request.json()) as UpdateSandboxPayload;
    const updated = await store.update(id, payload);
    if (!updated) {
      return NextResponse.json(
        { error: "Sandbox update failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ sandbox: updated });
  } catch (error) {
    console.error("Failed to update sandbox:", error);
    return NextResponse.json(
      { error: "Failed to update sandbox" },
      { status: 500 }
    );
  }
}
