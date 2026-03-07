"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { getBackendUrl } from "platform-api";
import { FormField, Input } from "ui";
import { AydeaIcon } from "@/components/icons/AydeaIcon";
import { signupSchema, type SignupInput } from "@/lib/validations";

export default function SignupPage() {
  const router = useRouter();
  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      organizationName: "",
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    form.clearErrors();

    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/platform/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          name: values.name,
          orgName: values.organizationName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.details) {
          const details = data.details as Partial<Record<keyof SignupInput, string[]>>;
          const fields: Array<keyof SignupInput> = [
            "name",
            "email",
            "password",
            "organizationName",
          ];

          for (const field of fields) {
            const message = details[field]?.[0];
            if (message) {
              form.setError(field, { type: "server", message });
            }
          }
        } else {
          form.setError("root", {
            message: data.error || "Registration failed",
          });
        }
        return;
      }

      router.push("/login?registered=true");
    } catch {
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
          Create account
        </h1>
        <p className="text-sm text-[hsl(0,0%,45%)]">
          Get started in minutes
        </p>
      </div>

      {form.formState.errors.root?.message && (
        <p className="text-sm text-[#ff3b3b]">{form.formState.errors.root.message}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <FormField
            tone="auth"
            label="Name"
            htmlFor="name"
            error={form.formState.errors.name?.message}
          >
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              variant="auth"
              invalid={!!form.formState.errors.name}
              {...form.register("name")}
            />
          </FormField>

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
              variant="auth"
              invalid={!!form.formState.errors.email}
              {...form.register("email")}
            />
          </FormField>

          <FormField
            tone="auth"
            label="Password"
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
              variant="auth"
              invalid={!!form.formState.errors.password}
              {...form.register("password")}
            />
          </FormField>

          <FormField
            tone="auth"
            label="Organization"
            htmlFor="organizationName"
            error={form.formState.errors.organizationName?.message}
          >
            <Input
              id="organizationName"
              type="text"
              placeholder="Company name"
              variant="auth"
              invalid={!!form.formState.errors.organizationName}
              {...form.register("organizationName")}
            />
          </FormField>
        </div>

        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="w-full bg-[hsl(0,0%,8%)] text-white py-3.5 text-sm font-medium rounded-[0.75rem] hover:bg-[hsl(0,0%,12%)] focus:outline-none focus:ring-2 focus:ring-[hsl(0,0%,8%)] focus:ring-offset-2 transition-colors disabled:opacity-50 mt-2"
        >
          {form.formState.isSubmitting ? "..." : "Continue"}
        </button>
      </form>

      <p className="text-sm text-[hsl(0,0%,45%)] mt-6 text-center">
        Have an account?{" "}
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
