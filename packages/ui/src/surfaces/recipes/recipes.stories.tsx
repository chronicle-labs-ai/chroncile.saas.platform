import type { Meta, StoryObj } from "@storybook/react";

import { Blinds } from "./blinds";
import { Dawn } from "./dawn";
import { Diagonal } from "./diagonal";
import { Dusk } from "./dusk";
import { Ember } from "./ember";
import { Monolith } from "./monolith";

const meta: Meta = {
  title: "Surfaces/Recipes",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

const Frame = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <figure className="flex flex-col gap-s-2">
    <div className="h-[360px] overflow-hidden rounded-md border border-hairline">
      {children}
    </div>
    <figcaption className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
      {label}
    </figcaption>
  </figure>
);

export const All: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-s-6">
      <Frame label="Blinds · Figma frame 56">
        <Blinds />
      </Frame>
      <Frame label="Dusk · Figma frame 15 (title)">
        <Dusk />
      </Frame>
      <Frame label="Monolith · Figma frame 19">
        <Monolith />
      </Frame>
      <Frame label="Diagonal · Figma frame 18">
        <Diagonal />
      </Frame>
      <Frame label="Ember · Figma frame 20">
        <Ember />
      </Frame>
      <Frame label="Dawn · Figma frame 17 (paper)">
        <Dawn />
      </Frame>
    </div>
  ),
};

export const BlindsStory: StoryObj = {
  name: "Blinds",
  render: () => <Blinds />,
};
export const DuskStory: StoryObj = {
  name: "Dusk",
  render: () => <Dusk />,
};
export const MonolithStory: StoryObj = {
  name: "Monolith",
  render: () => <Monolith />,
};
export const DiagonalStory: StoryObj = {
  name: "Diagonal",
  render: () => <Diagonal />,
};
export const EmberStory: StoryObj = {
  name: "Ember",
  render: () => <Ember />,
};
export const DawnStory: StoryObj = {
  name: "Dawn",
  render: () => <Dawn />,
};
