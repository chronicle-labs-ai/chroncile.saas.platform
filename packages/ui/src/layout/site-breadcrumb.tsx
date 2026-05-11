"use client";

import * as React from "react";

/*
 * Site breadcrumb — shared state for the global site header.
 *
 * Pages call `useSetSiteBreadcrumb(crumbs)` to set the breadcrumb
 * trail in the top header. The hook owns its lifecycle: it sets the
 * crumbs on mount and clears them on unmount, so client navigation
 * cleanly resets when leaving a page.
 *
 * `SiteHeader` reads the crumbs via `useSiteBreadcrumb()` and renders
 * them after the workspace logo. Multiple crumbs are joined with a
 * `/` separator; the last entry is treated as the current page (no
 * link, foreground ink).
 *
 * Falls back to a sensible default ("Overview") when no crumbs are
 * registered, so empty routes don't render a bare logo.
 */

export interface SiteBreadcrumbItem {
  /** Visible label. */
  label: string;
  /** Optional href. When omitted the crumb is non-interactive. The
   *  last crumb is always rendered as plain text regardless. */
  href?: string;
}

export interface SiteBreadcrumbContextValue {
  crumbs: readonly SiteBreadcrumbItem[];
  setCrumbs: (next: readonly SiteBreadcrumbItem[]) => void;
}

const SiteBreadcrumbContext =
  React.createContext<SiteBreadcrumbContextValue | null>(null);

export interface SiteBreadcrumbProviderProps {
  children: React.ReactNode;
  /** Optional initial crumbs (mostly useful in stories). */
  initial?: readonly SiteBreadcrumbItem[];
}

export function SiteBreadcrumbProvider({
  children,
  initial = [],
}: SiteBreadcrumbProviderProps) {
  const [crumbs, setCrumbsState] = React.useState<
    readonly SiteBreadcrumbItem[]
  >(initial);

  /* Setter is wrapped in a stable callback so consumers passing
     literal arrays don't trigger an effect loop on every render. */
  const setCrumbs = React.useCallback(
    (next: readonly SiteBreadcrumbItem[]) => {
      setCrumbsState((prev) => (sameCrumbs(prev, next) ? prev : next));
    },
    []
  );

  const value = React.useMemo<SiteBreadcrumbContextValue>(
    () => ({ crumbs, setCrumbs }),
    [crumbs, setCrumbs]
  );

  return (
    <SiteBreadcrumbContext.Provider value={value}>
      {children}
    </SiteBreadcrumbContext.Provider>
  );
}

/** Read the current crumbs. Returns an empty array when no provider
 *  is mounted (so the SiteHeader can fall back gracefully outside
 *  the dashboard shell — e.g. inside Storybook). */
export function useSiteBreadcrumb(): readonly SiteBreadcrumbItem[] {
  const ctx = React.useContext(SiteBreadcrumbContext);
  return ctx?.crumbs ?? [];
}

/**
 * Register breadcrumb crumbs from a page. Crumbs are set on mount
 * and cleared on unmount so client-side navigation between pages
 * resets cleanly.
 *
 * @example
 *   useSetSiteBreadcrumb([{ label: "Datasets" }]);
 */
export function useSetSiteBreadcrumb(
  crumbs: readonly SiteBreadcrumbItem[]
): void {
  const ctx = React.useContext(SiteBreadcrumbContext);
  /* Stringify-based dependency so callers can pass inline arrays
     without `useMemo`. The list is short and stable per page so the
     cost is negligible. */
  const key = React.useMemo(() => JSON.stringify(crumbs), [crumbs]);

  React.useEffect(() => {
    if (!ctx) return;
    ctx.setCrumbs(crumbs);
    return () => {
      ctx.setCrumbs([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.setCrumbs, key]);
}

function sameCrumbs(
  a: readonly SiteBreadcrumbItem[],
  b: readonly SiteBreadcrumbItem[]
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (!x || !y) return false;
    if (x.label !== y.label || x.href !== y.href) return false;
  }
  return true;
}
