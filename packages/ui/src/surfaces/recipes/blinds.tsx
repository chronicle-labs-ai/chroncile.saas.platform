"use client";

import type { ComponentPropsWithoutRef } from "react";

import { GlassScene } from "../glass-scene";
import { GlassStack } from "../glass-stack";
import { LightSource } from "../light-source";

export interface BlindsProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "color"
> {
  /** Number of vertical slats. @default 11 */
  slats?: number;
}

/**
 * "Blinds" — Figma frame `56` (node 0:33).
 *
 * A single tall ember-palette pill tilted hard to one side, sliced by 11
 * vertical glass slats. The slats' edge-highlight + overlay blend warps
 * the pill into a columnar, curtain-like image.
 */
export function Blinds({ slats = 11, ...rest }: BlindsProps) {
  return (
    <GlassScene background="obsidian" aspectRatio="1920 / 1080" {...rest}>
      <LightSource
        palette="ember"
        shape="pill"
        rotation={-118.42}
        flipY
        size={{ w: 550, h: 2800 }}
        position={{ x: "48%", y: "55%" }}
      />
      <GlassStack
        count={slats}
        orientation="vertical"
        blur="xl"
        highlight="default"
        blend="overlay"
        highlightAngle={268.16}
        noise
        paneGrain={0.9}
      />
    </GlassScene>
  );
}
