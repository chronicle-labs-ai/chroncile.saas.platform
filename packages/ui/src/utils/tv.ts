/*
 * tailwind-variants wrapper.
 *
 * Ported from https://github.com/heroui-inc/heroui/blob/v3/packages/react/src/utils/tv.ts
 * (MIT). HeroUI v3 disables tw-merge because its generated classnames are
 * BEM-style and never collide. We inherit the same default for a different
 * reason: our slot strings are hand-authored Tailwind utilities layered in a
 * known order, and flipping tw-merge off keeps `tv()` calls as cheap static
 * string concatenation at runtime. Callers that know they need merging can
 * opt in per-invocation by passing `{ twMerge: true }` as the second arg.
 *
 * @deprecated Reach for `cva` from `class-variance-authority` in new code
 * (the rest of the design system uses it). This wrapper survives because
 * many existing slot-heavy components in `product/`, `agents/`, `datasets/`
 * still consume it; once those have migrated to `cva` (or vanilla `cn`),
 * delete this file and remove `tailwind-variants` from `dependencies`.
 */

import type { TV } from "tailwind-variants";

import { tv as tvBase } from "tailwind-variants";

export type { VariantProps } from "tailwind-variants";

export const tv: TV = (options, config) =>
  tvBase(options, {
    ...config,
    twMerge: config?.twMerge ?? false,
    twMergeConfig: {
      ...config?.twMergeConfig,
      classGroups: {
        ...config?.twMergeConfig?.classGroups,
      },
      theme: {
        ...config?.twMergeConfig?.theme,
      },
    },
  });
