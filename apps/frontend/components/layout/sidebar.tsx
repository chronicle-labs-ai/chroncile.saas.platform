"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";

const navigation = [
  {
    name: "Overview",
    href: "/dashboard",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    name: "Events",
    href: "/dashboard/events",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    status: "LIVE",
  },
  {
    name: "Runs",
    href: "/dashboard/runs",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
      </svg>
    ),
  },
  {
    name: "Lead gen",
    href: "/dashboard/lead-gen",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    name: "Connections",
    href: "/dashboard/connections",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    name: "Documentation",
    href: "/dashboard/docs",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar - Command Panel */}
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

          {/* System Status - mono for data */}
          <div className="px-4 py-3 border-b border-border-dim bg-nominal-bg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="status-dot status-dot--nominal status-dot--pulse" />
                <span className="font-mono text-[10px] font-medium tracking-wider text-nominal uppercase">
                  System Nominal
                </span>
              </div>
              <span className="font-mono text-[10px] text-tertiary tabular-nums">
                {new Date().toLocaleTimeString('en-US', { hour12: false })}
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
                const isActive = pathname === item.href || 
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium
                      transition-colors duration-fast
                      ${isActive
                        ? "bg-data-bg text-data border-l-2 border-data"
                        : "text-secondary hover:text-primary hover:bg-hover border-l-2 border-transparent"
                      }
                    `}
                  >
                    <span className={isActive ? "text-data" : "text-tertiary"}>
                      {item.icon}
                    </span>
                    <span>{item.name}</span>
                    
                    {item.status && (
                      <span className={`
                        ml-auto flex items-center gap-1.5 px-1.5 py-0.5 
                        font-mono text-[10px] font-medium
                        ${isActive ? "bg-data/20 text-data" : "bg-nominal-bg text-nominal"}
                      `}>
                        <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse-slow" />
                        {item.status}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* System Info Panel - mono for technical data */}
          <div className="border-t border-border-dim">
            <div className="px-4 py-3 bg-elevated">
              <div className="text-[10px] font-medium tracking-wider text-tertiary mb-2 uppercase">
                System Info
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-tertiary">Version</span>
                  <span className="font-mono text-xs text-secondary">1.0.0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-tertiary">Environment</span>
                  <span className="font-mono text-xs text-caution">DEV</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-tertiary">Status</span>
                  <span className="font-mono text-xs text-nominal">ONLINE</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border-dim flex items-center gap-2">
            <Logo className="w-4 h-4 shrink-0 opacity-70" variant="dark" />
            <span className="text-[10px] text-disabled">
              © 2026 Chronicle Labs
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
