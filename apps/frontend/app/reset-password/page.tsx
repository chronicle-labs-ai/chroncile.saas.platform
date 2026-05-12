"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AuthShell,
  ResetPassword,
  type ResetPasswordValue,
} from "ui/auth";

function humanizeResetError(code: string | undefined): string {
  if (!code) return "We couldn't update your password. Try again.";
  const map: Record<string, string> = {
    invalid_token:
      "This reset link is invalid. Request a new one from the sign-in page.",
    token_expired:
      "This reset link has expired. Request a new one from the sign-in page.",
    weak_password:
      "That password doesn't meet the strength policy. Try a longer one with mixed characters.",
    missing_token: "Reset link missing token. Request a new one.",
    missing_password: "Enter a new password.",
  };
  return map[code] ?? code.replaceAll("_", " ");
}

function ResetPasswordPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token") ?? "";

  const [value, setValue] = useState<ResetPasswordValue>({
    password: "",
    confirmPassword: "",
  });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(
    token ? null : "This reset link is missing its token. Request a new one.",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (newPassword: string) => {
    if (!token) {
      setError("This reset link is missing its token. Request a new one.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !data?.ok) {
        setError(humanizeResetError(data?.error));
        return;
      }

      setDone(true);
      setValue({ password: "", confirmPassword: "" });
    } catch {
      setError("Network error — try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell topbar={{}} align="center">
      <ResetPassword
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        onContinue={() => router.push("/login")}
        done={done}
        error={error}
        isSubmitting={isSubmitting}
      />
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPageInner />
    </Suspense>
  );
}
