import { AuthBackground } from "@/components/auth/AuthLeftPanel";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen relative flex">
      {/* Full-screen animated background */}
      <AuthBackground />

      {/* Left Panel - Brand & Value Prop */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10">
        <div className="flex flex-col justify-between p-16 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-data" />
            <span className="text-base font-medium text-primary/90">
              Agent Warmup
            </span>
          </div>

          {/* Hero */}
          <div className="max-w-md">
            <h1 className="text-[42px] font-light text-primary leading-[1.15] tracking-tight mb-6">
              Test AI agents<br />
              <span className="text-data">before they go live</span>
            </h1>
            
            <p className="text-base text-secondary/60 leading-relaxed mb-12">
              Record real customer interactions. Replay them against your agents. 
              Ship with confidence.
            </p>

            {/* Simple stats row */}
            <div className="flex items-center gap-10">
              <div>
                <div className="font-mono text-xl text-primary/90 tabular-nums">99.9%</div>
                <div className="text-xs text-tertiary/60 mt-1">Uptime</div>
              </div>
              <div>
                <div className="font-mono text-xl text-primary/90 tabular-nums">&lt;50ms</div>
                <div className="text-xs text-tertiary/60 mt-1">Latency</div>
              </div>
              <div>
                <div className="font-mono text-xl text-primary/90 tabular-nums">24/7</div>
                <div className="text-xs text-tertiary/60 mt-1">Monitoring</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 text-xs text-tertiary/40">
            <span>© 2026 Agent Warmup</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="w-full lg:w-1/2 relative z-10 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
