"use client";

import type { ComponentPropsWithoutRef } from "react";

import { GlassScene } from "../glass-scene";
import { GlassStack } from "../glass-stack";
import { LightSource } from "../light-source";

export interface DawnProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "color"
> {
  /** Number of slats. @default 10 */
  slats?: number;
}

/**
 * "Dawn" — Figma frame `17` (node 0:48).
 *
 * A pastel, inverted version of the ember scene. The pill is rotated,
 * the stack sits on a light paper background at reduced opacity, and
 * the slats are blurred softer (99px) — producing a washed,
 * morning-light palette.
 */
export function Dawn({ slats = 10, ...rest }: DawnProps) {
  return (
    <GlassScene
      background="paper"
      aspectRatio="1920 / 1080"
      style={{ opacity: 0.92 }}
      {...rest}
    >
      <LightSource
        palette="emberSoft"
        shape="pill"
        rotation={32}
        size={{ w: 1105, h: 2398 }}
        position={{ x: "45%", y: "60%" }}
      />
      <GlassStack
        count={slats}
        orientation="vertical"
        blur="lg"
        highlight="default"
        blend="overlay"
        highlightAngle={267.74}
        noise
        paneGrain={0.8}
      />
    </GlassScene>
  );
}
