import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { Logo, Panel, PanelContent } from "ui";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const signInUrl = await getSignInUrl();

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

          <LoginForm signInUrl={signInUrl} />
        </PanelContent>
      </Panel>
    </div>
  );
}
