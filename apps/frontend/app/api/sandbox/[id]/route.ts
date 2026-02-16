import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSandboxStore } from "@/lib/sandbox/repository";

export const dynamic = "force-dynamic";

/* GET /api/sandbox/[id] — get sandbox by ID */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const store = await getSandboxStore();
    const sandbox = await store.getById(id);

    if (!sandbox) {
      return NextResponse.json(
        { error: "Sandbox not found" },
        { status: 404 }
      );
    }

    const events = await store.getEvents(id);
    const actions = await store.getAgentActions(id);

    return NextResponse.json({ sandbox, events, actions });
  } catch (err) {
    console.error("Get sandbox error:", err);
    return NextResponse.json(
      { error: "Failed to get sandbox" },
      { status: 500 }
    );
  }
}

/* PUT /api/sandbox/[id] — update sandbox */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const store = await getSandboxStore();
    const sandbox = await store.update(id, body);

    if (!sandbox) {
      return NextResponse.json(
        { error: "Sandbox not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ sandbox });
  } catch (err) {
    console.error("Update sandbox error:", err);
    return NextResponse.json(
      { error: "Failed to update sandbox" },
      { status: 500 }
    );
  }
}

/* DELETE /api/sandbox/[id] — delete sandbox */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const store = await getSandboxStore();
    const deleted = await store.delete(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Sandbox not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete sandbox error:", err);
    return NextResponse.json(
      { error: "Failed to delete sandbox" },
      { status: 500 }
    );
  }
}
