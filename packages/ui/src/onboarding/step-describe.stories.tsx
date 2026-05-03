import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { StepDescribe, type DescribeState } from "./step-describe";
import { OnboardingShell } from "./onboarding-shell";
import { LIGHT_PARAMS, MOBILE_PARAMS } from "./_story-helpers";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <OnboardingShell currentStep="describe">{children}</OnboardingShell>
);

const meta: Meta<typeof StepDescribe> = {
  title: "Onboarding/StepDescribe",
  component: StepDescribe,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof StepDescribe>;

export const Freeform: Story = {
  render: () => {
    const [v, setV] = React.useState<DescribeState>({ mode: "freeform" });
    return (
      <Frame>
        <StepDescribe
          value={v}
          onChange={setV}
          onNext={() => alert("next " + JSON.stringify(v.intendedSources))}
        />
      </Frame>
    );
  },
};

export const FreeformPrefilled: Story = {
  render: () => {
    const [v, setV] = React.useState<DescribeState>({
      mode: "freeform",
      prompt:
        "A support agent for our Shopify store that triages Intercom conversations and issues Stripe refunds.",
    });
    return (
      <Frame>
        <StepDescribe value={v} onChange={setV} disableAnimation />
      </Frame>
    );
  },
};

/*
 * Captures the mid-parse state — useful for reviewing the
 * `<ParseStrip>` "Reading_" typewriter beat without having to type
 * into the live story.
 */
export const FreeformParsing: Story = {
  render: () => {
    const [v, setV] = React.useState<DescribeState>({
      mode: "freeform",
      prompt:
        "A support agent for our Shopify store that triages Intercom conversations and issues Stripe refunds.",
    });
    /*
     * `disableAnimation` collapses the parse delay to ~50ms; we want
     * the parsing state to be observable in the screenshot, so leave
     * the default 380ms debounce in place.
     */
    return (
      <Frame>
        <StepDescribe value={v} onChange={setV} />
      </Frame>
    );
  },
};

export const Structured: Story = {
  render: () => {
    const [v, setV] = React.useState<DescribeState>({
      mode: "structured",
      name: "support-concierge",
      goal: "Resolve refunds in under 3 turns.",
      trigger: "New Intercom conversation",
    });
    return (
      <Frame>
        <StepDescribe value={v} onChange={setV} />
      </Frame>
    );
  },
};

export const Template: Story = {
  render: () => {
    const [v, setV] = React.useState<DescribeState>({ mode: "template" });
    return (
      <Frame>
        <StepDescribe value={v} onChange={setV} disableAnimation />
      </Frame>
    );
  },
};

/*
 * Pre-selects a template so the ember active chrome + "picked" chip
 * are immediately visible without the reviewer needing to click.
 */
export const TemplateSelected: Story = {
  render: () => {
    const [v, setV] = React.useState<DescribeState>({
      mode: "template",
      templateId: "support",
      name: "Support concierge",
      prompt:
        "A Shopify support agent that triages Intercom conversations, looks up orders, issues refunds in Stripe, and escalates to Slack.",
      intendedSources: ["intercom", "shopify", "stripe", "slack"],
    });
    return (
      <Frame>
        <StepDescribe value={v} onChange={setV} disableAnimation />
      </Frame>
    );
  },
};

export const Mobile: Story = {
  parameters: { layout: "fullscreen", ...MOBILE_PARAMS },
  render: () => {
    const [v, setV] = React.useState<DescribeState>({ mode: "freeform" });
    return (
      <Frame>
        <StepDescribe value={v} onChange={setV} disableAnimation />
      </Frame>
    );
  },
};

export const LightTheme: Story = {
  parameters: { layout: "fullscreen", ...LIGHT_PARAMS },
  render: () => {
    const [v, setV] = React.useState<DescribeState>({
      mode: "structured",
      name: "support-concierge",
      goal: "Resolve refunds in under 3 turns.",
      trigger: "New Intercom conversation",
    });
    return (
      <Frame>
        <StepDescribe value={v} onChange={setV} />
      </Frame>
    );
  },
};
