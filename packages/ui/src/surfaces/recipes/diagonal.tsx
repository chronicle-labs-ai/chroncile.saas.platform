"use client";

import type { ComponentPropsWithoutRef } from "react";

import { GlassScene } from "../glass-scene";
import { GlassStack } from "../glass-stack";
import { LightSource } from "../light-source";

export interface DiagonalProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "color"
> {
  /** Number of diagonal slats. @default 11 */
  slats?: number;
}

/**
 * "Diagonal" — Figma frame `18` (node 0:63).
 *
 * A horizontally spread teal→black→orange light source cut by vertical
 * slats at maximum blur (183px). Rotation is applied to the scene via
 * the stack's rotation so the slats read as diagonal bars across the
 * frame.
 */
export function Diagonal({ slats = 11, ...rest }: DiagonalProps) {
  return (
    <GlassScene background="void" aspectRatio="1920 / 1080" {...rest}>
      <LightSource
        palette="tide"
        shape="sheet"
        rotation={0}
        size={{ w: "160%", h: "200%" }}
        position={{ x: "50%", y: "50%" }}
      />
      <GlassStack
        count={slats}
        orientation="vertical"
        blur="2xl"
        highlight="soft"
        blend="overlay"
        highlightAngle={267.93}
        noise={0.25}
        paneGrain={0.6}
      />
    </GlassScene>
  );
}
