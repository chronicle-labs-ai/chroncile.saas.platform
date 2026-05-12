import { NextResponse, type NextRequest } from "next/server";

import { assertWorkOSEnvironment, workos } from "@/server/auth/workos";

export const dynamic = "force-dynamic";

interface StartBody {
  email?: unknown;
}

export async function POST(request: NextRequest) {
  assertWorkOSEnvironment();

  const body = (await request.json().catch(() => null)) as StartBody | null;
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: true });
  }

  try {
    await workos.userManagement.createPasswordReset({ email });
  } catch (error) {
     console.warn(
      "[auth/password-reset/start] createPasswordReset failed:",
      error instanceof Error ? error.message : error,
    );
  }

  return NextResponse.json({ ok: true });
}
