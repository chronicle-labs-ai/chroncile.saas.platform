import { NextResponse, type NextRequest } from "next/server";

import { assertWorkOSEnvironment, workos } from "@/server/auth/workos";

export const dynamic = "force-dynamic";

interface ResendBody {
  userId?: unknown;
}

export async function POST(request: NextRequest) {
  assertWorkOSEnvironment();

  const body = (await request.json().catch(() => null)) as ResendBody | null;
  const userId =
    typeof body?.userId === "string" ? body.userId.trim() : "";

  if (!userId || !userId.startsWith("user_")) {
    return NextResponse.json(
      { error: "invalid_user_id" },
      { status: 400 },
    );
  }

  try {
    await workos.userManagement.sendVerificationEmail({ userId });
  } catch (error) {
    console.warn(
      "[auth/signup/resend] sendVerificationEmail failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "resend_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
