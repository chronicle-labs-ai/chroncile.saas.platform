/*
 * Slot classname compose helpers.
 *
 * Adapted from https://github.com/heroui-inc/heroui/blob/v3/packages/react/src/utils/compose.ts
 * (MIT). HeroUI's original re-exports a handful of shared utility classes
 * from `@heroui/styles`; we drop those since we own our tokens and don't
 * depend on @heroui/styles.
 *
 * Some older Chronicle wrappers accepted render-prop className functions.
 * The helper remains as a small local merge utility while those call sites
 * are simplified.
 */

"use client";

import { cx as tvCx } from "tailwind-variants";

/**
 * Merge a consumer-provided className (string or render-prop function) with
 * a tv-slot classname.
 *
 * The tv-slot value comes second so consumer overrides land last in the
 * class string, preserving our "overrides win" convention.
 */
export function composeTwRenderProps<T>(
  className: string | ((v: T) => string) | undefined,
  tailwind?: string | ((v: T) => string | undefined)
): string | ((v: T) => string) {
  if (typeof className === "function" || typeof tailwind === "function") {
    return (renderProps: T): string => {
      const incoming =
        typeof className === "function" ? className(renderProps) : className;
      const tw =
        typeof tailwind === "function"
          ? (tailwind(renderProps) ?? "")
          : (tailwind ?? "");
      return tvCx(tw, incoming ?? "") ?? "";
    };
  }

  return tvCx(tailwind ?? "", className ?? "") ?? "";
}

/**
 * Call a tailwind-variants slot function with consumer className + variants,
 * or fall back to the consumer className when the slot is absent (useful
 * when a compound component's context is optional).
 */
export function composeSlotClassName(
  slotFn:
    | ((args?: { className?: string; [key: string]: unknown }) => string)
    | undefined,
  className?: string,
  variants?: Record<string, unknown>
): string | undefined {
  return typeof slotFn === "function"
    ? slotFn({ ...(variants ?? {}), className })
    : className;
}
