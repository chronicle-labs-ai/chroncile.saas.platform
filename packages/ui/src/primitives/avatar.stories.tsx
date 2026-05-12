import type { Meta, StoryObj } from "@storybook/react";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
  deriveInitials,
} from "./avatar";

const meta: Meta<typeof Avatar> = {
  title: "Primitives/Avatar",
  component: Avatar,
  parameters: { layout: "centered" },
  argTypes: {
    size: { control: "radio", options: ["xs", "sm", "md", "lg", "xl"] },
    shape: { control: "radio", options: ["circle", "square"] },
    tone: {
      control: "radio",
      options: [
        "neutral",
        "teal",
        "amber",
        "green",
        "orange",
        "pink",
        "violet",
        "ember",
        "red",
      ],
    },
  },
  args: { size: "md", shape: "circle", tone: "neutral" },
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>{deriveInitials("Ayman Saleh")}</AvatarFallback>
    </Avatar>
  ),
};
export default meta;
type Story = StoryObj<typeof Avatar>;

/**
 * Default — initials fallback only. Renders the `AvatarFallback`
 * directly because no `AvatarImage` is provided.
 */
export const Initials: Story = {};

/**
 * With image — Radix's `Avatar.Image` handles loading state. If the
 * image fails or is still loading, the fallback shows automatically.
 */
export const WithImage: Story = {
  render: () => (
    <Avatar size="md">
      <AvatarImage
        src="https://github.com/shadcn.png"
        alt="@shadcn"
      />
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  ),
};

/**
 * Sizes — `xs` / `sm` / `md` / `lg` / `xl` (20 / 24 / 32 / 40 / 48 px).
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-s-3">
      {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
        <Avatar key={size} size={size}>
          <AvatarFallback>{deriveInitials("Ayman Saleh")}</AvatarFallback>
        </Avatar>
      ))}
    </div>
  ),
};

/**
 * Shapes — `circle` (default, `rounded-full`) and `square`
 * (`rounded-md` = 6 px, matches the dashboard sidebar identity tile).
 */
export const Shapes: Story = {
  render: () => (
    <div className="flex items-center gap-s-3">
      <Avatar shape="circle">
        <AvatarFallback>{deriveInitials("Ayman Saleh")}</AvatarFallback>
      </Avatar>
      <Avatar shape="square">
        <AvatarFallback>{deriveInitials("Ayman Saleh")}</AvatarFallback>
      </Avatar>
    </div>
  ),
};

/**
 * Tones — neutral / teal / amber / green / orange / pink / violet /
 * ember / red. Mirrors `LabelColor` so workspace tints, label hues,
 * and avatar tints all share the same palette.
 */
export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-s-3">
      {(
        [
          "neutral",
          "teal",
          "amber",
          "green",
          "orange",
          "pink",
          "violet",
          "ember",
          "red",
        ] as const
      ).map((tone) => (
        <Avatar key={tone} tone={tone}>
          <AvatarFallback>{tone[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
      ))}
    </div>
  ),
};

/**
 * Avatar with a status badge in the bottom-right (online indicator).
 */
export const WithBadge: Story = {
  render: () => (
    <div className="flex items-center gap-s-4">
      <Avatar>
        <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
        <AvatarFallback>CN</AvatarFallback>
        <AvatarBadge tone="green" />
      </Avatar>
      <Avatar>
        <AvatarFallback>{deriveInitials("Maya R")}</AvatarFallback>
        <AvatarBadge tone="amber" />
      </Avatar>
      <Avatar>
        <AvatarFallback>{deriveInitials("Out User")}</AvatarFallback>
        <AvatarBadge tone="red" />
      </Avatar>
    </div>
  ),
};

/**
 * Avatar group — overlapping cluster with `ring-2` separator. Use for
 * member chips, contributor lists, recent viewers, etc.
 */
export const Group: Story = {
  render: () => (
    <AvatarGroup>
      <Avatar>
        <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
        <AvatarFallback>CN</AvatarFallback>
      </Avatar>
      <Avatar tone="ember">
        <AvatarFallback>AS</AvatarFallback>
      </Avatar>
      <Avatar tone="teal">
        <AvatarFallback>MR</AvatarFallback>
      </Avatar>
      <Avatar tone="violet">
        <AvatarFallback>JK</AvatarFallback>
      </Avatar>
    </AvatarGroup>
  ),
};

/**
 * Avatar group with a `+N` counter — when you have more members than
 * fit visually, cap the cluster and show the remainder count.
 */
export const GroupWithCount: Story = {
  render: () => (
    <AvatarGroup>
      <Avatar>
        <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
        <AvatarFallback>CN</AvatarFallback>
      </Avatar>
      <Avatar tone="ember">
        <AvatarFallback>AS</AvatarFallback>
      </Avatar>
      <Avatar tone="teal">
        <AvatarFallback>MR</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+5</AvatarGroupCount>
    </AvatarGroup>
  ),
};
