"use client";

import { signIn } from "next-auth/react";
import { Logo } from "@/components/ui/logo";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-void">
      <div className="w-full max-w-sm">
        <div className="panel">
          <div className="panel__content space-y-8 py-8 px-6">
            <div className="flex flex-col items-center gap-4">
              <Logo className="w-12 h-12" variant="dark" />
              <div className="text-center">
                <h1 className="text-lg font-semibold text-primary">
                  Environment Manager
                </h1>
                <p className="text-xs text-tertiary mt-1">
                  Chronicle Labs internal tool
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                className="btn btn--primary w-full py-3 gap-3"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </button>

              <div className="text-center">
                <p className="text-[10px] text-disabled font-mono uppercase tracking-wider">
                  Restricted to @chronicle-labs.com
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
