"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { GlassScene } from "../glass-scene";
import { GlassStack } from "../glass-stack";
import { LightSource } from "../light-source";

export interface DuskProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "color"
> {
  /** Optional overlay content (e.g. a wordmark). */
  children?: ReactNode;
  /** Number of slats. @default 11 */
  slats?: number;
}

/**
 * "Dusk" — Figma frame `15` (node 0:1), the title scene.
 *
 * A severely rotated pill of ember glows through a diagonal stack of
 * slats in the lower-left corner of a mostly-black frame. Pair with
 * centered serif text for the "Gradients & Glass" title treatment.
 */
export function Dusk({ slats = 11, children, ...rest }: DuskProps) {
  // Scene-level rotation rotates light + stack together, keeping the
  // pane's blend and backdrop-filter able to sample the light source.
  return (
    <GlassScene
      background="obsidian"
      aspectRatio="1920 / 1080"
      rotation={-45}
      {...rest}
    >
      <LightSource
        palette="ember"
        shape="pill"
        rotation={-73}
        size={{ w: 600, h: 1900 }}
        position={{ x: "15%", y: "75%" }}
        opacity={0.9}
      />
      <GlassStack
        count={slats}
        orientation="vertical"
        blur="xl"
        highlight="default"
        blend="overlay"
        size={{ w: "140%", h: "140%" }}
        position={{ x: "15%", y: "75%" }}
        highlightAngle={268.16}
        noise
        paneGrain={0.8}
      />
      {children ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          {children}
        </div>
      ) : null}
    </GlassScene>
  );
}
