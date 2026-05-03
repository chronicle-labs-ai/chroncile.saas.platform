"use client";

import * as React from "react";
import { THEME_STORAGE_KEY } from "./theme-script";

export type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Initial theme used during SSR. Defaults to "dark" (the brand surface). */
  defaultTheme?: Theme;
  /**
   * When `true`, the provider writes `data-theme` to `<html>` and listens
   * for cross-tab updates. Set to `false` if the host app already manages
   * the attribute (e.g. a Next root layout with a server-rendered theme).
   */
  attachToRoot?: boolean;
  /** Keyboard shortcut to toggle the theme. Default `"t"`. Set to `null` to disable. */
  toggleShortcut?: string | null;
}

function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function writeStoredTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // storage may be unavailable (private mode, SSR) — ignore.
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  attachToRoot = true,
  toggleShortcut = "t",
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);

  // Hydrate from localStorage / DOM once mounted.
  React.useEffect(() => {
    const stored = readStoredTheme();
    if (stored) {
      setThemeState(stored);
      return;
    }
    if (attachToRoot && typeof document !== "undefined") {
      const attr = document.documentElement.getAttribute("data-theme");
      if (attr === "light" || attr === "dark") setThemeState(attr);
    }
  }, [attachToRoot]);

  // Apply to <html> whenever state changes. Wraps the `data-theme`
  // swap with a transient `data-theme-changing` flag so the global
  // `transition: none` guard in `styles/globals.css` suppresses the
  // cross-theme color bleed. Without it, every element with a
  // `transition: background-color`/`color`/`border-color` would
  // animate between dark and light — visible as a 200-300ms wash.
  React.useEffect(() => {
    if (!attachToRoot || typeof document === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("data-theme-changing", "");
    root.setAttribute("data-theme", theme);
    window.dispatchEvent(
      new CustomEvent("chron:themechange", { detail: { theme } })
    );
    // Two RAFs: one to flush the `data-theme` paint, one more so the
    // browser commits the suppressed-transition frame before we lift
    // the guard. Cleared on unmount to avoid leaking the attribute.
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        root.removeAttribute("data-theme-changing");
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
      root.removeAttribute("data-theme-changing");
    };
  }, [attachToRoot, theme]);

  // Cross-tab sync.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      if (e.newValue === "light" || e.newValue === "dark") {
        setThemeState(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Keyboard shortcut — matches the handoff's `T` hotkey.
  React.useEffect(() => {
    if (!toggleShortcut || typeof window === "undefined") return;
    const key = toggleShortcut.toLowerCase();
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;
        if (target.isContentEditable) return;
      }
      if (
        e.key.toLowerCase() === key &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        setThemeState((t) => (t === "light" ? "dark" : "light"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleShortcut]);

  const setTheme = React.useCallback((t: Theme) => {
    writeStoredTheme(t);
    setThemeState(t);
  }, []);

  const toggle = React.useCallback(() => {
    setThemeState((t) => {
      const next: Theme = t === "light" ? "dark" : "light";
      writeStoredTheme(next);
      return next;
    });
  }, []);

  const value = React.useMemo(
    () => ({ theme, setTheme, toggle }),
    [theme, setTheme, toggle]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    // Degrade gracefully when used outside a provider — return a stub
    // that infers from the DOM so primitives don't crash.
    const theme: Theme =
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-theme") === "light"
        ? "light"
        : "dark";
    return {
      theme,
      setTheme: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}
