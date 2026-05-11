import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { Minimap, generateMinimapBars } from "./minimap";

const meta: Meta<typeof Minimap> = {
  title: "Product/Minimap",
  component: Minimap,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Minimap>;

const bars = generateMinimapBars(260);

export const Default: Story = {
  render: () => {
    const [playing, setPlaying] = React.useState(false);
    return (
      <div className="w-[900px] rounded-md border border-hairline bg-surface-01">
        <Minimap
          bars={bars}
          playhead={38}
          range={[22, 56]}
          onPlay={() => setPlaying((p) => !p)}
          playing={playing}
          readoutLeft={
            <>
              Replay · <b className="text-ink-hi font-normal">turn 06 / 11</b>
            </>
          }
          readoutRight={
            <>
              <b className="text-ink-hi font-normal">14:10:02</b> → 14:12:04
            </>
          }
        />
      </div>
    );
  },
};
