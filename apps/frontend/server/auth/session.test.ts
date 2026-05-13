import { beforeEach, describe, expect, it, vi } from "vitest";

import { _resetCookieStore, _setCookie } from "../../vitest.setup";

const { authenticateMock, loadSealedSessionMock } = vi.hoisted(() => {
  const authenticate = vi.fn();
  return {
    authenticateMock: authenticate,
    loadSealedSessionMock: vi.fn(() => ({ authenticate })),
  };
});

vi.mock("@workos-inc/node", () => ({
  WorkOS: vi.fn().mockImplementation(() => ({
    userManagement: {
      loadSealedSession: loadSealedSessionMock,
    },
  })),
}));

import { SESSION_COOKIE_NAME, getSession } from "./session";

beforeEach(() => {
  _resetCookieStore();
  authenticateMock.mockReset();
  loadSealedSessionMock.mockClear();
});

describe("getSession", () => {
  it("returns no_cookie when the session cookie is missing", async () => {
    const result = await getSession();
    expect(result).toEqual({ authenticated: false, reason: "no_cookie" });
    expect(loadSealedSessionMock).not.toHaveBeenCalled();
  });

  it("returns the authenticated payload from WorkOS when valid", async () => {
    _setCookie(SESSION_COOKIE_NAME, "sealed-cookie-blob");
    authenticateMock.mockResolvedValue({
      authenticated: true,
      accessToken: "at_123",
      sessionId: "sess_123",
      user: { id: "user_123", email: "ernesto@chronicle-labs.com" },
    });

    const result = await getSession();

    expect(loadSealedSessionMock).toHaveBeenCalledWith({
      sessionData: "sealed-cookie-blob",
      cookiePassword: expect.any(String),
    });
    expect(result).toMatchObject({
      authenticated: true,
      accessToken: "at_123",
      sessionId: "sess_123",
    });
  });

  it("classifies network errors as auth_provider_unreachable", async () => {
    _setCookie(SESSION_COOKIE_NAME, "sealed-cookie-blob");
    const err = Object.assign(new Error("getaddrinfo ENOTFOUND"), {
      code: "ENOTFOUND",
    });
    authenticateMock.mockRejectedValue(err);

    const result = await getSession();

    expect(result).toEqual({
      authenticated: false,
      reason: "auth_provider_unreachable",
    });
  });

  it("classifies other authenticate() throws as authenticate_failed", async () => {
    _setCookie(SESSION_COOKIE_NAME, "sealed-cookie-blob");
    authenticateMock.mockRejectedValue(new Error("invalid jwt"));

    const result = await getSession();

    expect(result).toEqual({
      authenticated: false,
      reason: "authenticate_failed",
    });
  });

  it("treats a corrupt sealed cookie as invalid_session_cookie", async () => {
    _setCookie(SESSION_COOKIE_NAME, "garbage");
    loadSealedSessionMock.mockImplementationOnce(() => {
      throw new Error("could not unseal");
    });

    const result = await getSession();

    expect(result).toEqual({
      authenticated: false,
      reason: "invalid_session_cookie",
    });
  });
});
