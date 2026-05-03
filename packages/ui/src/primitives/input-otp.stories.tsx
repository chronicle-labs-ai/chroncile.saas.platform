import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "./input-otp";

const meta: Meta = {
  title: "Primitives/InputOTP",
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj;

const Demo = ({ separator = false }: { separator?: boolean }) => {
  const [value, setValue] = React.useState("");
  return (
    <div className="flex flex-col items-center gap-s-3">
      <InputOTP maxLength={6} value={value} onChange={setValue}>
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        {separator ? <InputOTPSeparator /> : null}
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
      <span className="font-mono text-mono-sm text-l-ink-dim">
        value: {value || "—"}
      </span>
    </div>
  );
};

export const Default: Story = {
  render: () => <Demo />,
};

export const WithSeparator: Story = {
  render: () => <Demo separator />,
};
