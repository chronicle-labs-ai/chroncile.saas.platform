"use client";

import { SSOButton } from "ui";

export function LoginForm({ signInUrl }: { signInUrl: string }) {
  return (
    <div className="space-y-s-4">
      <SSOButton
        provider="google"
        className="w-full"
        onPress={() => {
          window.location.href = signInUrl;
        }}
      />

      <div className="text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-dim">
          Restricted to @chronicle-labs.com
        </p>
      </div>
    </div>
  );
}
