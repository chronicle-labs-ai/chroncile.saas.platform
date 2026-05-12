import { NextResponse } from "next/server";
import { listBranches } from "@/backend/integrations/github-client";

export async function GET() {
  const branches = await listBranches();
  return NextResponse.json(branches);
}
