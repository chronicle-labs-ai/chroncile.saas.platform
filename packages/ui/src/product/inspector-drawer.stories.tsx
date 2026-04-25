import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { InspectorDrawer } from "./inspector-drawer";
import { Status } from "../primitives/status";
import { Priority } from "../primitives/priority";
import { Button } from "../primitives/button";

const meta: Meta<typeof InspectorDrawer> = {
  title: "Product/InspectorDrawer",
  component: InspectorDrawer,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof InspectorDrawer>;

export const Open: Story = {
  render: () => {
    function Demo() {
      const [open, setOpen] = React.useState(true);
      return (
        <div className="relative h-[560px] w-[1000px] overflow-hidden border border-l-border bg-l-surface">
          <div className="flex h-full items-center justify-center text-l-ink-lo">
            <Button onClick={() => setOpen((o) => !o)}>
              Toggle inspector
            </Button>
          </div>
          <InspectorDrawer open={open} onClose={() => setOpen(false)}>
            <InspectorDrawer.Header eyebrow="CHR-1284 · TRACE">
              Refund · wrong shipping address
            </InspectorDrawer.Header>
            <InspectorDrawer.Body>
              <InspectorDrawer.Field label="Status">
                <Status kind="canceled" /> Failed
              </InspectorDrawer.Field>
              <InspectorDrawer.Field label="Priority">
                <Priority level="urgent" /> Urgent
              </InspectorDrawer.Field>
              <InspectorDrawer.Field label="Customer">
                <span
                  className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-pill text-[9px] font-semibold text-white"
                  style={{
                    background: "linear-gradient(135deg, #709188, #3e547c)",
                  }}
                >
                  SC
                </span>
                Sarah Chen
              </InspectorDrawer.Field>
              <InspectorDrawer.Field label="Region">EU</InspectorDrawer.Field>
              <InspectorDrawer.Field label="Started">
                14:55:12
              </InspectorDrawer.Field>
              <InspectorDrawer.Field label="Duration">
                3m 18s
              </InspectorDrawer.Field>
            </InspectorDrawer.Body>
            <InspectorDrawer.Footer>
              <Button variant="secondary">Open trace</Button>
              <Button variant="primary">Run replay</Button>
            </InspectorDrawer.Footer>
          </InspectorDrawer>
        </div>
      );
    }
    return <Demo />;
  },
};
