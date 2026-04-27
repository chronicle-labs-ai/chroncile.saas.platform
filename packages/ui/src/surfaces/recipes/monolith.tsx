"use client";

import type { ComponentPropsWithoutRef } from "react";

import { GlassScene } from "../glass-scene";
import { GlassStack } from "../glass-stack";
import { LightSource } from "../light-source";

export interface MonolithProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "color"
> {
  /** Number of diagonal slats. @default 10 */
  slats?: number;
}

/**
 * "Monolith" — Figma frame `19` (node 0:78).
 *
 * A massive, softly-tilted ember pill sliced on the diagonal by wide
 * slats. The 59.64° rotation on the SCENE (not the stack) is what lets
 * the light + stack rotate together and preserve per-pane blend +
 * backdrop-filter.
 */
export function Monolith({ slats = 10, ...rest }: MonolithProps) {
  return (
    <GlassScene
      background="void"
      aspectRatio="1920 / 1080"
      rotation={59.64}
      style={{ opacity: 0.9 }}
      {...rest}
    >
      <LightSource
        palette="emberMonolith"
        shape="pill"
        rotation={-30.36}
        size={{ w: 2338, h: 2380 }}
        position={{ x: "40%", y: "60%" }}
      />
      <GlassStack
        count={slats}
        orientation="vertical"
        blur="xl"
        highlight="default"
        blend="overlay"
        size={{ w: "160%", h: "160%" }}
        highlightAngle={268.52}
        noise
        paneGrain={0.8}
      />
    </GlassScene>
  );
}
