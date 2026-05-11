import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { ConnectorModalShell } from "./connector-modal-shell";
import { Button } from "../primitives/button";
import { SourceGlyph } from "../icons/source-glyph";

const meta: Meta<typeof ConnectorModalShell> = {
  title: "Connectors/ConnectorModalShell",
  component: ConnectorModalShell,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof ConnectorModalShell>;

const STEPS = [
  { id: "auth", label: "Authorize" },
  { id: "scopes", label: "Scopes" },
  { id: "review", label: "Review" },
];

function BasicDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <>
      <Button onPress={() => setOpen(true)}>Open shell</Button>
      <ConnectorModalShell
        isOpen={open}
        onClose={() => setOpen(false)}
        glyph={<SourceGlyph id="stripe" size={18} />}
        glyphTint="var(--c-event-green)"
        title="Connect Stripe"
        sub="Read-only access to charges, customers, subscriptions"
        footer={{
          status: (
            <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
              ● test mode
            </span>
          ),
          actions: (
            <>
              <Button variant="ghost" onPress={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="ember">Continue →</Button>
            </>
          ),
        }}
      >
        <div className="text-body-sm">
          Body content goes here. The shell handles the head, footer, glyph
          tint, and stepper dots.
        </div>
      </ConnectorModalShell>
    </>
  );
}

function WithStepperDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <ConnectorModalShell
      isOpen={open}
      onClose={() => setOpen(false)}
      glyph={<SourceGlyph id="hubspot" size={18} />}
      glyphTint="var(--c-event-orange)"
      title="Connect HubSpot"
      sub="Step 2 of 3 · Pick the objects you care about"
      stepperDots={{ steps: STEPS, currentIndex: 1 }}
      size="lg"
      footer={{
        actions: (
          <>
            <Button variant="ghost">Back</Button>
            <Button variant="ember">Next →</Button>
          </>
        ),
      }}
    >
      <div className="text-body-sm">
        Wider modal (640 px) with the stepper-dot trail visible in the head.
      </div>
    </ConnectorModalShell>
  );
}

function WideXLDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <ConnectorModalShell
      isOpen={open}
      onClose={() => setOpen(false)}
      glyph={<SourceGlyph id="salesforce" size={18} />}
      glyphTint="var(--c-event-teal)"
      title="Connect Salesforce"
      sub="Walkthrough · paste credentials → authorize → done"
      size="xl"
      footer={
        <Button variant="ember" onPress={() => setOpen(false)}>
          Close
        </Button>
      }
    >
      <div className="text-body-sm">
        Full-width 760 px shell — used by the HubSpot mapping table and the
        video composites.
      </div>
    </ConnectorModalShell>
  );
}

export const Basic: Story = { render: () => <BasicDemo /> };
export const WithStepper: Story = { render: () => <WithStepperDemo /> };
export const WideXL: Story = { render: () => <WideXLDemo /> };
