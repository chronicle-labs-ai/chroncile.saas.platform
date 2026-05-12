"use client";

import { Suspense, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, SignIn, type SignInValue } from "ui/auth";

import {
  explainAuthFailure,
  humanizeError,
  identifyAccount,
  oauthPath,
  type LoginResponse,
} from "./login-helpers";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/dashboard";
  const queryError = searchParams.get("error");
  const invitationTokenFromQuery =
    searchParams.get("invitation_token") ?? undefined;

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
        body: JSON.stringify({
          email: value.email,
          password: value.password,
          ...(invitationTokenFromQuery
            ? { invitationToken: invitationTokenFromQuery }
            : {}),
        }),
      });

      const data = (await response
        .json()
        .catch(() => null)) as LoginResponse | null;

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

      const code = (data as { error?: string } | null)?.error;

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
    <AuthShell topbar={{}} align="center">
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
