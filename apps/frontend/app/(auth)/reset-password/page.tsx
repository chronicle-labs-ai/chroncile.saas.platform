"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, createPlatformApi } from "platform-api";
import { FormField, Input } from "ui";
import { AydeaIcon } from "@/components/icons/AydeaIcon";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations";

const INVALID_LINK_MESSAGE = "This password reset link is invalid or has expired.";

function ResetPasswordForm() {
  const api = useMemo(() => createPlatformApi(() => null), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    form.clearErrors("root");

    if (!token) {
      form.setError("root", { message: INVALID_LINK_MESSAGE });
      return;
    }

    try {
      await api.resetPassword({
        token,
        newPassword: values.password,
      });
      router.push("/login?reset=true");
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof ApiError ? error.message : "Connection error",
      });
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
          Reset password
        </h1>
        <p className="text-sm text-[hsl(0,0%,45%)]">
          Choose a new password for your account
        </p>
      </div>

      {!token && (
        <p className="text-sm text-[#ff3b3b]">{INVALID_LINK_MESSAGE}</p>
      )}
      {form.formState.errors.root?.message && (
        <p className="text-sm text-[#ff3b3b]">{form.formState.errors.root.message}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <FormField
            tone="auth"
            label="New password"
            htmlFor="password"
            description={
              !form.formState.errors.password?.message
                ? "8+ chars, mixed case, number"
                : undefined
            }
            error={form.formState.errors.password?.message}
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              density="brand"
              variant="auth"
              invalid={!!form.formState.errors.password}
              {...form.register("password")}
            />
          </FormField>

          <FormField
            tone="auth"
            label="Confirm password"
            htmlFor="confirmPassword"
            error={form.formState.errors.confirmPassword?.message}
          >
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              density="brand"
              variant="auth"
              invalid={!!form.formState.errors.confirmPassword}
              {...form.register("confirmPassword")}
            />
          </FormField>
        </div>

        <button
          type="submit"
          disabled={form.formState.isSubmitting || !token}
          className="w-full bg-[hsl(0,0%,8%)] text-white py-3.5 text-sm font-medium rounded-[0.75rem] hover:bg-[hsl(0,0%,12%)] focus:outline-none focus:ring-2 focus:ring-[hsl(0,0%,8%)] focus:ring-offset-2 transition-colors disabled:opacity-50 mt-2"
        >
          {form.formState.isSubmitting ? "..." : "Reset password"}
        </button>
      </form>

      <p className="text-sm text-[hsl(0,0%,45%)] mt-6 text-center">
        Back to{" "}
        <Link
          href="/login"
          className="text-[hsl(0,0%,8%)] font-medium underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-sm text-[hsl(0,0%,45%)]">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
