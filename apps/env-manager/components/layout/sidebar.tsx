"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Logo } from "@/components/ui/logo";

type NavItem = {
  name: string;
  href: string;
  icon: React.ReactNode;
};

const navigation: NavItem[] = [
  {
    name: "Environments",
    href: "/dashboard",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    name: "New Environment",
    href: "/dashboard/new",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (pathname === "/login") return null;

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[240px] lg:flex-col">
      <div className="flex flex-col h-full bg-surface border-r border-border-dim">
        {/* System Header */}
        <div className="h-12 flex items-center px-4 border-b border-border-dim bg-elevated">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Logo className="w-6 h-6 shrink-0" variant="dark" />
            <span className="text-sm font-semibold tracking-tight text-primary">
              Chronicle Labs
            </span>
          </Link>
        </div>

        {/* App Identifier */}
        <div className="px-4 py-3 border-b border-border-dim bg-data-bg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="status-dot status-dot--data status-dot--pulse" />
              <span className="font-mono text-[10px] font-medium tracking-wider text-data uppercase">
                Env Manager
              </span>
            </div>
            <span className="font-mono text-[10px] text-tertiary tabular-nums">
              v0.1.0
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <div className="px-4 mb-3">
            <span className="text-[10px] font-medium tracking-wider text-tertiary uppercase">
              Navigation
            </span>
          </div>

          <div className="space-y-0.5 px-2">
            {navigation.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium
                    transition-colors duration-fast
                    ${
                      isActive
                        ? "bg-data-bg text-data border-l-2 border-data"
                        : "text-secondary hover:text-primary hover:bg-hover border-l-2 border-transparent"
                    }
                  `}
                >
                  <span className={isActive ? "text-data" : "text-tertiary"}>
                    {item.icon}
                  </span>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* System Info Panel */}
        <div className="border-t border-border-dim">
          <div className="px-4 py-3 bg-elevated">
            <div className="text-[10px] font-medium tracking-wider text-tertiary mb-2 uppercase">
              System Info
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-tertiary">Version</span>
                <span className="font-mono text-xs text-secondary">0.1.0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-tertiary">Environment</span>
                <span
                  className={`font-mono text-xs ${
                    process.env.NODE_ENV === "production"
                      ? "text-nominal"
                      : "text-caution"
                  }`}
                >
                  {process.env.NODE_ENV === "production" ? "PROD" : "DEV"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-tertiary">Status</span>
                <span className="font-mono text-xs text-nominal">ONLINE</span>
              </div>
            </div>
          </div>
        </div>

        {/* User / Footer */}
        {session?.user ? (
          <div className="border-t border-border-dim">
            <div className="px-4 py-3 bg-elevated flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt=""
                    className="w-6 h-6 rounded-full shrink-0"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-data-bg border border-data-dim flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-mono text-data">
                      {(session.user.name ?? session.user.email ?? "?")[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs text-primary truncate">
                    {session.user.name}
                  </p>
                  <p className="text-[10px] text-tertiary font-mono truncate">
                    {session.user.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-tertiary hover:text-critical transition-colors shrink-0 ml-2"
                title="Sign out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-2 border-t border-border-dim flex items-center gap-2">
            <Logo className="w-4 h-4 shrink-0 opacity-70" variant="dark" />
            <span className="text-[10px] text-disabled">
              &copy; 2026 Chronicle Labs
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
