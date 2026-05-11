"use client";

import { signIn } from "next-auth/react";
import { Logo, Panel, PanelContent, SSOButton } from "ui";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-00">
      <Panel className="w-full max-w-sm">
        <PanelContent className="space-y-s-8 px-s-6 py-s-8">
          <div className="flex items-center justify-center gap-s-4">
            <Logo className="h-12 w-12 shrink-0" variant="dark" />
            <div className="text-left">
              <h1 className="font-sans text-xl font-thin leading-none tracking-[-0.02em] text-ink-hi">
                Chronicle Labs
              </h1>
              <p className="mt-2 font-mono text-[10px] uppercase leading-none tracking-[0.12em] text-ink-dim">
                Environment Manager
              </p>
            </div>
          </div>

          <div className="space-y-s-4">
            <SSOButton
              provider="google"
              className="w-full"
              onPress={() => signIn("google", { callbackUrl: "/dashboard" })}
            />

            <div className="text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-dim">
                Restricted to @chronicle-labs.com
              </p>
            </div>
          </div>
        </PanelContent>
      </Panel>
    </div>
  );
}
