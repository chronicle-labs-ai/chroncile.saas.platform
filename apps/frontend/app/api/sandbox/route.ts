import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSandboxStore } from "@/lib/sandbox/repository";

export const dynamic = "force-dynamic";

/* GET /api/sandbox — list sandboxes for tenant */
export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const store = await getSandboxStore();
    const sandboxes = await store.list(session.user.tenantId);
    return NextResponse.json({ sandboxes });
  } catch (err) {
    console.error("List sandboxes error:", err);
    return NextResponse.json(
      { error: "Failed to list sandboxes" },
      { status: 500 }
    );
  }
}

/* POST /api/sandbox — create a new sandbox */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, description } = body as {
      name?: string;
      description?: string;
    };

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const store = await getSandboxStore();
    const sandbox = await store.create(session.user.tenantId, {
      name,
      description: description ?? "",
    });

    return NextResponse.json({ sandbox }, { status: 201 });
  } catch (err) {
    console.error("Create sandbox error:", err);
    return NextResponse.json(
      { error: "Failed to create sandbox" },
      { status: 500 }
    );
  }
}
