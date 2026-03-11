import { NextResponse } from "next/server";

import { auth } from "@/server/auth/auth";
import { getSandboxStore } from "@/features/sandbox/server/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const store = await getSandboxStore();
    const sandboxes = await store.list(session.user.tenantId);
    return NextResponse.json({ sandboxes });
  } catch (error) {
    console.error("Failed to list sandboxes:", error);
    return NextResponse.json(
      { error: "Failed to list sandboxes" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      description?: string;
    };
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json(
        { error: "Sandbox name is required" },
        { status: 400 }
      );
    }

    const store = await getSandboxStore();
    const sandbox = await store.create(session.user.tenantId, {
      name,
      description: body.description?.trim() ?? "",
    });

    return NextResponse.json({ sandbox }, { status: 201 });
  } catch (error) {
    console.error("Failed to create sandbox:", error);
    return NextResponse.json(
      { error: "Failed to create sandbox" },
      { status: 500 }
    );
  }
}
