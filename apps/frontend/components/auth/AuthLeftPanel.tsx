"use client";

import UnicornScene from "unicornstudio-react/next";
import { AydeaIcon } from "@/components/icons/AydeaIcon";

/**
 * Left panel for auth pages with Unicorn Studio animation behind text.
 * Same credentials as agent-warmup-web Hero for consistent branding.
 */
export function AuthLeftPanel() {
  return (
    <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden justify-center">
      {/* Unicorn Studio WebGL Background - same as agent-warmup-web Hero */}
      <div className="absolute inset-0">
        <UnicornScene
          projectId="xITNUuryhTDKOXmkP6Y2"
          sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.0.5/dist/unicornStudio.umd.js"
          width="100%"
          height="100%"
        />
      </div>

      {/* Subtle overlay for text legibility */}
      <div className="absolute inset-0 bg-white/70" aria-hidden />

      {/* Content - centered block */}
      <div className="relative z-10 flex flex-col justify-between items-center max-w-xl flex-shrink-0 px-12 py-12 xl:px-20 xl:py-16 text-center">
        {/* Logo - alineado a la izquierda */}
        <div className="flex items-center gap-3 shrink-0 self-start">
          <AydeaIcon className="h-8 w-8 shrink-0 text-[hsl(0,0%,8%)]" />
          <span className="text-base font-medium text-[hsl(0,0%,8%)] tracking-tight">
            Chronicle Labs
          </span>
        </div>

        {/* Hero block - grouped with proximity */}
        <div className="flex-1 flex flex-col justify-center items-center py-8 w-full">
          <h1 className="text-3xl xl:text-[42px] font-bold leading-[1.15] tracking-tight text-[hsl(0,0%,8%)] mb-5">
            Turn AI agents into production-ready systems
          </h1>
          <p className="text-base text-[hsl(0,0%,45%)] leading-relaxed mb-10 max-w-lg mx-auto">
            Capture real events across systems, replay them for training and evaluation, and safely move your AI agents from sandbox to production.
          </p>
          {/* Metrics - compact row with visual separation */}
          <div className="flex items-center justify-center gap-8 xl:gap-12">
            <div className="flex flex-col">
              <span className="font-mono text-lg xl:text-xl tabular-nums text-[hsl(0,0%,8%)]">99.9%</span>
              <span className="text-xs text-[hsl(0,0%,45%)] mt-0.5">Uptime</span>
            </div>
            <div className="w-px h-10 bg-[hsl(0,0%,90%)]" aria-hidden />
            <div className="flex flex-col">
              <span className="font-mono text-lg xl:text-xl tabular-nums text-[hsl(0,0%,8%)]">&lt;50ms</span>
              <span className="text-xs text-[hsl(0,0%,45%)] mt-0.5">Latency</span>
            </div>
            <div className="w-px h-10 bg-[hsl(0,0%,90%)]" aria-hidden />
            <div className="flex flex-col">
              <span className="font-mono text-lg xl:text-xl tabular-nums text-[hsl(0,0%,8%)]">24/7</span>
              <span className="text-xs text-[hsl(0,0%,45%)] mt-0.5">Monitoring</span>
            </div>
          </div>
        </div>

        {/* Footer - alineado a la izquierda */}
        <div className="text-xs text-[hsl(0,0%,45%)] shrink-0 pt-6 self-start text-left">
          © {new Date().getFullYear()} Chronicle Labs
        </div>
      </div>
    </div>
  );
}
