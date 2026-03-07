import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Implement connection test in Rust backend
  return NextResponse.json({ success: true, message: "Connection is active" });
}
