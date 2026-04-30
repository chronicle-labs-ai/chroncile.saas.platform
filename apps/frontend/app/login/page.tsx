"use client";

import { Suspense, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, SignIn, type SignInValue } from "ui/auth";

function oauthPath(provider: "google" | "github", from: string): string {
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

type LoginResponse =
  | LoginOkResponse
  | LoginNeedsVerifyResponse
  | LoginNeedsSsoResponse
  | LoginAuthMethodsRequiredResponse
  | LoginErrorResponse;

function humanizeError(code: string | undefined): string {
  if (!code) return "We couldn't sign you in. Try again.";
  const map: Record<string, string> = {
    invalid_credentials: "Email or password is incorrect.",
    missing_credentials: "Enter your email and password.",
    sealing_failed: "Couldn't establish your session. Try again.",
    mfa_enrollment: "MFA is not yet supported in this app.",
    mfa_challenge: "MFA is not yet supported in this app.",
    organization_selection_required:
      "Multi-organization sign-in is not yet supported.",
    rate_limit_exceeded: "Too many attempts. Wait a moment and try again.",
  };
  return map[code] ?? code.replaceAll("_", " ");
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

async function identifyAccount(email: string): Promise<IdentifyResponse> {
  try {
    const response = await fetch("/api/auth/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await response.json().catch(() => null)) as IdentifyResponse | null;
    return data ?? EMPTY_IDENTIFY;
  } catch {
    return EMPTY_IDENTIFY;
  }
}

function explainAuthFailure(
  providers: string[],
  hasPassword: boolean,
  onSetPassword: () => void,
): ReactNode | null {
  if (providers.length === 0 && !hasPassword) {
    return null;
  }
  const labels = providers.map(providerLabel);
  const providersText =
    labels.length === 0
      ? null
      : labels.length === 1
        ? labels[0]
        : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;

  if (hasPassword) {
    return providersText ? (
      <>Email or password is incorrect. You can also sign in with {providersText}.</>
    ) : (
      <>Email or password is incorrect.</>
    );
  }

  return (
    <>
      This account is registered with {providersText}. Continue with{" "}
      {labels.length === 1 ? labels[0] : "one of those"}, or{" "}
      <button
        type="button"
        onClick={onSetPassword}
        className="font-medium underline underline-offset-2 hover:text-ink-hi transition-colors"
      >
        click here
      </button>{" "}
      to set a password.
    </>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/dashboard";
  const queryError = searchParams.get("error");

  const [error, setError] = useState<ReactNode | null>(
    queryError ? humanizeError(queryError) : null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startOAuth = (provider: "google" | "github") => {
    window.location.assign(oauthPath(provider, from));
  };

  const handleSubmit = async (value: SignInValue) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-from": from,
        },
        body: JSON.stringify({ email: value.email, password: value.password }),
      });

      const data = (await response.json().catch(() => null)) as LoginResponse | null;

      if (response.ok && data && "ok" in data && data.ok === true) {
        router.push(data.redirect ?? "/dashboard");
        return;
      }

      if (data && "ok" in data && data.ok === false) {
        if (data.code === "email_verification_required") {
          const params = new URLSearchParams({ step: "verify" });
          if (data.email) params.set("email", data.email);
          if (data.pendingAuthenticationToken) {
            params.set("token", data.pendingAuthenticationToken);
          }
          router.push(`/signup?${params.toString()}`);
          return;
        }
        if (data.code === "sso_required") {
          const params = new URLSearchParams({ from });
          window.location.assign(`/api/auth/oauth/google?${params.toString()}`);
          return;
        }
        if (data.code === "organization_authentication_methods_required") {
          const allowed = Object.entries(data.authMethods ?? {})
            .filter(([, ok]) => ok)
            .map(([k]) => k);
          setError(
            allowed.length > 0
              ? `Your admin only allows: ${allowed.join(", ")}.`
              : "Your admin restricts the sign-in methods for this email.",
          );
          return;
        }
      }

      const code = (data as LoginErrorResponse | null)?.error;

      if (code === "invalid_credentials" && value.email) {
        const identify = await identifyAccount(value.email);
        if (identify.exists) {
          const message = explainAuthFailure(
            identify.providers,
            identify.hasPassword,
            () => router.push("/forgot-password"),
          );
          if (message) {
            setError(message);
            return;
          }
        }
      }

      setError(humanizeError(code));
    } catch (err) {
      setError(
        err instanceof Error
          ? "Network error — try again."
          : "Something went wrong. Try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell topbar={{}} align="center" chromeStyle="product">
      <SignIn
        onSubmit={handleSubmit}
        onForgot={() => router.push("/forgot-password")}
        onSignUp={() => router.push("/signup")}
        onSSO={(provider) => {
          if (provider === "google" || provider === "github") {
            startOAuth(provider);
            return;
          }
          setError(
            provider === "passkey"
              ? "Passkey sign-in isn't enabled yet."
              : "That sign-in method isn't enabled.",
          );
        }}
        error={error}
        isSubmitting={isSubmitting}
        lede="Log in to Chronicle"
      />
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
