"use client";

/*
 * Ported from @chronicle/glass (MIT).
 *
 * REPLACES the previous lo-fi `<GlassStack panes tone />` helper. The
 * new primitive is the exact design-system implementation: stamps `count`
 * panes inside a deliberately un-transformed flex container so `mix-
 * blend-mode` and `backdrop-filter` can reach the scene's LightSource.
 */

import type { CSSProperties, ComponentPropsWithoutRef, ReactNode } from "react";
import * as React from "react";

import { type Blur, type Highlight, resolveBlur } from "./tokens";

type Length = number | string;
const toLength = (v: Length): string => (typeof v === "number" ? `${v}px` : v);

export interface GlassStackProps extends ComponentPropsWithoutRef<"div"> {
  /** Number of panes to stamp. */
  count: number;
  /**
   * Content rendered *behind* the stack's panes and clipped to the
   * stack's bounding box. Use this to nest a `<LightSource>` inside the
   * stack so the light is only visible where the stack overlaps it —
   * areas outside the stack stay pure scene-background. The panes'
   * `backdrop-filter` still samples nested children.
   */
  children?: ReactNode;
  /**
   * Axis along which panes are laid out.
   * - `vertical` → panes are tall columns laid out in a row.
   * - `horizontal` → panes are wide rows laid out in a column.
   * @default 'vertical'
   */
  orientation?: "vertical" | "horizontal";
  /** Blur applied to each pane. @default 'xl' */
  blur?: Blur;
  /** Edge-highlight variant. @default 'default' */
  highlight?: Highlight;
  /**
   * `mix-blend-mode` applied to each pane individually.
   * @default 'overlay'
   */
  blend?: CSSProperties["mixBlendMode"];
  /** Gap between panes (0 for the Figma default seamless look). @default 0 */
  gap?: Length;
  /**
   * Amount by which each pane extends into its trailing neighbour, in
   * pixels. Covers subpixel gaps from fractional flex widths,
   * especially visible when the scene is scaled or rotated.
   * @default 2
   */
  overlap?: number;
  /**
   * Per-stack rotation in degrees.
   *
   * NOTE: non-zero values apply a CSS `transform` to the stack, which
   * creates an isolated stacking context. `backdrop-filter` on the
   * panes continues to sample the light source, so the color still
   * bleeds through, but `mix-blend-mode` on panes can only blend within
   * the stack's group — the overlay tube-highlight is muted. For a
   * lossless rotation of the whole composition (stack + light
   * together), rotate the scene instead via `GlassScene rotation={...}`.
   * @default 0
   */
  rotation?: number;
  /**
   * Stack size, in stage (logical) pixels or percentages of the stage.
   * @default { w: '100%', h: '100%' }
   */
  size?: { w: Length; h: Length };
  /**
   * Position of the stack's center inside the scene's stage. Expressed
   * as percentages of the stage (`'50%'` = centered). Note: to avoid
   * introducing a new stacking context (which would break per-pane
   * blend and backdrop-filter), the stack itself is never transformed —
   * center-based positioning is translated to top/left via `calc()`.
   * @default { x: '50%', y: '50%' }
   */
  position?: { x: Length; y: Length };
  /** Override highlight angle (degrees) for every pane. */
  highlightAngle?: number;
  /**
   * Film-grain / noise overlay on top of the stack. Mirrors the `NOISE`
   * effect applied to every "Glass Effect" group in Figma.
   *
   * - `false` (default) → no noise.
   * - `true` → default grain at token opacity (`--cg-noise-opacity`, 0.15).
   * - `number` (0..1) → custom opacity.
   */
  noise?: boolean | number;
  /**
   * Blend mode for the noise overlay.
   * @default 'overlay'
   */
  noiseBlend?: CSSProperties["mixBlendMode"];
  /**
   * Per-pane grain — dark speckle texture baked directly into each
   * glass slat (before the pane's mix-blend composites to the scene).
   * Distinct from `noise`, which paints grain over the whole stack.
   *
   * - `0` (default) → off.
   * - `0.8` → Figma-accurate grain intensity.
   * - `number` (0..1) → custom opacity.
   */
  paneGrain?: number;
}

/**
 * `GlassStack` stamps `count` equal-size glass panes along one axis.
 *
 * CRITICAL: the stack does NOT apply any CSS `transform` (no rotation,
 * no centering translate). That is a deliberate constraint — `transform`
 * creates a new stacking context, and both `mix-blend-mode` and
 * `backdrop-filter` on the child panes need the light source to be in
 * the pane's nearest enclosing stacking context to work correctly. For
 * diagonal compositions, rotate the whole scene via
 * `<GlassScene rotation={...} />` so the light source and the stack
 * rotate together.
 */
export const GlassStack = React.forwardRef<HTMLDivElement, GlassStackProps>(
  function GlassStack(
    {
      count,
      orientation = "vertical",
      blur = "xl",
      highlight = "default",
      blend = "overlay",
      gap = 0,
      overlap = 2,
      size = { w: "100%", h: "100%" },
      position = { x: "50%", y: "50%" },
      highlightAngle,
      noise = false,
      noiseBlend,
      paneGrain = 0,
      rotation = 0,
      children,
      className,
      style,
      ...rest
    },
    ref
  ) {
    const noiseEnabled = noise !== false;
    const noiseOpacity = typeof noise === "number" ? noise : undefined;
    const transform = rotation !== 0 ? `rotate(${rotation}deg)` : undefined;
    // Translate center-based position to top-left corner without using
    // any CSS transform. This is why we can use backdrop-filter +
    // mix-blend-mode on the panes and have them reach the light source.
    const cornerLeft = `calc(${toLength(position.x)} - ${toLength(size.w)} / 2)`;
    const cornerTop = `calc(${toLength(position.y)} - ${toLength(size.h)} / 2)`;

    const mergedStyle: CSSProperties = {
      left: cornerLeft,
      top: cornerTop,
      width: toLength(size.w),
      height: toLength(size.h),
      gap: toLength(gap),
      transformOrigin: "center center",
      ...(transform ? { transform } : null),
      "--cg-stack-overlap": `${overlap}px`,
      ...(highlightAngle !== undefined
        ? { "--cg-pane-highlight-angle": `${highlightAngle}deg` }
        : null),
      ...(noiseOpacity !== undefined
        ? { "--cg-stack-noise-opacity": String(noiseOpacity) }
        : null),
      ...(noiseBlend !== undefined
        ? { "--cg-stack-noise-blend": noiseBlend }
        : null),
      ...(paneGrain > 0 ? { "--cg-pane-noise": String(paneGrain) } : null),
      ...style,
    } as CSSProperties;

    const paneStyle: CSSProperties = {
      "--cg-pane-blur": resolveBlur(blur),
      "--cg-pane-blend": blend,
    } as CSSProperties;

    return (
      <div
        ref={ref}
        data-orientation={orientation}
        data-noise={noiseEnabled ? "true" : undefined}
        className={["cg-stack", className].filter(Boolean).join(" ")}
        style={mergedStyle}
        {...rest}
      >
        {children}
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            data-highlight={highlight}
            className="cg-pane"
            style={paneStyle}
          />
        ))}
      </div>
    );
  }
);
