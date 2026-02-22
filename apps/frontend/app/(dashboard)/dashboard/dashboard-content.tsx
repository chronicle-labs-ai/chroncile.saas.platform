"use client";

import Link from "next/link";
import { useDashboardStats } from "@/lib/hooks/use-dashboard-stats";
import { Skeleton } from "@/components/ui/skeleton";
import { RecentActivity } from "./recent-activity";
import { RecentRuns } from "./recent-runs";

interface DashboardContentProps {
  userName: string;
  currentDate: string;
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-3 w-32 mb-2" />
          <Skeleton className="h-7 w-56" />
        </div>
        <Skeleton className="h-4 w-36" />
      </div>

      <div className="panel">
        <div className="flex items-center justify-between px-4 py-3 bg-elevated border-b border-border-dim">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="panel">
            <div className="panel__header">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-2 w-2 rounded-full" />
            </div>
            <div className="panel__content">
              <Skeleton className="h-8 w-12 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 panel">
          <div className="panel__header">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-20 rounded-sm" />
          </div>
          <div className="divide-y divide-border-dim">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <Skeleton className="w-10 h-10 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-16 rounded-sm" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="panel">
            <div className="panel__header">
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="panel__content">
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-4/5 mb-4" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
          <div className="panel">
            <div className="panel__header">
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="panel__content">
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-4/5 mb-4" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        </div>
      </div>

      <RecentActivity />
    </div>
  );
}

export function DashboardContent({ userName, currentDate }: DashboardContentProps) {
  const {
    eventsCount,
    connectionsCount,
    eventsTodayCount,
    sessionsCount,
    runsCount,
    runsTodayCount,
    isLoading,
  } = useDashboardStats();

  const step1Complete = connectionsCount >= 1;
  const step2Complete = eventsCount > 0;
  const step3Complete = false;
  const completedSteps =
    (step1Complete ? 1 : 0) + (step2Complete ? 1 : 0) + (step3Complete ? 1 : 0);

  if (isLoading) {
    return <OverviewSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-tertiary tracking-wide uppercase mb-1">
            Operational Overview
          </div>
          <h1 className="text-2xl font-semibold text-primary">
            Welcome back, {userName}
          </h1>
        </div>
        <div className="text-sm text-tertiary">{currentDate}</div>
      </div>

      <div className="panel">
        <div className="flex items-center justify-between px-4 py-3 bg-nominal-bg border-b border-nominal-dim">
          <div className="flex items-center gap-3">
            <div className="status-dot status-dot--nominal status-dot--pulse" />
            <span className="text-sm font-medium text-nominal">
              All Systems Operational
            </span>
          </div>
          <span className="font-mono text-xs text-nominal tabular-nums">
            Last check: {new Date().toLocaleTimeString("en-US", { hour12: false })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Events Today</span>
            <div className="status-dot status-dot--nominal status-dot--pulse" />
          </div>
          <div className="panel__content">
            <div className="metric">
              <div className="metric__value metric__value--data">
                {eventsTodayCount}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="metric__delta metric__delta--neutral">+0%</span>
                <span className="text-xs text-tertiary">vs yesterday</span>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Connections</span>
            <div
              className={
                connectionsCount > 0
                  ? "status-dot status-dot--nominal status-dot--pulse"
                  : "status-dot status-dot--data"
              }
            />
          </div>
          <div className="panel__content">
            <div className="metric">
              <div className="metric__value">{connectionsCount}</div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={
                    connectionsCount > 0
                      ? "badge badge--nominal"
                      : "badge badge--neutral"
                  }
                >
                  {connectionsCount > 0 ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <Link href="/dashboard/runs" className="panel hover:border-data/30 transition-colors">
          <div className="panel__header">
            <span className="panel__title">Runs</span>
            <div
              className={
                runsCount > 0
                  ? "status-dot status-dot--nominal status-dot--pulse"
                  : "status-dot status-dot--data"
              }
            />
          </div>
          <div className="panel__content">
            <div className="metric">
              <div className="metric__value metric__value--data">{runsTodayCount}</div>
              <div className="mt-2 flex items-center gap-2">
                <span className="metric__delta metric__delta--neutral">
                  {runsCount} total
                </span>
              </div>
            </div>
          </div>
        </Link>

        {/* System Health */}
        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">System Health</span>
            <div className="status-dot status-dot--nominal status-dot--pulse" />
          </div>
          <div className="panel__content">
            <div className="metric">
              <div className="metric__value metric__value--nominal">99.9%</div>
              <div className="mt-2">
                <div className="progress-bar">
                  <div
                    className="progress-bar__fill progress-bar__fill--nominal"
                    style={{ width: "99.9%" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Setup Checklist - 2 columns */}
        <div className="lg:col-span-2 panel">
          <div className="panel__header">
            <span className="panel__title">Getting Started</span>
            <span
              className={
                completedSteps === 3
                  ? "badge badge--nominal"
                  : completedSteps > 0
                    ? "badge badge--caution"
                    : "badge badge--caution"
              }
            >
              {completedSteps}/3 Complete
            </span>
          </div>
          <div className="divide-y divide-border-dim">
            {/* Step 1 */}
            {step1Complete ? (
              <div className="flex items-center gap-4 px-4 py-4">
                <div className="w-10 h-10 border border-nominal bg-nominal-bg flex items-center justify-center font-mono text-sm font-bold text-nominal">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="font-medium text-primary">
                    Connect your first integration
                  </span>
                  <p className="text-sm text-tertiary mt-0.5">
                    Establish a data source connection to begin capturing events
                  </p>
                </div>
                <span className="badge badge--nominal">Complete</span>
              </div>
            ) : (
              <Link
                href="/dashboard/connections"
                className="flex items-center gap-4 px-4 py-4 hover:bg-hover transition-colors group"
              >
                <div className="w-10 h-10 border border-data bg-data-bg flex items-center justify-center font-mono text-sm font-bold text-data">
                  01
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-primary group-hover:text-data transition-colors">
                      Connect your first integration
                    </span>
                    <svg
                      className="w-4 h-4 text-tertiary group-hover:text-data group-hover:translate-x-1 transition-all"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-tertiary mt-0.5">
                    Establish a data source connection to begin capturing events
                  </p>
                </div>
                <span className="badge badge--data">Action Required</span>
              </Link>
            )}

            {/* Step 2 */}
            {step2Complete ? (
              <div className="flex items-center gap-4 px-4 py-4">
                <div className="w-10 h-10 border border-nominal bg-nominal-bg flex items-center justify-center font-mono text-sm font-bold text-nominal">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="font-medium text-primary">
                    Start a recording session
                  </span>
                  <p className="text-sm text-tertiary mt-0.5">
                    Initialize event capture for training data collection
                  </p>
                </div>
                <span className="badge badge--nominal">Complete</span>
              </div>
            ) : (
              <Link
                href="/dashboard/events"
                className={`flex items-center gap-4 px-4 py-4 transition-colors group ${!step1Complete ? "opacity-50 pointer-events-none" : "hover:bg-hover"}`}
              >
                <div className="w-10 h-10 border border-border-default bg-elevated flex items-center justify-center font-mono text-sm font-bold text-tertiary">
                  02
                </div>
                <div className="flex-1">
                  <span className="font-medium text-secondary group-hover:text-data transition-colors">
                    Start a recording session
                  </span>
                  <p className="text-sm text-tertiary mt-0.5">
                    Initialize event capture for training data collection
                  </p>
                </div>
                <span className="badge badge--neutral">Pending</span>
              </Link>
            )}

            {/* Step 3 */}
            {step3Complete ? (
              <div className="flex items-center gap-4 px-4 py-4">
                <div className="w-10 h-10 border border-nominal bg-nominal-bg flex items-center justify-center font-mono text-sm font-bold text-nominal">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="font-medium text-primary">
                    Replay and validate
                  </span>
                  <p className="text-sm text-tertiary mt-0.5">
                    Execute recorded sessions against your agent for validation
                  </p>
                </div>
                <span className="badge badge--nominal">Complete</span>
              </div>
            ) : (
              <Link
                href="/dashboard/runs"
                className={`flex items-center gap-4 px-4 py-4 transition-colors group ${!step2Complete ? "opacity-50 pointer-events-none" : "hover:bg-hover"}`}
              >
                <div className="w-10 h-10 border border-border-default bg-elevated flex items-center justify-center font-mono text-sm font-bold text-tertiary">
                  03
                </div>
                <div className="flex-1">
                  <span className="font-medium text-secondary group-hover:text-data transition-colors">
                    Replay and validate
                  </span>
                  <p className="text-sm text-tertiary mt-0.5">
                    Execute recorded sessions against your agent for validation
                  </p>
                </div>
                <span className="badge badge--neutral">Pending</span>
              </Link>
            )}
          </div>
        </div>

        {/* Quick Actions - 1 column */}
        <div className="space-y-4">
          <RecentRuns />
          {/* Lead gen (demo) */}
          <div className="panel">
            <div className="panel__header">
              <span className="panel__title">Lead gen (demo)</span>
            </div>
            <div className="panel__content">
              <p className="text-sm text-tertiary mb-4">
                Run a mock lead search (CPG/D2C + call centers + AI), create runs, and process them with the outreach agent.
              </p>
              <Link href="/dashboard/lead-gen" className="btn btn--secondary w-full">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                </svg>
                Open Lead gen
              </Link>
            </div>
          </div>
          {/* Documentation */}
          <div className="panel">
            <div className="panel__header">
              <span className="panel__title">Documentation</span>
            </div>
            <div className="panel__content">
              <p className="text-sm text-tertiary mb-4">
                System operation manuals and API reference guides.
              </p>
              <Link href="/dashboard/docs" className="btn btn--secondary w-full">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                  />
                </svg>
                View Docs
              </Link>
            </div>
          </div>

          {/* Support */}
          <div className="panel">
            <div className="panel__header">
              <span className="panel__title">Support</span>
            </div>
            <div className="panel__content">
              <p className="text-sm text-tertiary mb-4">
                Technical assistance and incident reporting.
              </p>
              <a href="#" className="btn btn--secondary w-full">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                  />
                </svg>
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <RecentActivity />
    </div>
  );
}
