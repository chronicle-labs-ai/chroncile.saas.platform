import crypto from "crypto";

const ALG = "sha256";
const EXPIRY_SECS = 48 * 60 * 60; 

function getSigningKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY is required for email action signing");
  if (key.length === 64) return Buffer.from(key, "hex");
  if (key.length === 44) return Buffer.from(key, "base64");
  throw new Error("ENCRYPTION_KEY must be 64 hex or 44 base64 chars");
}

export type EmailActionType = "view" | "claim" | "escalate";

export interface EmailActionPayload {
  action: EmailActionType;
  traceId: string;
  escalationId: string;
  toUserId: string;
  exp: number;
}

export function createActionToken(payload: Omit<EmailActionPayload, "exp">): string {
  const exp = Math.floor(Date.now() / 1000) + EXPIRY_SECS;
  const data: EmailActionPayload = { ...payload, exp };
  const payloadStr = JSON.stringify(data);
  const payloadB64 = Buffer.from(payloadStr, "utf8").toString("base64url");
  const key = getSigningKey();
  const sig = crypto.createHmac(ALG, key).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyActionToken(token: string): EmailActionPayload | null {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return null;
    const key = getSigningKey();
    const expectedSig = crypto.createHmac(ALG, key).update(payloadB64).digest("base64url");
    if (sig !== expectedSig) return null;
    const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf8");
    const data = JSON.parse(payloadStr) as EmailActionPayload;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    if (!data.action || !data.traceId || !data.escalationId || !data.toUserId) return null;
    return data;
  } catch {
    return null;
  }
}
