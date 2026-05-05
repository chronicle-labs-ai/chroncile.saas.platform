import { NextResponse, type NextRequest } from "next/server";

/*
 * Pure parsers and shared utilities for the signup route. Split out so
 * the route handler can read top-to-bottom as a pipeline:
 *
 *   parseSignupBody → acquireUserId → signupAuthenticate → respond.
 *
 * Anything WorkOS-aware lives in `signup-flow.ts`.
 */

export interface ParsedSignupBody {
  email: string;
  password: string;
  firstName: string | null;
  lastName: string | null;
  invitationToken?: string;
}

export type ParseSignupOutcome =
  | { kind: "ok"; body: ParsedSignupBody }
  | { kind: "response"; response: NextResponse };

interface RawSignupBody {
  email?: unknown;
  password?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  invitationToken?: unknown;
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function parseSignupBody(
  request: NextRequest,
): Promise<ParseSignupOutcome> {
  const raw = (await request.json().catch(() => null)) as RawSignupBody | null;
  const email = trimOrNull(raw?.email);
  const password = typeof raw?.password === "string" ? raw.password : "";
  const firstName = trimOrNull(raw?.firstName);
  const lastName = trimOrNull(raw?.lastName);
  const invitationToken =
    typeof raw?.invitationToken === "string" && raw.invitationToken.length > 0
      ? raw.invitationToken
      : undefined;

  if (!email || !password) {
    return {
      kind: "response",
      response: NextResponse.json(
        { error: "missing_credentials" },
        { status: 400 },
      ),
    };
  }

  return {
    kind: "ok",
    body: { email, password, firstName, lastName, invitationToken },
  };
}

/**
 * WorkOS often nests the actual cause inside `errors[]`. Dump that
 * array explicitly so it's not truncated to "[Array]" in the dev
 * console — saves real debugging time when WorkOS rejects a payload.
 */
export function logSdkError(
  context: string,
  message: string,
  error: unknown,
): void {
  const detail =
    error && typeof error === "object" && "errors" in error
      ? (error as { errors: unknown }).errors
      : undefined;
  console.error(
    `[${context}] ${message}:`,
    error,
    "errors:",
    JSON.stringify(detail, null, 2),
  );
}
