"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FormField, Input } from "ui";
import { AydeaIcon } from "@/components/icons/AydeaIcon";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { useTrack } from "@/shared/analytics";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const track = useTrack();
  const [authState, setAuthState] = useState<
    "idle" | "credentials" | "google" | "redirecting"
  >("idle");
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const registered = searchParams.get("registered");
  const reset = searchParams.get("reset");

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const isAuthPending = form.formState.isSubmitting || authState !== "idle";

  const handleSubmit = form.handleSubmit(async (values) => {
    form.clearErrors("root");
    setAuthState("credentials");

    try {
      track("auth_login_attempted", { method: "credentials" });

      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setAuthState("idle");
        form.setError("root", { message: "Invalid credentials" });
        return;
      }

      setAuthState("redirecting");
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setAuthState("idle");
      form.setError("root", { message: "Connection error" });
    }
  });

  return (
    <div className="space-y-8">
      <div className="lg:hidden flex items-center gap-3 mb-6">
        <AydeaIcon className="h-8 w-8 shrink-0 text-[hsl(0,0%,8%)]" />
        <span className="text-base font-medium text-[hsl(0,0%,8%)] tracking-tight">
          Chronicle Labs
        </span>
      </div>

      <div className="mb-2 text-center">
        <h1 className="text-2xl font-bold text-[hsl(0,0%,8%)] mb-1 tracking-tight">
          Sign in
        </h1>
        <p className="text-sm text-[hsl(0,0%,45%)]">Welcome back</p>
      </div>

      <button
        type="button"
        disabled={isAuthPending}
        onClick={() => {
          if (isAuthPending) return;

          setAuthState("google");
          form.clearErrors("root");
          track("auth_login_attempted", { method: "google" });
          void signIn("google", { callbackUrl: "/dashboard" }).catch(() => {
            setAuthState("idle");
            form.setError("root", { message: "Connection error" });
          });
        }}
        className="w-full flex items-center justify-center gap-3 bg-white border border-[hsl(0,0%,90%)] text-[hsl(0,0%,8%)] py-3.5 text-sm font-medium rounded-[0.75rem] hover:bg-[hsl(0,0%,97%)] focus:outline-none focus:ring-2 focus:ring-[hsl(0,0%,8%)] focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.28 5.4l3.56-2.77.01-.54z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {authState === "google" ? "..." : "Continue with Google"}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[hsl(0,0%,90%)]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-4 text-[hsl(0,0%,45%)]">or</span>
        </div>
      </div>

      {registered && (
        <p className="text-sm text-[#00ff88]">Account created successfully</p>
      )}
      {reset && (
        <p className="text-sm text-[#00ff88]">Password reset successfully</p>
      )}
      {form.formState.errors.root?.message && (
        <p className="text-sm text-[#ff3b3b]">
          {form.formState.errors.root.message}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <FormField
            tone="auth"
            label="Email"
            htmlFor="email"
            error={form.formState.errors.email?.message}
          >
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              density="brand"
              variant="auth"
              disabled={isAuthPending}
              invalid={!!form.formState.errors.email}
              {...form.register("email")}
            />
          </FormField>

          <FormField
            tone="auth"
            label="Password"
            htmlFor="password"
            error={form.formState.errors.password?.message}
          >
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              density="brand"
              variant="auth"
              disabled={isAuthPending}
              invalid={!!form.formState.errors.password}
              {...form.register("password")}
            />
          </FormField>

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm text-[hsl(0,0%,45%)] underline underline-offset-2 hover:text-[hsl(0,0%,8%)] transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={isAuthPending}
          className="w-full bg-[hsl(0,0%,8%)] text-white py-3.5 text-sm font-medium rounded-[0.75rem] hover:bg-[hsl(0,0%,12%)] focus:outline-none focus:ring-2 focus:ring-[hsl(0,0%,8%)] focus:ring-offset-2 transition-colors disabled:opacity-50 mt-2"
        >
          {authState === "credentials" || authState === "redirecting"
            ? "..."
            : "Continue"}
        </button>
      </form>

      <p className="text-sm text-[hsl(0,0%,45%)] mt-6 text-center">
        No account?{" "}
        <Link
          href="/signup"
          className="text-[hsl(0,0%,8%)] font-medium underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="text-sm text-[hsl(0,0%,45%)]">Loading...</div>}
    >
      <LoginForm />
    </Suspense>
  );
}
