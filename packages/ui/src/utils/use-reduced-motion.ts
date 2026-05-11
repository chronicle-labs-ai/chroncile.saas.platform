/*
 * useReducedMotion — subscribes to the `prefers-reduced-motion` media
 * query and returns `true` when the user has asked the OS to reduce
 * motion. Use this to disable spring animations, swipe gestures, and
 * other moving UI on accessibility grounds.
 *
 * Globals.css already kills CSS transition durations under the same
 * media query; this hook covers JS-driven motion (drag offsets,
 * Framer Motion spring tweens, etc.) which CSS guards cannot reach.
 */

"use client";

import * as React from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(QUERY).matches;
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(QUERY);
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    // Initial sync in case the value changed between SSR and mount.
    setReduced(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}
