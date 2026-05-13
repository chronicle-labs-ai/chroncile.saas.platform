import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createOAuthState, verifyOAuthState } from "./state-token";

describe("createOAuthState / verifyOAuthState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-12T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips a payload with no extras", () => {
    const token = createOAuthState(null, null);
    const payload = verifyOAuthState(token);
    expect(payload).not.toBeNull();
    expect(payload?.nonce).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload?.from).toBeUndefined();
    expect(payload?.invitationToken).toBeUndefined();
  });

  it("preserves `from` when it's a safe relative path", () => {
    const token = createOAuthState("/dashboard/agents", null);
    expect(verifyOAuthState(token)?.from).toBe("/dashboard/agents");
  });

  it("drops `from` when it tries to do an open redirect", () => {
    const token = createOAuthState("//evil.com/steal", null);
    expect(verifyOAuthState(token)?.from).toBeUndefined();
  });

  it("drops `from` when it's not a relative path", () => {
    const token = createOAuthState("https://evil.com/x", null);
    expect(verifyOAuthState(token)?.from).toBeUndefined();
  });

  it("preserves invitationToken when non-empty", () => {
    const token = createOAuthState(null, "inv_abc123");
    expect(verifyOAuthState(token)?.invitationToken).toBe("inv_abc123");
  });

  it("drops empty invitationToken", () => {
    const token = createOAuthState(null, "");
    expect(verifyOAuthState(token)?.invitationToken).toBeUndefined();
  });

  it("rejects a token with a tampered payload", () => {
    const token = createOAuthState("/dashboard", null);
    const [, sig] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ nonce: "x", iat: Math.floor(Date.now() / 1000) }),
    ).toString("base64url");
    expect(verifyOAuthState(`${tamperedPayload}.${sig}`)).toBeNull();
  });

  it("rejects a token with a forged signature", () => {
    const token = createOAuthState("/dashboard", null);
    const [payload] = token.split(".");
    expect(verifyOAuthState(`${payload}.AAAA`)).toBeNull();
  });

  it("rejects a malformed token (missing separator)", () => {
    expect(verifyOAuthState("not-a-token")).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createOAuthState(null, null);
    vi.advanceTimersByTime((600 + 1) * 1000);
    expect(verifyOAuthState(token)).toBeNull();
  });

  it("rejects a token from too far in the future (clock skew guard)", () => {
    const token = createOAuthState(null, null);
    vi.setSystemTime(new Date("2026-05-12T11:59:00Z"));
    expect(verifyOAuthState(token)).toBeNull();
  });
});
