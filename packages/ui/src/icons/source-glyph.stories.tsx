import type { Meta, StoryObj } from "@storybook/react";
import { SOURCE_GLYPH_IDS, SourceGlyph } from "./source-glyph";

const meta: Meta<typeof SourceGlyph> = {
  title: "Icons/SourceGlyph",
  component: SourceGlyph,
  parameters: { layout: "padded" },
  argTypes: {
    id: { control: "select", options: SOURCE_GLYPH_IDS as unknown as string[] },
    size: { control: { type: "number", min: 12, max: 64 } },
  },
  args: { id: "intercom", size: 24 },
};
export default meta;
type Story = StoryObj<typeof SourceGlyph>;

export const Default: Story = {
  render: (args) => <SourceGlyph {...args} />,
};

export const Catalog: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-s-4">
      {SOURCE_GLYPH_IDS.map((id) => (
        <div
          key={id}
          className="flex flex-col items-center gap-s-2 rounded-sm border border-hairline bg-surface-01 p-s-4"
        >
          <span className="text-ink-hi">
            <SourceGlyph id={id} size={28} />
          </span>
          <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
            {id}
          </span>
        </div>
      ))}
    </div>
  ),
};

export const Tinted: Story = {
  render: () => {
    const tints: { id: (typeof SOURCE_GLYPH_IDS)[number]; color: string }[] = [
      { id: "intercom", color: "var(--c-event-teal)" },
      { id: "stripe", color: "var(--c-event-green)" },
      { id: "shopify", color: "var(--c-event-amber)" },
      { id: "slack", color: "var(--c-event-pink)" },
      { id: "linear", color: "var(--c-event-violet)" },
    ];
    return (
      <div className="flex items-center gap-s-4">
        {tints.map((t) => (
          <SourceGlyph key={t.id} id={t.id} color={t.color} size={32} />
        ))}
      </div>
    );
  },
};
