"use client";

/*
 * Ported from @chronicle/glass (sibling `chronicle.design-system` repo,
 * MIT). Kept verbatim modulo Chronicle import paths — the math is the
 * heart of the system and diverging would fork the visual truth.
 */

import type { CSSProperties, ComponentPropsWithoutRef, ReactNode } from "react";
import * as React from "react";

import { type Background, resolveBackground } from "./tokens";

export interface GlassSceneProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "children"
> {
  /**
   * Background color token or raw CSS color.
   * @default 'obsidian'
   */
  background?: Background;
  /**
   * Aspect ratio of the scene (e.g. "16 / 9"). When set, the scene fills
   * its container's width and derives height from the ratio.
   */
  aspectRatio?: string;
  /**
   * Logical stage dimensions — the coordinate system that LightSource
   * and GlassStack pixel sizes refer to. The inner stage is CSS-scaled
   * to fit the outer container, so all Figma-pixel values stay
   * proportional at every viewport size.
   * @default { w: 1920, h: 1080 }
   */
  stage?: { w: number; h: number };
  /**
   * Rotation applied to the stage (in degrees). Rotates the light
   * source and the glass stack together — crucial for diagonal
   * compositions because rotating the stack alone would isolate the
   * panes from the light source and break per-pane blending.
   * @default 0
   */
  rotation?: number;
  children?: ReactNode;
}

/**
 * `GlassScene` is the dark stage that contains a LightSource and one or
 * more GlassStacks / GlassPanes. It renders an isolated stacking
 * context (so `mix-blend-mode` on the panes only affects scene
 * contents) and a fixed-dimension inner stage that is CSS-scaled to
 * fit the outer container.
 */
export const GlassScene = React.forwardRef<HTMLDivElement, GlassSceneProps>(
  function GlassScene(
    {
      background = "obsidian",
      aspectRatio,
      stage = { w: 1920, h: 1080 },
      rotation = 0,
      className,
      style,
      children,
      ...rest
    },
    ref
  ) {
    const outerRef = React.useRef<HTMLDivElement | null>(null);
    const [scale, setScale] = React.useState(1);

    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        outerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref)
          (ref as { current: HTMLDivElement | null }).current = node;
      },
      [ref]
    );

    React.useEffect(() => {
      const node = outerRef.current;
      if (!node || typeof ResizeObserver === "undefined") return;
      const measure = () => {
        const w = node.clientWidth;
        const h = node.clientHeight;
        if (!w || !h) return;
        // Cover: take the larger of the two ratios so the stage fills
        // the container in both axes (outer has overflow:hidden, so
        // excess is cropped). Avoids letterboxing against the page bg.
        const next = Math.max(w / stage.w, h / stage.h);
        setScale(next);
      };
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(node);
      return () => ro.disconnect();
    }, [stage.w, stage.h]);

    const mergedStyle: CSSProperties = {
      "--cg-scene-bg": resolveBackground(background),
      "--cg-stage-w": `${stage.w}px`,
      "--cg-stage-h": `${stage.h}px`,
      "--cg-stage-scale": String(scale),
      "--cg-stage-rotate": `${rotation}deg`,
      ...(aspectRatio ? { aspectRatio } : null),
      ...style,
    } as CSSProperties;

    return (
      <div
        ref={setRefs}
        className={["cg-scene", className].filter(Boolean).join(" ")}
        style={mergedStyle}
        {...rest}
      >
        <div className="cg-scene__stage">{children}</div>
      </div>
    );
  }
);
