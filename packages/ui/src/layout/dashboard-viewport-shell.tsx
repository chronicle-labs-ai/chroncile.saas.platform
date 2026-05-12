import * as React from "react";

/*
 * DashboardViewportShell
 *
 * Pins a dashboard route to exactly the viewport space available
 * inside the dashboard chrome — `100svh` minus the site header
 * (`--header-height` set on `(authed)/layout.tsx`) and the layout's
 * vertical `p-4` (2rem). With a fixed height the route's manager
 * (Datasets, Connections, Agents, Backtests, Environments, Timeline,
 * etc.) can run its own internal scrolling without growing past the
 * viewport.
 *
 * No `className` escape hatch: the look is entirely owned by the
 * primitive so dashboard pages stay free of layout Tailwind.
 */
export interface DashboardViewportShellProps {
  children: React.ReactNode;
}

export function DashboardViewportShell({
  children,
}: DashboardViewportShellProps) {
  return (
    <div
      className="flex min-h-0 flex-col"
      style={{
        height: "calc(100svh - var(--header-height, 3.5rem) - 2rem)",
      }}
    >
      {children}
    </div>
  );
}
