"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AydeaIcon } from "@/components/icons/AydeaIcon";

type FieldErrors = {
  name?: string[];
  email?: string[];
  password?: string[];
  organizationName?: string[];
};

const baseInputClass =
  "w-full px-3 py-2.5 bg-transparent border rounded-[0.75rem] text-base text-[hsl(0,0%,8%)] placeholder:text-[hsl(0,0%,45%)] focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors";

export default function SignupPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    organizationName: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FieldErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.details) {
          setErrors(data.details);
        } else {
          setGeneralError(data.error || "Registration failed");
        }
        setLoading(false);
        return;
      }

      router.push("/login?registered=true");
    } catch {
      setGeneralError("Connection error");
      setLoading(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `${baseInputClass} ${
      hasError
        ? "border-[#ff3b3b] focus:ring-[#ff3b3b]"
        : "border-[hsl(0,0%,90%)] focus:ring-[hsl(0,0%,8%)]"
    }`;

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

      {generalError && (
        <p className="text-sm text-[#ff3b3b]">{generalError}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-[hsl(0,0%,8%)] mb-1.5">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              required
              autoComplete="name"
              className={inputClass(!!errors.name)}
              placeholder="Your name"
            />
            {errors.name && (
              <p className="mt-2 text-xs text-[#ff3b3b]">{errors.name[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[hsl(0,0%,8%)] mb-1.5">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
              className={inputClass(!!errors.email)}
              placeholder="you@company.com"
            />
            {errors.email && (
              <p className="mt-2 text-xs text-[#ff3b3b]">{errors.email[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[hsl(0,0%,8%)] mb-1.5">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
              className={inputClass(!!errors.password)}
              placeholder="••••••••"
            />
            {errors.password ? (
              <p className="mt-2 text-xs text-[#ff3b3b]">{errors.password[0]}</p>
            ) : (
              <p className="mt-2 text-xs text-[hsl(0,0%,45%)]">
                8+ chars, mixed case, number
              </p>
            )}
          </div>

          <div>
            <label htmlFor="organizationName" className="block text-sm font-medium text-[hsl(0,0%,8%)] mb-1.5">
              Organization
            </label>
            <input
              id="organizationName"
              name="organizationName"
              type="text"
              value={formData.organizationName}
              onChange={handleChange}
              required
              className={inputClass(!!errors.organizationName)}
              placeholder="Company name"
            />
            {errors.organizationName && (
              <p className="mt-2 text-xs text-[#ff3b3b]">{errors.organizationName[0]}</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[hsl(0,0%,8%)] text-white py-3.5 text-sm font-medium rounded-[0.75rem] hover:bg-[hsl(0,0%,12%)] focus:outline-none focus:ring-2 focus:ring-[hsl(0,0%,8%)] focus:ring-offset-2 transition-colors disabled:opacity-50 mt-2"
        >
          {loading ? "..." : "Continue"}
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
