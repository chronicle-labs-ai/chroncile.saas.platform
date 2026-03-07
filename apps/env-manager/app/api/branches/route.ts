import { NextResponse } from "next/server";
import { listBranches } from "@/server/integrations/github-client";

export async function GET() {
  const branches = await listBranches();
  return NextResponse.json(branches);
}
