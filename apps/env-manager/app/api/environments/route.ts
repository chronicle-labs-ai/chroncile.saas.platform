import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensurePermanentEnvsExist } from "@/lib/sync";

export async function GET() {
  await ensurePermanentEnvsExist();

  const environments = await prisma.environment.findMany({
    orderBy: [
      { type: "asc" },
      { createdAt: "desc" },
    ],
  });
  return NextResponse.json(environments);
}
