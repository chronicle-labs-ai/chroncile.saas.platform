import { NextResponse } from "next/server";
import { listBranches } from "@/lib/github-client";

export async function GET() {
  const branches = await listBranches();
  return NextResponse.json(branches);
}
