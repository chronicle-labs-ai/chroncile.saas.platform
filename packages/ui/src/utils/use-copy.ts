/*
 * useCopy — clipboard write with built-in "copied" feedback state.
 *
 *   const { copy, copied } = useCopy();
 *   <button onClick={() => copy(value)}>
 *     {copied ? "Copied" : "Copy"}
 *   </button>
 *
 * The `copied` flag flips back to `false` after `resetMs` (default
 * 1100ms) so callers can swap an icon to a checkmark and back without
 * having to manage the timer themselves. Without feedback the user
 * "clicks it three more times to check it worked" — Emil's interaction
 * rule on copy-to-clipboard.
 */

"use client";

import * as React from "react";

export interface UseCopyOptions {
  /** Milliseconds before `copied` flips back to `false`. */
  resetMs?: number;
  /** Optional callback fired after a successful copy. */
  onCopy?: (value: string) => void;
}

export interface UseCopyReturn {
  copy: (value: string) => Promise<boolean>;
  copied: boolean;
  /** Reset the `copied` flag immediately. */
  reset: () => void;
}

export function useCopy(options: UseCopyOptions = {}): UseCopyReturn {
  const { resetMs = 1100, onCopy } = options;
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setCopied(false);
  }, []);

  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = React.useCallback(
    async (value: string): Promise<boolean> => {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        return false;
      }
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        onCopy?.(value);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setCopied(false);
          timerRef.current = null;
        }, resetMs);
        return true;
      } catch {
        return false;
      }
    },
    [resetMs, onCopy],
  );

  return { copy, copied, reset };
}
