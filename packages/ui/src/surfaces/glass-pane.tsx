"use client";

/*
 * Ported from @chronicle/glass (MIT).
 */

import type { CSSProperties, ComponentPropsWithoutRef } from "react";
import * as React from "react";

import { type Blur, type Highlight, resolveBlur } from "./tokens";

export interface GlassPaneProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * Backdrop blur radius. Accepts a token (`'sm' | 'md' | 'lg' | 'xl' |
   * '2xl'`), a raw number (treated as pixels), or any CSS length string.
   * @default 'xl'
   */
  blur?: Blur;
  /**
   * Edge-highlight gradient variant.
   * - `default` — bright edges, dark core (Figma default).
   * - `soft` — very subtle, for low-contrast scenes.
   * @default 'default'
   */
  highlight?: Highlight;
  /**
   * CSS `mix-blend-mode` applied to the pane.
   * @default 'overlay'
   */
  blend?: CSSProperties["mixBlendMode"];
  /** Override the highlight gradient angle (degrees). */
  highlightAngle?: number;
}

/**
 * A single glass "slat". This is the atomic primitive — everything else
 * in the system composes panes.
 *
 * Technique: a `backdrop-filter: blur()` heavily blurs whatever is
 * behind the pane, then a subtle vertical gradient plus
 * `mix-blend-mode: overlay` paints the "dark-core / bright-edge" tube
 * illusion on top.
 */
export const GlassPane = React.forwardRef<HTMLDivElement, GlassPaneProps>(
  function GlassPane(
    {
      blur = "xl",
      highlight = "default",
      blend = "overlay",
      highlightAngle,
      className,
      style,
      ...rest
    },
    ref
  ) {
    const mergedStyle: CSSProperties = {
      "--cg-pane-blur": resolveBlur(blur),
      "--cg-pane-blend": blend,
      ...(highlightAngle !== undefined
        ? { "--cg-pane-highlight-angle": `${highlightAngle}deg` }
        : null),
      ...style,
    } as CSSProperties;

    return (
      <div
        ref={ref}
        data-highlight={highlight}
        className={["cg-pane", className].filter(Boolean).join(" ")}
        style={mergedStyle}
        {...rest}
      />
    );
  }
);
