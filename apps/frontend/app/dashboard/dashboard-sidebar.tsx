"use client";

/*
 * Thin client wrapper around the design-system `<AppSidebar>`.
 *
 * `AppSidebar` lives in the framework-agnostic `ui` package and
 * deliberately doesn't import from `next/navigation`. This wrapper
 * is what bridges the gap: it reads the live pathname here (in a
 * client component), and forwards it as `currentPath` so the
 * sidebar's active rail follows the actual route — no more
 * hardcoded `isActive: true` on Overview.
 *
 * Lives next to the dashboard layout for the same reason
 * `link-router-provider.tsx` does: it has to be a client surface,
 * but the surrounding layout is a server component.
 */

import { usePathname } from "next/navigation";
import { AppSidebar, type AppSidebarProps } from "ui";

export function DashboardSidebar(
  props: Omit<AppSidebarProps, "currentPath">,
) {
  const pathname = usePathname();
  return <AppSidebar currentPath={pathname ?? undefined} {...props} />;
}
