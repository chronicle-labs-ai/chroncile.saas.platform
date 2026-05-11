import type { Meta, StoryObj } from "@storybook/react";

import { GlassScene } from "./glass-scene";
import { GlassPane } from "./glass-pane";
import { LightSource } from "./light-source";

const meta: Meta<typeof GlassPane> = {
  title: "Surfaces/GlassPane",
  component: GlassPane,
  parameters: { layout: "padded" },
  argTypes: {
    blur: { control: "select", options: ["sm", "md", "lg", "xl", "2xl"] },
    highlight: { control: "radio", options: ["default", "soft"] },
  },
  args: { blur: "xl", highlight: "default" },
};
export default meta;
type Story = StoryObj<typeof GlassPane>;

export const Single: Story = {
  render: (args) => (
    <div className="h-[360px] overflow-hidden rounded-md border border-hairline">
      <GlassScene background="obsidian" aspectRatio="16 / 9">
        <LightSource
          palette="ember"
          shape="pill"
          rotation={-30}
          size={{ w: 700, h: 1600 }}
        />
        <GlassPane
          {...args}
          style={{
            position: "absolute",
            left: "25%",
            top: "10%",
            width: "50%",
            height: "80%",
          }}
        />
      </GlassScene>
    </div>
  ),
};
