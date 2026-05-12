import type { Meta, StoryObj } from "@storybook/react";

import { GlassScene } from "./glass-scene";
import { GlassStack } from "./glass-stack";
import { LightSource } from "./light-source";

const meta: Meta<typeof GlassScene> = {
  title: "Surfaces/GlassScene",
  component: GlassScene,
  parameters: { layout: "padded" },
  argTypes: {
    background: {
      control: "select",
      options: ["obsidian", "void", "paper", "bone"],
    },
    rotation: { control: { type: "number", min: -180, max: 180, step: 1 } },
  },
  args: { background: "obsidian", aspectRatio: "16 / 9", rotation: 0 },
};
export default meta;
type Story = StoryObj<typeof GlassScene>;

export const WithContents: Story = {
  render: (args) => (
    <div className="h-[420px]">
      <GlassScene {...args}>
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
          blur="xl"
          highlight="default"
          highlightAngle={268.16}
          noise
          paneGrain={0.8}
        />
      </GlassScene>
    </div>
  ),
};

export const SceneRotation: Story = {
  name: "Rotation — scene level (preserves blend)",
  args: { rotation: -45 },
  render: (args) => (
    <div className="h-[420px] overflow-hidden rounded-md border border-hairline">
      <GlassScene {...args}>
        <LightSource
          palette="ember"
          shape="pill"
          rotation={-73}
          size={{ w: 600, h: 1900 }}
          position={{ x: "15%", y: "75%" }}
          opacity={0.9}
        />
        <GlassStack
          count={11}
          blur="xl"
          size={{ w: "140%", h: "140%" }}
          position={{ x: "15%", y: "75%" }}
          highlightAngle={268.16}
          noise
          paneGrain={0.8}
        />
      </GlassScene>
    </div>
  ),
};
