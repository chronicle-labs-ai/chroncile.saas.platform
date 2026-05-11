import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { StepConnect, type ConnectState } from "./step-connect";
import { OnboardingShell } from "./onboarding-shell";
import { LIGHT_PARAMS, MOBILE_PARAMS } from "./_story-helpers";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <OnboardingShell currentStep="connect">{children}</OnboardingShell>
);

const meta: Meta<typeof StepConnect> = {
  title: "Onboarding/StepConnect",
  component: StepConnect,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof StepConnect>;

export const Empty: Story = {
  render: () => {
    const [v, setV] = React.useState<ConnectState>({
      connected: [],
      backfills: {},
    });
    return (
      <Frame>
        <StepConnect
          value={v}
          onChange={setV}
          onNext={() => alert("next " + v.connected.join(","))}
        />
      </Frame>
    );
  },
};

export const WithDetected: Story = {
  render: () => {
    const [v, setV] = React.useState<ConnectState>({
      connected: [],
      backfills: {},
      intendedSources: ["intercom", "shopify", "stripe"],
    });
    return (
      <Frame>
        <StepConnect value={v} onChange={setV} />
      </Frame>
    );
  },
};

export const Sandbox: Story = {
  render: () => {
    const [v, setV] = React.useState<ConnectState>({
      connected: [],
      backfills: {},
      sandbox: true,
    });
    return (
      <Frame>
        <StepConnect value={v} onChange={setV} />
      </Frame>
    );
  },
};

export const ConnectedWithBackfills: Story = {
  render: () => {
    const [v, setV] = React.useState<ConnectState>({
      connected: ["intercom", "stripe"],
      backfills: {
        intercom: {
          status: "running",
          progress: 0.42,
          windowDays: 30,
          entities: ["conversations", "contacts"],
          estEvents: 6750,
        },
        stripe: {
          status: "done",
          progress: 1,
          windowDays: 90,
          entities: ["charges", "refunds"],
          estEvents: 25200,
        },
      },
      intendedSources: ["intercom", "stripe", "shopify"],
    });
    return (
      <Frame>
        <StepConnect value={v} onChange={setV} />
      </Frame>
    );
  },
};

/*
 * Single source mid-backfill — focused view of the inline progress
 * strip, the BACKFILLING N% chip, and the running ember dot in the
 * summary bar without other rows competing for attention.
 */
export const BackfillRunning: Story = {
  render: () => {
    const [v, setV] = React.useState<ConnectState>({
      connected: ["intercom"],
      backfills: {
        intercom: {
          status: "running",
          progress: 0.31,
          windowDays: 30,
          entities: ["conversations"],
          estEvents: 8400,
        },
      },
      intendedSources: ["intercom"],
    });
    return (
      <Frame>
        <StepConnect value={v} onChange={setV} />
      </Frame>
    );
  },
};

/*
 * Auto-opens every category to reveal the 2-col tile grid + the
 * dynamic search empty state. Reviewers can compare tile density
 * against the detected-shelf row variant above.
 */
export const SearchActive: Story = {
  render: () => {
    const [v, setV] = React.useState<ConnectState>({
      connected: ["stripe"],
      backfills: {},
      intendedSources: ["stripe"],
    });
    return (
      <Frame>
        {/*
         * Pre-fills the search box via a controlled effect, since
         * `query` is internal to StepConnect — we mount, then
         * dispatch input on the rendered field. Keeps the static
         * snapshot self-contained without needing extra props.
         */}
        <SearchPrefill query="stripe">
          <StepConnect value={v} onChange={setV} />
        </SearchPrefill>
      </Frame>
    );
  },
};

function SearchPrefill({
  query,
  children,
}: {
  query: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const input = ref.current?.querySelector<HTMLInputElement>(
      'input[type="text"], input:not([type])'
    );
    if (!input || input.value === query) return;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    setter?.call(input, query);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, [query]);
  return <div ref={ref}>{children}</div>;
}

export const Mobile: Story = {
  parameters: { layout: "fullscreen", ...MOBILE_PARAMS },
  render: () => {
    const [v, setV] = React.useState<ConnectState>({
      connected: [],
      backfills: {},
      intendedSources: ["intercom", "shopify", "stripe"],
    });
    return (
      <Frame>
        <StepConnect value={v} onChange={setV} />
      </Frame>
    );
  },
};

export const LightTheme: Story = {
  parameters: { layout: "fullscreen", ...LIGHT_PARAMS },
  render: () => {
    const [v, setV] = React.useState<ConnectState>({
      connected: ["intercom", "stripe"],
      backfills: {
        intercom: {
          status: "running",
          progress: 0.42,
          windowDays: 30,
          entities: ["conversations", "contacts"],
          estEvents: 6750,
        },
        stripe: {
          status: "done",
          progress: 1,
          windowDays: 90,
          entities: ["charges", "refunds"],
          estEvents: 25200,
        },
      },
      intendedSources: ["intercom", "stripe", "shopify"],
    });
    return (
      <Frame>
        <StepConnect value={v} onChange={setV} />
      </Frame>
    );
  },
};
