import { NextResponse, type NextRequest } from "next/server";

import {
  classifyAuthError,
  isWeakPasswordError,
} from "@/server/auth/auth-errors";
import { assertWorkOSEnvironment, workos } from "@/server/auth/workos";

export const dynamic = "force-dynamic";

interface ConfirmBody {
  token?: unknown;
  newPassword?: unknown;
}

export async function POST(request: NextRequest) {
  assertWorkOSEnvironment();

  const body = (await request.json().catch(() => null)) as ConfirmBody | null;
  const token =
    typeof body?.token === "string" ? body.token.trim() : "";
  const newPassword =
    typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!token) {
    return NextResponse.json(
      { error: "missing_token" },
      { status: 400 },
    );
  }
  if (!newPassword) {
    return NextResponse.json(
      { error: "missing_password" },
      { status: 400 },
    );
  }

  try {
    await workos.userManagement.resetPassword({ token, newPassword });
  } catch (error) {
    if (isWeakPasswordError(error)) {
      const classified = classifyAuthError(error);
      return NextResponse.json(
        { error: "weak_password", message: classified.message },
        { status: 422 },
      );
    }

    const classified = classifyAuthError(error);
    console.warn(
      "[auth/password-reset/confirm] resetPassword failed:",
      classified.code,
      classified.message,
    );

    // Common token failures.
    if (
      classified.code === "password_reset_token_expired" ||
      /expired/i.test(classified.message)
    ) {
      return NextResponse.json(
        { error: "token_expired", message: classified.message },
        { status: 400 },
      );
    }
    if (
      classified.code === "password_reset_token_invalid" ||
      classified.code === "invalid_token" ||
      /token/i.test(classified.message)
    ) {
      return NextResponse.json(
        { error: "invalid_token", message: classified.message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: classified.code || "reset_failed" },
      { status: 400 },
    );
  }

  // Success. The user must now log in with the new password.
  // (WorkOS already revoked all of their previous sessions.)
  return NextResponse.json({ ok: true });
}
