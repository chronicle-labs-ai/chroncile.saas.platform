/*
 * Render-prop + slot-classname compose helpers.
 *
 * Adapted from https://github.com/heroui-inc/heroui/blob/v3/packages/react/src/utils/compose.ts
 * (MIT). HeroUI's original re-exports a handful of shared utility classes
 * from `@heroui/styles`; we drop those since we own our tokens and don't
 * depend on @heroui/styles.
 *
 * Context: React Aria Components pass a `className` prop that can be either a
 * string or a function `(renderProps) => string`, where `renderProps` carries
 * live interaction state (`isHovered`, `isPressed`, `isFocusVisible`, etc.).
 * `composeTwRenderProps` lets us merge a consumer `className` (either form)
 * with a tv-slot classname (either form) into a single function the RAC
 * component can invoke.
 */

"use client";

import { composeRenderProps } from "react-aria-components/composeRenderProps";
import { cx as tvCx } from "tailwind-variants";

/**
 * Merge a consumer-provided className (string or render-prop function) with
 * a tv-slot classname into the shape React Aria Components expects.
 *
 * The tv-slot value comes second so consumer overrides land last in the
 * class string, preserving our "overrides win" convention.
 */
export function composeTwRenderProps<T>(
  className: string | ((v: T) => string) | undefined,
  tailwind?: string | ((v: T) => string | undefined)
): string | ((v: T) => string) {
  return composeRenderProps(className, (incoming, renderProps): string => {
    const tw =
      typeof tailwind === "function"
        ? (tailwind(renderProps) ?? "")
        : (tailwind ?? "");
    const cls = incoming ?? "";

    return tvCx(tw, cls) ?? "";
  });
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
