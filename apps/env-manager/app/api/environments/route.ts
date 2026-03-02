import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensurePermanentEnvsExist } from "@/lib/sync";
import { syncLocalEnvironment } from "@/lib/local-env";

export async function GET() {
  await Promise.all([
    ensurePermanentEnvsExist(),
    syncLocalEnvironment(),
  ]);

  const environments = await prisma.environment.findMany({
    orderBy: [
      { type: "asc" },
      { createdAt: "desc" },
    ],
  });
  return NextResponse.json(environments);
}
