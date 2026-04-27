"use client";

import type { ComponentPropsWithoutRef } from "react";

import { GlassScene } from "../glass-scene";
import { GlassStack } from "../glass-stack";
import { LightSource } from "../light-source";

export interface EmberProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "color"
> {
  /** Number of slats. @default 10 */
  slats?: number;
}

/**
 * "Ember" — Figma frame `20` (node 0:93).
 *
 * A tiny, almost-horizontal pill glows dimly through a stack of slats,
 * reading as a few faint lanterns floating in a black room. The
 * smallest and most restrained recipe — great for mood backgrounds
 * behind content.
 */
export function Ember({ slats = 10, ...rest }: EmberProps) {
  return (
    <GlassScene background="void" aspectRatio="1920 / 1080" {...rest}>
      <LightSource
        palette="emberSoft"
        shape="pill"
        rotation={-88.18}
        size={{ w: 141, h: 910 }}
        position={{ x: "50%", y: "55%" }}
        opacity={0.9}
      />
      <GlassStack
        count={slats}
        orientation="vertical"
        blur="lg"
        highlight="default"
        blend="overlay"
        size={{ w: "100%", h: "90%" }}
        highlightAngle={267.74}
        noise
        paneGrain={0.8}
      />
    </GlassScene>
  );
}
