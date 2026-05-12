import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { durations, easings } from "../../tokens/motion";

function MotionScale() {
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => setT((v) => (v + 1) % 2), 1800);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col gap-s-10 p-s-10">
      <section>
        <div className="font-mono text-mono uppercase tracking-eyebrow text-ember mb-s-4">
          Durations
        </div>
        <div className="flex flex-col gap-s-4">
          {Object.entries(durations).map(([k, v]) => (
            <div key={k} className="flex items-center gap-s-5">
              <span className="w-[80px] font-mono text-mono-sm text-ink-dim">
                {k}
              </span>
              <span className="w-[100px] font-mono text-mono-sm text-ink-lo">
                {v}
              </span>
              <div className="h-[6px] flex-1 rounded-[3px] bg-surface-02 overflow-hidden">
                <div
                  className="h-full bg-ember"
                  style={{
                    width: t ? "80%" : "10%",
                    transition: `width ${v} var(--ease-out)`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="font-mono text-mono uppercase tracking-eyebrow text-ember mb-s-4">
          Easings
        </div>
        <div className="grid grid-cols-2 gap-s-4">
          {Object.entries(easings).map(([k, v]) => (
            <div
              key={k}
              className="rounded-md border border-hairline bg-surface-01 p-s-5"
            >
              <div className="mb-s-3 font-mono text-mono-sm text-ink-hi">
                {k}
              </div>
              <div className="font-mono text-mono-sm text-ink-dim">{v}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const meta: Meta<typeof MotionScale> = {
  title: "Foundations/Motion",
  component: MotionScale,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof MotionScale>;
export const Scale: Story = { render: () => <MotionScale /> };
