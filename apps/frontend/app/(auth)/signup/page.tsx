"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type FieldErrors = {
  name?: string[];
  email?: string[];
  password?: string[];
  organizationName?: string[];
};

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
    `w-full px-0 py-3 bg-transparent border-0 border-b text-base text-white placeholder:text-white/60 focus:outline-none transition-colors ${
      hasError ? "border-critical" : "border-white/30 focus:border-data"
    }`;

  return (
    <div className="space-y-10">
      <div className="lg:hidden flex items-center gap-3 mb-8">
        <div className="w-8 h-8 bg-data" />
        <span className="text-base font-medium text-white">
          Agent Warmup
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-light text-white mb-2">
          Create account
        </h1>
        <p className="text-sm text-white/90">
          Get started in minutes
        </p>
      </div>

      {generalError && (
        <p className="text-sm text-critical">{generalError}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-xs text-white mb-2 font-medium">
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
              <p className="mt-2 text-xs text-critical">{errors.name[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-xs text-white mb-2 font-medium">
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
              <p className="mt-2 text-xs text-critical">{errors.email[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-xs text-white mb-2 font-medium">
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
              <p className="mt-2 text-xs text-critical">{errors.password[0]}</p>
            ) : (
              <p className="mt-2 text-xs text-white/70">
                8+ chars, mixed case, number
              </p>
            )}
          </div>

          <div>
            <label htmlFor="organizationName" className="block text-xs text-white mb-2 font-medium">
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
              <p className="mt-2 text-xs text-critical">{errors.organizationName[0]}</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-data text-white py-3.5 text-sm font-semibold rounded-md hover:bg-data/90 focus:outline-none focus:ring-2 focus:ring-data focus:ring-offset-2 focus:ring-offset-transparent transition-colors disabled:opacity-50"
        >
          {loading ? "..." : "Continue"}
        </button>
      </form>

      <p className="text-sm text-white/90">
        Have an account?{" "}
        <Link href="/login" className="text-white font-medium underline underline-offset-2 hover:text-data transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
