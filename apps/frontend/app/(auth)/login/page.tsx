"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const registered = searchParams.get("registered");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid credentials");
        setLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Connection error");
      setLoading(false);
    }
  };

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
          Sign in
        </h1>
        <p className="text-sm text-white/90">
          Welcome back
        </p>
      </div>

      {registered && (
        <p className="text-sm text-nominal">Account created successfully</p>
      )}
      {error && (
        <p className="text-sm text-critical">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-xs text-white mb-2 font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-0 py-3 bg-transparent border-0 border-b border-white/30 text-base text-white placeholder:text-white/60 focus:outline-none focus:border-data transition-colors"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs text-white mb-2 font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-0 py-3 bg-transparent border-0 border-b border-white/30 text-base text-white placeholder:text-white/60 focus:outline-none focus:border-data transition-colors"
              placeholder="••••••••"
            />
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
        No account?{" "}
        <Link href="/signup" className="text-white font-medium underline underline-offset-2 hover:text-data transition-colors">
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-sm text-white/80">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
