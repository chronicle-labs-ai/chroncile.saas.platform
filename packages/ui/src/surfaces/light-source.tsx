"use client";

/*
 * Ported from @chronicle/glass (sibling `chronicle.design-system` repo,
 * MIT).
 *
 * NOTE: This replaces the previous CSS-only `.chron-lightsource`
 * wrapper. The old API was a `<div className="chron-lightsource">`
 * placeholder that painted a fixed ember gradient with hardcoded
 * geometry. The new primitive is a full React component with an
 * explicit palette, shape, position, size, rotation, and grain — the
 * same API the Blinds/Dawn/Diagonal/Dusk/Ember/Monolith recipes consume.
 */

import type { CSSProperties, ComponentPropsWithoutRef } from "react";
import * as React from "react";

import { type Palette, type PaletteName, paletteToCss } from "./tokens";

export type LightSourceShape = "pill" | "sheet" | "blob";
export type LightSourceShadow = "default" | "soft" | "none" | string;

type Length = number | string;
const toLength = (v: Length): string => (typeof v === "number" ? `${v}px` : v);

const resolveShadow = (shadow: LightSourceShadow): string => {
  if (shadow === "default") return "var(--cg-light-shadow)";
  if (shadow === "soft") return "var(--cg-light-shadow-soft)";
  if (shadow === "none") return "none";
  return shadow;
};

export interface LightSourceProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "color"
> {
  /** Named palette or inline palette object. */
  palette: PaletteName | Palette;
  /**
   * Shape of the emitter. `pill` is the Figma default (fully rounded rect).
   * @default 'pill'
   */
  shape?: LightSourceShape;
  /**
   * Rotation in degrees applied after translation. Matches Figma's
   * rotate().
   * @default 0
   */
  rotation?: number;
  /**
   * Position of the emitter's center, relative to the parent
   * GlassScene. Values can be a percentage string (`'50%'`) or a pixel
   * number.
   * @default { x: '50%', y: '50%' }
   */
  position?: { x: Length; y: Length };
  /**
   * Explicit size. Accepts pixels or any CSS length.
   * @default { w: '120%', h: '140%' }
   */
  size?: { w: Length; h: Length };
  /**
   * Multiplier on the scene's opacity for the light source itself.
   * @default 1
   */
  opacity?: number;
  /** Flip vertically (mirrors Figma's `-scale-y-100`). */
  flipY?: boolean;
  /**
   * Optional inner shadow on the emitter shape.
   * @default 'none'
   */
  shadow?: LightSourceShadow;
  /**
   * Grain opacity on the light source itself. Matches Figma's TEXTURE
   * effect on node 0:35. Set to 0 to disable.
   * @default 0.08
   */
  grain?: number;
}

/**
 * LightSource — the colored emitter behind the glass. In the Figma
 * source every frame has exactly one: a rounded-rect pill with a
 * multi-stop gradient fill (blend NORMAL) and a TEXTURE grain effect.
 * Its gradient is the *only* source of color in the scene.
 */
export const LightSource = React.forwardRef<HTMLDivElement, LightSourceProps>(
  function LightSource(
    {
      palette,
      shape = "pill",
      rotation = 0,
      position = { x: "50%", y: "50%" },
      size = { w: "120%", h: "140%" },
      opacity = 1,
      flipY = false,
      shadow = "none",
      grain = 0.08,
      className,
      style,
      ...rest
    },
    ref
  ) {
    const gradient = paletteToCss(palette);
    const transform = [
      "translate(-50%, -50%)",
      flipY ? "scaleY(-1)" : null,
      rotation !== 0 ? `rotate(${rotation}deg)` : null,
    ]
      .filter(Boolean)
      .join(" ");

    const mergedStyle: CSSProperties = {
      "--cg-light-gradient": gradient,
      "--cg-light-shadow-resolved": resolveShadow(shadow),
      "--cg-light-grain-opacity": String(grain),
      top: toLength(position.y),
      left: toLength(position.x),
      width: toLength(size.w),
      height: toLength(size.h),
      transform,
      opacity,
      ...style,
    } as CSSProperties;

    return (
      <div
        ref={ref}
        data-shape={shape}
        className={["cg-light", className].filter(Boolean).join(" ")}
        style={mergedStyle}
        {...rest}
      />
    );
  }
);
