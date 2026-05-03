import type { Meta, StoryObj } from "@storybook/react";
import { fn, userEvent, within } from "@storybook/test";
import * as React from "react";

import { Button } from "../primitives/button";
import { AddConnectionPicker } from "./add-connection-picker";

const meta: Meta<typeof AddConnectionPicker> = {
  title: "Connections/AddConnectionPicker",
  component: AddConnectionPicker,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof AddConnectionPicker>;

const onConnected = fn();

function PickerDemo({
  initialOpen = false,
  alreadyConnected = [],
}: {
  initialOpen?: boolean;
  alreadyConnected?: ("stripe" | "slack" | "intercom")[];
}) {
  const [open, setOpen] = React.useState(initialOpen);
  return (
    <div className="min-h-screen bg-page p-6">
      <Button onPress={() => setOpen(true)}>Open picker</Button>
      <AddConnectionPicker
        isOpen={open}
        onClose={() => setOpen(false)}
        connectedIds={alreadyConnected}
        onConnected={(c) => {
          onConnected(c);
          setOpen(false);
        }}
      />
    </div>
  );
}

/**
 * Default — picker is closed on first paint. The "Open picker" trigger
 * is visible above the fold; the `play()` step opens it
 * programmatically so docs and visual regression always render the
 * open state without hiding the trigger button behind the modal
 * overlay.
 */
export const Default: Story = {
  render: () => <PickerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /open picker/i }));
  },
};

/**
 * Already-connected sources — Stripe, Slack, and Intercom render with
 * the connected indicator and are non-interactive. Confirms the
 * `StatusDot` indicator (was a literal Unicode bullet) and disabled
 * tile state work together.
 */
export const WithExistingConnections: Story = {
  render: () => (
    <PickerDemo
      initialOpen
      alreadyConnected={["stripe", "slack", "intercom"]}
    />
  ),
};

/**
 * Search — the picker auto-expands every category that contains a
 * match when the user types. The `play()` step types `stripe` and
 * confirms the Stripe tile becomes visible.
 */
export const Search: Story = {
  render: () => <PickerDemo initialOpen />,
  play: async ({ canvasElement }) => {
    /*
     * The picker portals into `document.body`, so we scope queries to
     * the page-level body to find the modal contents. `within` on the
     * canvasElement only sees the trigger.
     */
    const search = await within(document.body).findByPlaceholderText(
      /search.+sources/i,
    );
    await userEvent.type(search, "stripe");
    await within(document.body).findByText(/stripe/i);
  },
};
