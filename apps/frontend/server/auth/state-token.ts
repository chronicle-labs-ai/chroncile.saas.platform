import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const STATE_MAX_AGE_SECONDS = 10 * 60;

export interface OAuthStatePayload {
  nonce: string;
  iat: number;
  from?: string;
  invitationToken?: string;
}

function getStateSecret(): string {
  const secret = process.env.WORKOS_COOKIE_PASSWORD;
  if (!secret || secret.length < 32) {
    throw new Error(
      "WORKOS_COOKIE_PASSWORD must be set and at least 32 characters long.",
    );
  }
  return secret;
}

function sign(payloadB64: string): string {
  return createHmac("sha256", getStateSecret())
    .update(payloadB64)
    .digest("base64url");
}

export function createOAuthState(
  from?: string | null,
  invitationToken?: string | null,
): string {
  const safeFrom =
    typeof from === "string" && from.startsWith("/") && !from.startsWith("//")
      ? from
      : undefined;

  const safeInvitationToken =
    typeof invitationToken === "string" && invitationToken.length > 0
      ? invitationToken
      : undefined;

  const payload: OAuthStatePayload = {
    nonce: randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    from: safeFrom,
    invitationToken: safeInvitationToken,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function verifyOAuthState(state: string): OAuthStatePayload | null {
  const [payloadB64, signature] = state.split(".");
  if (!payloadB64 || !signature) return null;

  const expected = sign(payloadB64);

  let signatureBuf: Buffer;
  let expectedBuf: Buffer;
  try {
    signatureBuf = Buffer.from(signature, "base64url");
    expectedBuf = Buffer.from(expected, "base64url");
  } catch {
    return null;
  }

  if (
    signatureBuf.length !== expectedBuf.length ||
    !timingSafeEqual(signatureBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as OAuthStatePayload;
    if (typeof payload.nonce !== "string") return null;
    if (typeof payload.iat !== "number" || !Number.isFinite(payload.iat)) {
      return null;
    }
    if (payload.from !== undefined && typeof payload.from !== "string") {
      return null;
    }
    if (
      payload.invitationToken !== undefined &&
      typeof payload.invitationToken !== "string"
    ) {
      return null;
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.iat - nowSeconds > 30) {
      return null;
    }
    if (nowSeconds - payload.iat > STATE_MAX_AGE_SECONDS) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
