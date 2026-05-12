"use client";

/*
 * Chronicle Labs — shared UI provider shim.
 */

import * as React from "react";

export interface UIProvidersProps {
  /** BCP-47 locale. Defaults to `en-US`. */
  locale?: string;
  /** Reserved for app-level router integrations. */
  navigate?: (path: string, routerOptions?: unknown) => void;
  /** Reserved for app-level href transforms. */
  useHref?: (href: string) => string;
  children: React.ReactNode;
}

/**
 * Single mount point for all Chronicle UI providers that need to live at
 * the root of the React tree. Our existing `ThemeProvider` is separate —
 * it already lives in `ui/theme` and can wrap (or be wrapped by) this.
 */
export function UIProviders({
  locale = "en-US",
  children,
}: UIProvidersProps) {
  return <div data-locale={locale}>{children}</div>;
}
