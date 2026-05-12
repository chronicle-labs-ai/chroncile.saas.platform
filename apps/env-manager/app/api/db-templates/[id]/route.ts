import { NextResponse } from "next/server";
import { prisma } from "@/backend/data/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const template = await prisma.dbTemplate.findUnique({ where: { id } });
  if (!template)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(template);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const template = await prisma.dbTemplate.findUnique({ where: { id } });
  if (!template)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.dbTemplate.delete({ where: { id } });
  return NextResponse.json({ status: "deleted" });
}
