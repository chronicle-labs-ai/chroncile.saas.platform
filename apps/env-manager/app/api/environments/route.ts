import { NextResponse } from "next/server";
import { prisma } from "@/backend/data/db";
import { ensurePermanentEnvsExist } from "@/backend/environments/sync";
import { syncLocalEnvironment } from "@/backend/environments/local-env";

export async function GET() {
  await Promise.all([ensurePermanentEnvsExist(), syncLocalEnvironment()]);

  const environments = await prisma.environment.findMany({
    orderBy: [{ type: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(environments);
}
