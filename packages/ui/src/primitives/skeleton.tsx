"use client";

import {
  Skeleton as BoneyardSkeleton,
  type SkeletonProps as BoneyardSkeletonProps,
} from "boneyard-js/react";

/**
 * Pixel-perfect skeleton wrapper around `boneyard-js`.
 *
 * Wrap any component in `<Skeleton name="..." loading={…}>`; the bones
 * are captured from Storybook by `npx boneyard-js build` and resolved
 * at runtime from the registry. See `packages/ui/boneyard.config.json`
 * and `packages/ui/src/bones/registry.ts`.
 *
 * Theme adapter
 * -------------
 * boneyard's runtime detects dark mode via the `.dark` class on `<html>`
 * or any ancestor. Chronicle uses `[data-theme="dark"]` instead. Rather
 * than mirror the class, we pass design-system CSS variables for both
 * `color` and `darkColor`. The variables in `tokens.css` already swap
 * per-theme, so the bone fill resolves to the correct surface in both
 * modes regardless of which selector boneyard checks.
 *
 * Defaults
 * --------
 *  - color/darkColor: `var(--c-wash-3)` — same surface as `SkeletonBlock`.
 *  - animate: `pulse` — matches the existing `animate-chron-pulse`
 *    keyframe feel; switch to `shimmer` for hero placeholders.
 *  - transition: `200ms` — short fade-out when loading flips to false,
 *    avoiding the popping you'd otherwise see.
 *
 * For one-off rectangles where you don't need DOM-derived bones, use
 * `<SkeletonBlock />` instead — it's a single styled `<div>` with no
 * runtime registry lookup.
 */

const DEFAULT_COLOR = "var(--c-wash-3)";

export type SkeletonProps = BoneyardSkeletonProps;

export function Skeleton({
  color = DEFAULT_COLOR,
  darkColor = DEFAULT_COLOR,
  animate = "pulse",
  transition = 200,
  ...rest
}: SkeletonProps) {
  return (
    <BoneyardSkeleton
      color={color}
      darkColor={darkColor}
      animate={animate}
      transition={transition}
      {...rest}
    />
  );
}
