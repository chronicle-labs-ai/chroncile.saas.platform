/*
 * useIsCoarsePointer — subscribes to the `pointer: coarse` media
 * query and returns `true` when the primary input is a finger or
 * stylus (touch devices, most phones / tablets). Use this to:
 *
 *   - Skip `autoFocus` on inputs (keyboard pop-up steals attention
 *     and obscures content the user hasn't read yet).
 *   - Drop hover-only affordances that don't have a visible touch
 *     equivalent.
 *   - Bump tap targets to ≥44px when Tailwind's `[@media(pointer:coarse)]`
 *     prefix is awkward (e.g. inside dynamic classNames).
 *
 * The result is computed synchronously on first render so SSR and
 * the first client render agree (always `false` on the server, then
 * the effect syncs to the real value — no hydration mismatch
 * because the hook never reads it during SSR).
 */

"use client";

import * as React from "react";

const QUERY = "(pointer: coarse)";

export function useIsCoarsePointer(): boolean {
  const [coarse, setCoarse] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    const handler = (event: MediaQueryListEvent) => setCoarse(event.matches);
    setCoarse(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return coarse;
}
