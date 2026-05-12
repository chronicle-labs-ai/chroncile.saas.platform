import type { ReactNode } from "react";
import { TextLink } from "ui";

import { humanizeBackendError } from "@/server/auth/humanize-backend-error";

/*
 * Helpers for the Login page. Kept colocated so the page reads as
 * "wire form events to network calls" without 100 lines of types and
 * response shaping in the way.
 */

export function oauthPath(
  provider: "google" | "github",
  from: string,
): string {
  const params = new URLSearchParams({ from });
  return `/api/auth/oauth/${provider}?${params.toString()}`;
}

interface LoginErrorResponse {
  error?: string;
  message?: string;
}

interface LoginOkResponse {
  ok: true;
  redirect: string;
}

interface LoginNeedsVerifyResponse {
  ok: false;
  code: "email_verification_required";
  pendingAuthenticationToken?: string;
  email?: string;
}

interface LoginNeedsSsoResponse {
  ok: false;
  code: "sso_required";
  connectionIds?: string[];
  email?: string;
}

interface LoginAuthMethodsRequiredResponse {
  ok: false;
  code: "organization_authentication_methods_required";
  authMethods?: Record<string, boolean>;
  connectionIds?: string[];
}

export type LoginResponse =
  | LoginOkResponse
  | LoginNeedsVerifyResponse
  | LoginNeedsSsoResponse
  | LoginAuthMethodsRequiredResponse
  | LoginErrorResponse;

/**
 * Login-specific error humanizer. Delegates to the shared
 * `humanizeBackendError` dictionary so we don't duplicate copy across
 * pages, and so unknown codes never leak as raw text.
 */
export function humanizeError(code: string | undefined): string {
  if (!code) return "We couldn't sign you in. Try again.";
  return humanizeBackendError(code).message;
}

const PROVIDER_LABEL: Record<string, string> = {
  GoogleOAuth: "Google",
  GitHubOAuth: "GitHub",
  AppleOAuth: "Apple",
  MicrosoftOAuth: "Microsoft",
};

function providerLabel(provider: string): string {
  return PROVIDER_LABEL[provider] ?? provider;
}

interface IdentifyResponse {
  exists: boolean;
  providers: string[];
  hasPassword: boolean;
}

const EMPTY_IDENTIFY: IdentifyResponse = {
  exists: false,
  providers: [],
  hasPassword: false,
};

export async function identifyAccount(email: string): Promise<IdentifyResponse> {
  try {
    const response = await fetch("/api/auth/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await response.json().catch(() => null)) as
      | IdentifyResponse
      | null;
    return data ?? EMPTY_IDENTIFY;
  } catch {
    return EMPTY_IDENTIFY;
  }
}

function joinProviderLabels(labels: string[]): string | null {
  if (labels.length === 0) return null;
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * Build the contextual error message shown after `invalid_credentials`,
 * once we've identified the account. Returns `null` when the account
 * has no signal to explain (e.g. brand new email).
 */
export function explainAuthFailure(
  providers: string[],
  hasPassword: boolean,
  onSetPassword: () => void,
): ReactNode | null {
  if (providers.length === 0 && !hasPassword) return null;

  const providersText = joinProviderLabels(providers.map(providerLabel));

  if (hasPassword) {
    return providersText ? (
      <>
        Email or password is incorrect. You can also sign in with{" "}
        {providersText}.
      </>
    ) : (
      <>Email or password is incorrect.</>
    );
  }

  return (
    <>
      This account is registered with {providersText}. Continue with{" "}
      {providers.length === 1 ? providersText : "one of those"}, or{" "}
      <TextLink onClick={onSetPassword}>click here</TextLink> to set a password.
    </>
  );
}
