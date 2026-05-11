import { NextResponse } from "next/server";
import { prisma } from "@/backend/data/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const existing = await prisma.emailTemplateAssignment.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.emailTemplateAssignment.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
