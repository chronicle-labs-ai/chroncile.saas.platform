import { NextResponse } from "next/server";
import { prisma } from "@/server/data/db";
import { ensurePermanentEnvsExist } from "@/server/environments/sync";
import { syncLocalEnvironment } from "@/server/environments/local-env";

export async function GET() {
  await Promise.all([ensurePermanentEnvsExist(), syncLocalEnvironment()]);

  const environments = await prisma.environment.findMany({
    orderBy: [{ type: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(environments);
}
