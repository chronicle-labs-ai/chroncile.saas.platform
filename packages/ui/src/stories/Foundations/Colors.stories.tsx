import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import {
  brandTokens,
  eventTokens,
  inkTokens,
  surfaceTokens,
} from "../../tokens/colors";

type Group = { name: string; tokens: Record<string, string>; notes?: string };

const groups: Group[] = [
  {
    name: "Surfaces",
    tokens: surfaceTokens,
    notes:
      "The canvas stack. 00 is app background, 01 default card, 02 elevated, 03 input/hover.",
  },
  {
    name: "Ink",
    tokens: inkTokens,
    notes:
      "Text hierarchy. `hi` for titles, `base` for body, `lo` for secondary, `dim`/`faint` for labels.",
  },
  {
    name: "Brand arc",
    tokens: brandTokens,
    notes:
      "Ember → bronze → gold → sage → bone. Used in the light-source gradient.",
  },
  {
    name: "Event palette",
    tokens: eventTokens,
    notes:
      "Per-stream hues. teal=support, amber=commerce, green=billing, orange=ops, pink=notify, violet=sandbox, red=fail, white=raw.",
  },
];

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex flex-col gap-s-2">
      <div
        className="h-[80px] w-full rounded-sm border border-hairline"
        style={{ background: value }}
      />
      <div className="flex items-baseline justify-between font-mono text-mono-sm">
        <span className="text-ink-hi">{name}</span>
        <span className="text-ink-dim">{value}</span>
      </div>
    </div>
  );
}

function AllColors() {
  return (
    <div className="flex flex-col gap-s-12">
      {groups.map((g) => (
        <section key={g.name} className="flex flex-col gap-s-4">
          <header>
            <div className="font-mono text-mono uppercase tracking-eyebrow text-ember">
              {g.name}
            </div>
            {g.notes ? (
              <p className="mt-s-2 max-w-[60ch] font-sans text-body-sm font-light text-ink-lo">
                {g.notes}
              </p>
            ) : null}
          </header>
          <div className="grid grid-cols-4 gap-s-4 md:grid-cols-5">
            {Object.entries(g.tokens).map(([k, v]) => (
              <Swatch key={k} name={k} value={v} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const meta: Meta<typeof AllColors> = {
  title: "Foundations/Colors",
  component: AllColors,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof AllColors>;

export const Palette: Story = {
  render: () => (
    <div className="p-s-10">
      <AllColors />
    </div>
  ),
};
