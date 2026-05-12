import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import {
  GlassScene,
  LightSource,
  GlassStack,
  AmbientBackground,
  Blinds,
  Dawn,
  Diagonal,
  Dusk,
  Ember,
  Monolith,
} from "../../surfaces";

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-s-4">
      <div className="font-mono text-mono uppercase tracking-eyebrow text-ember">
        {label}
      </div>
      {children}
    </section>
  );
}

function GradientsAndGlass() {
  return (
    <div className="flex flex-col gap-s-10 p-s-10">
      <Section label="Recipes — Figma frames, 1:1">
        <div className="grid grid-cols-2 gap-s-4">
          <div className="h-[320px] overflow-hidden rounded-md border border-hairline">
            <Blinds />
          </div>
          <div className="h-[320px] overflow-hidden rounded-md border border-hairline">
            <Dusk />
          </div>
          <div className="h-[320px] overflow-hidden rounded-md border border-hairline">
            <Monolith />
          </div>
          <div className="h-[320px] overflow-hidden rounded-md border border-hairline">
            <Diagonal />
          </div>
          <div className="h-[320px] overflow-hidden rounded-md border border-hairline">
            <Ember />
          </div>
          <div className="h-[320px] overflow-hidden rounded-md border border-hairline">
            <Dawn />
          </div>
        </div>
      </Section>

      <Section label="Primitive composition — LightSource + GlassStack">
        <div className="h-[360px] overflow-hidden rounded-md border border-hairline">
          <GlassScene background="obsidian" aspectRatio="1920 / 1080">
            <LightSource
              palette="ember"
              shape="pill"
              rotation={-118.42}
              flipY
              size={{ w: 550, h: 2800 }}
              position={{ x: "48%", y: "55%" }}
            />
            <GlassStack
              count={11}
              orientation="vertical"
              blur="xl"
              highlight="default"
              blend="overlay"
              highlightAngle={268.16}
              noise
              paneGrain={0.8}
            />
          </GlassScene>
        </div>
      </Section>

      <Section label="Ambient background (subtle page-bg glow)">
        <div className="relative isolate min-h-[220px] overflow-hidden rounded-md border border-hairline bg-surface-00 p-s-10">
          <AmbientBackground />
          <p className="relative z-10 font-sans text-[18px] font-light text-ink">
            The ambient version is much softer — it sits behind marketing
            content without competing with it.
          </p>
        </div>
      </Section>
    </div>
  );
}

const meta: Meta<typeof GradientsAndGlass> = {
  title: "Foundations/Gradients & Glass",
  component: GradientsAndGlass,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof GradientsAndGlass>;
export const Showcase: Story = { render: () => <GradientsAndGlass /> };
