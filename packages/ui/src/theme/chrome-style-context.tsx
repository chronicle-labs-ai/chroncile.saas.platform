"use client";

import * as React from "react";

/**
 * Chronicle **brand** (editorial / `--c-*`) vs **product** (Linear-density
 * / `--l-*`) for primitives and auth composites.
 *
 * Set once via `<ChromeStyleProvider>` or `<AuthShell chromeStyle="…">`.
 * `Button`, `Input`, and related primitives read this when `density` is
 * omitted. Explicit `density` always wins.
 */
export type ChromeStyle = "brand" | "product";

const ChromeStyleContext = React.createContext<ChromeStyle | undefined>(
  undefined
);

export interface ChromeStyleProviderProps {
  value: ChromeStyle;
  children: React.ReactNode;
}

export function ChromeStyleProvider({
  value,
  children,
}: ChromeStyleProviderProps) {
  return (
    <ChromeStyleContext.Provider value={value}>
      {children}
    </ChromeStyleContext.Provider>
  );
}

/**
 * Read the nearest `ChromeStyle` from context (or `undefined` if none
 * is set). Use this in shell components that want to inherit the
 * parent style — e.g. an `AuthShell` rendered inside a Storybook
 * `data-chrome="product"` toolbar override should pick up product
 * chrome unless its caller explicitly passes `chromeStyle`.
 */
export function useChromeStyleContext(): ChromeStyle | undefined {
  return React.useContext(ChromeStyleContext);
}

/**
 * Resolve control density for primitives (`Button`, `Input`, …).
 * Explicit prop wins; then provider; else **compact** (dashboard default).
 */
export function useResolvedChromeDensity(
  explicit?: "brand" | "compact"
): "brand" | "compact" {
  const ctx = React.useContext(ChromeStyleContext);
  if (explicit !== undefined) return explicit;
  if (ctx === "brand") return "brand";
  if (ctx === "product") return "compact";
  return "compact";
}

/**
 * For auth composites (`AcceptInvite`, …): when there is **no** provider,
 * default to **brand** so screens still read correctly outside `AuthShell`.
 */
export function useAuthChromeStyle(): {
  isProduct: boolean;
  density: "brand" | "compact";
} {
  const ctx = React.useContext(ChromeStyleContext);
  const isProduct = ctx === "product";
  return {
    isProduct,
    density: isProduct ? "compact" : "brand",
  };
}
