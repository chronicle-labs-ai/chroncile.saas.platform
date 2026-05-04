"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AuthShell,
  SignUpEmail,
  SignUpPassword,
  SignUpVerify,
  type SignUpEmailValue,
  type SignUpPasswordValue,
} from "ui/auth";

type Step = "email" | "password" | "verify";

interface SignupOkVerifyResponse {
  ok: true;
  requiresVerify: true;
  userId: string;
  email: string;
  pendingAuthenticationToken: string;
}

interface SignupOkSkipResponse {
  ok: true;
  skipVerify: true;
  userId: string;
  redirect: string;
}

interface SignupErrResponse {
  error: string;
  message?: string;
  email?: string;
}

type SignupResponse =
  | SignupOkVerifyResponse
  | SignupOkSkipResponse
  | SignupErrResponse;

interface VerifyOkResponse {
  ok: true;
  redirect: string;
}

interface VerifyErrResponse {
  error: string;
  message?: string;
}

function oauthPath(provider: "google" | "github"): string {
  const params = new URLSearchParams({ from: "/dashboard" });
  return `/api/auth/oauth/${provider}?${params.toString()}`;
}

function humanizeSignupError(code: string | undefined): string {
  if (!code) return "Something went wrong. Try again.";
  const map: Record<string, string> = {
    email_already_exists:
      "That email is already registered. Sign in instead.",
    weak_password:
      "That password doesn't meet the strength policy. Try a longer one with mixed characters.",
    missing_credentials: "Enter both your email and password.",
    user_creation_failed: "We couldn't create your account. Try again.",
    sealing_failed: "Couldn't establish your session. Try again.",
  };
  return map[code] ?? code.replaceAll("_", " ");
}

function humanizeVerifyError(code: string | undefined): string {
  if (!code) return "Verification failed. Try again.";
  const map: Record<string, string> = {
    invalid_code: "That code didn't match. Check your email and retry.",
    invalid_code_format: "Enter the 6-digit code from your email.",
    token_invalid:
      "Your verification window expired. Start signup again to get a fresh code.",
    missing_pending_token: "Verification token missing. Start signup again.",
  };
  return map[code] ?? code.replaceAll("_", " ");
}

function SignupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialStep =
    searchParams.get("step") === "verify" ? "verify" : "email";
  const initialEmail = searchParams.get("email") ?? "";
  const initialToken = searchParams.get("token") ?? "";
  const invitationTokenFromQuery =
    searchParams.get("invitation_token") ?? undefined;

  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingAuthenticationToken, setPendingAuthenticationToken] =
    useState<string>(initialToken);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (step === "verify" && !pendingAuthenticationToken) {
      setStep("email");
    }
  }, [step, pendingAuthenticationToken]);

  const startOAuth = (provider: "google" | "github") => {
    window.location.assign(oauthPath(provider));
  };

  const handleEmailSubmit = (value: SignUpEmailValue) => {
    setError(null);
    setEmail(value.email);
    setStep("password");
  };

  const handlePasswordSubmit = async (value: SignUpPasswordValue) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: value.email,
          password: value.password,
          firstName: value.firstName ?? null,
          ...(invitationTokenFromQuery
            ? { invitationToken: invitationTokenFromQuery }
            : {}),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | SignupResponse
        | null;

      if (!response.ok || !data || !("ok" in data) || data.ok !== true) {
        const errCode = (data as SignupErrResponse | null)?.error;
        if (errCode === "email_already_exists") {
          setError(humanizeSignupError(errCode));
          setStep("email");
          return;
        }
        setError(humanizeSignupError(errCode));
        return;
      }

      if ("skipVerify" in data && data.skipVerify) {
        router.push(data.redirect ?? "/onboarding/workspace");
        return;
      }

      if ("requiresVerify" in data && data.requiresVerify) {
        setUserId(data.userId);
        setEmail(data.email);
        setPendingAuthenticationToken(data.pendingAuthenticationToken);
        setPassword("");
        setStep("verify");
        return;
      }

      setError("Unexpected response from server.");
    } catch {
      setError("Network error — try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifySubmit = async (code: string) => {
    if (!pendingAuthenticationToken) {
      setError("Verification token missing. Start signup again.");
      setStep("email");
      return;
    }
    setError(null);
    setIsVerifying(true);
    try {
      const response = await fetch("/api/auth/signup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingAuthenticationToken, code }),
      });
      const data = (await response.json().catch(() => null)) as
        | VerifyOkResponse
        | VerifyErrResponse
        | null;

      if (!response.ok || !data || !("ok" in data) || data.ok !== true) {
        const errCode = (data as VerifyErrResponse | null)?.error;
        if (errCode === "token_invalid") {
          setError(humanizeVerifyError(errCode));
          setPendingAuthenticationToken("");
          setStep("email");
          return;
        }
        setError(humanizeVerifyError(errCode));
        return;
      }

      router.push(data.redirect ?? "/onboarding/workspace");
    } catch {
      setError("Network error — try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!userId) {
      setError("Can't resend — start signup again.");
      return;
    }
    setError(null);
    try {
      const response = await fetch("/api/auth/signup/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        setError("Couldn't resend. Try again in a moment.");
      }
    } catch {
      setError("Network error — try again.");
    }
  };

  let body: ReactNode;
  switch (step) {
    case "email":
      body = (
        <SignUpEmail
          persona="signup"
          defaultValue={{ email }}
          onSubmit={handleEmailSubmit}
          onSignIn={() => router.push("/login")}
          onSSO={(provider) => {
            if (provider === "google" || provider === "github") {
              startOAuth(provider);
              return;
            }
            setError("That sign-up method isn't enabled.");
          }}
          error={error}
        />
      );
      break;
    case "password":
      body = (
        <SignUpPassword
          value={{ email, password, firstName }}
          onChange={(next) => {
            setEmail(next.email);
            setPassword(next.password);
            setFirstName(next.firstName ?? "");
          }}
          onSubmit={handlePasswordSubmit}
          onBack={() => {
            setError(null);
            setStep("email");
          }}
          error={error}
          isSubmitting={isSubmitting}
        />
      );
      break;
    case "verify":
      body = (
        <SignUpVerify
          email={email}
          onVerify={handleVerifySubmit}
          onResend={handleResend}
          onBack={() => {
            setError(null);
            setStep("password");
          }}
          error={error}
          isVerifying={isVerifying}
        />
      );
      break;
  }

  return (
    <AuthShell
      topbar={{
        cta: (
          <button type="button" onClick={() => router.push("/login")}>
            Sign in
          </button>
        ),
      }}
      align="center"
    >
      {body}
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}
