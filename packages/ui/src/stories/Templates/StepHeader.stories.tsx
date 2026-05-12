import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import {
  AuthDisplay,
  AuthLede,
  StepFoot,
} from "../../auth/_internal";
import { AuthShell } from "../../auth/auth-shell";
import { ArrowLeftIcon, ArrowRightIcon } from "../../icons/glyphs";
import { Button } from "../../primitives/button";
import { Eyebrow } from "../../primitives/eyebrow";

/*
 * Templates / StepHeader
 *
 * Canonical rhythm for every screen inside `<AuthShell>` — the
 * Eyebrow + AuthDisplay + AuthLede + StepFoot trio plus the column
 * width. Use this story as the starting reference when authoring a
 * new onboarding / auth step so spacing, type scale, and animation
 * delays line up with the rest of the flow.
 *
 * The body is intentionally a thin placeholder; substitute the
 * step-specific block (form / picker / preview) between the lede
 * and the foot.
 */

const meta: Meta = {
  title: "Templates/StepHeader",
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

const Body = () => (
  <div className="cg-fade-up cg-fade-up-3 mt-s-6 rounded-sm border border-dashed border-hairline-strong px-s-4 py-s-8 text-center font-mono text-mono uppercase tracking-tactical text-ink-dim">
    Step body slot — drop the form / picker / preview here.
  </div>
);

export const Default: Story = {
  render: () => (
    <AuthShell topbar={false}>
      <div className="flex flex-col">
        <Eyebrow>Step 02</Eyebrow>
        <AuthDisplay>
          Connect your <em>data</em>.
        </AuthDisplay>
        <AuthLede>
          Pick the systems your agent reads from or writes to. Start with one
          — you can always add more.
        </AuthLede>
        <Body />
        <StepFoot
          back={
            <Button variant="ghost" leadingIcon={<ArrowLeftIcon />}>
              Back
            </Button>
          }
          next={
            <Button variant="ember" trailingIcon={<ArrowRightIcon />}>
              Continue
            </Button>
          }
        />
      </div>
    </AuthShell>
  ),
};

export const WithoutBack: Story = {
  render: () => (
    <AuthShell topbar={false}>
      <div className="flex flex-col">
        <Eyebrow>Step 01</Eyebrow>
        <AuthDisplay>
          Describe your <em>agent</em>.
        </AuthDisplay>
        <AuthLede>
          Tell us what it does in plain English. We&rsquo;ll spot the data it
          touches.
        </AuthLede>
        <Body />
        <StepFoot
          back={null}
          next={
            <Button variant="ember" trailingIcon={<ArrowRightIcon />}>
              Continue
            </Button>
          }
        />
      </div>
    </AuthShell>
  ),
};
