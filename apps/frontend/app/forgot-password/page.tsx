"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, ForgotPassword } from "ui/auth";

function ForgotPasswordPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialEmail = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (submittedEmail: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/password-reset/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: submittedEmail }),
      });

      if (!response.ok) {
        setError("We couldn't process the request. Try again.");
        return;
      }

      setSent(true);
    } catch {
      setError("Network error — try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell topbar={{}} align="center">
      <ForgotPassword
        value={email}
        onChange={setEmail}
        onSubmit={handleSubmit}
        onBack={() => router.push("/login")}
        sent={sent}
        error={error}
        isSubmitting={isSubmitting}
      />
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordPageInner />
    </Suspense>
  );
}
