"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useDashboardStats } from "@/lib/hooks/use-dashboard-stats";
import { Skeleton } from "@/components/ui/skeleton";

interface User {
  name?: string | null;
  email?: string | null;
  tenantName?: string;
}

export function Header({ user }: { user: User }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const { eventsCount, connectionsCount, isLoading: statsLoading } = useDashboardStats();

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "?";

  return (
    <header className="sticky top-0 z-10 h-12 bg-surface border-b border-border-dim">
      <div className="flex items-center justify-between h-full px-4">
        {/* Left: Mobile menu + Search */}
        <div className="flex items-center gap-4">
          {/* Mobile menu */}
          <button className="lg:hidden p-1.5 text-tertiary hover:text-primary transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          
          {/* Search */}
          <div className="hidden md:flex items-center">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                <svg className="w-3.5 h-3.5 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <input
                type="search"
                placeholder="Search..."
                className="w-64 pl-9 pr-3 py-1.5 bg-base border border-border-dim text-sm placeholder:text-disabled focus:outline-none focus:border-data transition-colors"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                <kbd className="px-1.5 py-0.5 font-mono text-[10px] text-disabled bg-elevated border border-border-dim">
                  /
                </kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Status indicators - mono for data values */}
        <div className="hidden lg:flex items-center gap-6">
          {/* Events status */}
          <div className="flex items-baseline gap-1.5">
            {statsLoading ? (
              <Skeleton className="h-1.5 w-1.5 rounded-full shrink-0 mt-0.5" />
            ) : (
              <div className="status-dot status-dot--nominal status-dot--pulse relative top-[-1px]" />
            )}
            <span className="text-[11px] text-tertiary leading-none">Events</span>
            {statsLoading ? (
              <Skeleton className="h-3.5 w-5 shrink-0" />
            ) : (
              <span className="font-mono text-[13px] text-nominal font-medium tabular-nums leading-none">{eventsCount}</span>
            )}
          </div>
          
          <div className="w-px h-4 bg-border-dim" />
          
          {/* Connections status */}
          <div className="flex items-baseline gap-1.5">
            {statsLoading ? (
              <Skeleton className="h-1.5 w-1.5 rounded-full shrink-0 mt-0.5" />
            ) : (
              <div className={`status-dot relative top-[-1px] ${connectionsCount > 0 ? "status-dot--nominal status-dot--pulse" : "status-dot--data"}`} />
            )}
            <span className="text-[11px] text-tertiary leading-none">Connections</span>
            {statsLoading ? (
              <Skeleton className="h-3.5 w-5 shrink-0" />
            ) : (
              <span className="font-mono text-[13px] text-data font-medium tabular-nums leading-none">{connectionsCount}</span>
            )}
          </div>
          
          <div className="w-px h-4 bg-border-dim" />
          
          {/* Uptime */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] text-tertiary leading-none">Uptime</span>
            {statsLoading ? (
              <Skeleton className="h-3.5 w-9 shrink-0" />
            ) : (
              <span className="font-mono text-[13px] text-primary font-medium tabular-nums leading-none">99.9%</span>
            )}
          </div>
        </div>

        {/* Right: Time, Org, User */}
        <div className="flex items-center gap-4">
          {/* Local Time - mono for timestamp */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-elevated border border-border-dim">
            <span className="text-[10px] text-tertiary uppercase tracking-wide">Local</span>
            <span className="font-mono text-xs text-primary font-medium tabular-nums">
              {currentTime}
            </span>
          </div>

          {/* Organization */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-elevated border border-border-dim">
            <span className="text-xs text-secondary">
              {user?.tenantName || "Organization"}
            </span>
          </div>

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`
                flex items-center gap-2 px-2 py-1 border transition-colors
                ${dropdownOpen 
                  ? "bg-active border-border-bright text-primary" 
                  : "bg-elevated border-border-dim text-secondary hover:text-primary hover:border-border-default"
                }
              `}
            >
              <div className="w-6 h-6 bg-data text-base flex items-center justify-center text-xs font-bold">
                {initials}
              </div>
              <svg
                className={`w-3 h-3 text-tertiary transition-transform duration-fast ${dropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-surface border border-border-default shadow-lg">
                {/* User info */}
                <div className="px-3 py-3 border-b border-border-dim bg-elevated">
                  <div className="text-[10px] text-tertiary mb-1 uppercase tracking-wide">Operator</div>
                  <div className="text-sm font-medium text-primary truncate">
                    {user?.name || "Unknown"}
                  </div>
                  <div className="text-xs text-tertiary truncate mt-0.5">
                    {user?.email}
                  </div>
                </div>
                
                {/* Menu items */}
                <div className="py-1">
                  <Link
                    href="/dashboard/settings"
                    className="flex items-center gap-3 px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-hover transition-colors"
                  >
                    <svg className="w-4 h-4 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </Link>
                </div>
                
                {/* Sign out */}
                <div className="border-t border-border-dim py-1">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 w-full px-3 py-2 text-sm text-critical hover:bg-critical-bg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
