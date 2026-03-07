import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Implement process-pending in Rust backend
  // For now, return a stub response
  return NextResponse.json({ processed: 0, message: "No pending runs" });
}
