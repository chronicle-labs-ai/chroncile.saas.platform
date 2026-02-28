import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { destroyEnvironment } from "@/lib/lifecycle";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const env = await prisma.environment.findUnique({ where: { id } });
  if (!env) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(env);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const env = await prisma.environment.findUnique({ where: { id } });
  if (!env) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (env.type !== "EPHEMERAL") {
    return NextResponse.json(
      { error: "Only ephemeral environments can be destroyed" },
      { status: 400 }
    );
  }

  await prisma.environment.update({
    where: { id },
    data: { status: "DESTROYING" },
  });

  destroyEnvironment(id).catch((err) => {
    console.error(`Failed to destroy environment ${id}:`, err);
  });

  return NextResponse.json({ status: "destroying" });
}
