"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError, createPlatformApi } from "platform-api";
import { FormField, Input } from "ui";
import { AydeaIcon } from "@/components/icons/AydeaIcon";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validations";

export default function ForgotPasswordPage() {
  const api = useMemo(() => createPlatformApi(() => null), []);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    form.clearErrors("root");
    setSuccessMessage(null);

    try {
      const response = await api.forgotPassword({
        email: values.email,
      });
      setSuccessMessage(response.message);
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
          Forgot password
        </h1>
        <p className="text-sm text-[hsl(0,0%,45%)]">
          Enter your account email to receive a reset link
        </p>
      </div>

      {successMessage && (
        <p className="text-sm text-[#00ff88]">{successMessage}</p>
      )}
      {form.formState.errors.root?.message && (
        <p className="text-sm text-[#ff3b3b]">{form.formState.errors.root.message}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
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
            invalid={!!form.formState.errors.email}
            {...form.register("email")}
          />
        </FormField>

        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="w-full bg-[hsl(0,0%,8%)] text-white py-3.5 text-sm font-medium rounded-[0.75rem] hover:bg-[hsl(0,0%,12%)] focus:outline-none focus:ring-2 focus:ring-[hsl(0,0%,8%)] focus:ring-offset-2 transition-colors disabled:opacity-50 mt-2"
        >
          {form.formState.isSubmitting ? "..." : "Send reset link"}
        </button>
      </form>

      <p className="text-sm text-[hsl(0,0%,45%)] mt-6 text-center">
        Remembered your password?{" "}
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
