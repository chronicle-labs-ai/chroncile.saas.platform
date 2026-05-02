import type { Meta, StoryObj } from "@storybook/react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import { Button } from "./button";
import { Separator } from "./separator";

const meta: Meta<typeof Card> = {
  title: "Primitives/Card",
  component: Card,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-[420px]">
      <CardHeader>
        <CardTitle>Backtest replay</CardTitle>
        <CardDescription>
          Last 24 hours of intercom traffic re-run against the new policy.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="font-sans text-[13px] text-l-ink-lo">
          12,400 traces processed. 7 anomalies detected. Average latency
          delta -34ms.
        </p>
      </CardContent>
      <CardFooter>
        <Button size="sm">Open report</Button>
      </CardFooter>
    </Card>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Card className="w-[420px]">
      <CardHeader>
        <CardTitle>Production API</CardTitle>
        <CardDescription>Doppler config: prd / chronicle-api</CardDescription>
        <CardAction>
          <Button size="sm" variant="ghost">
            Edit
          </Button>
        </CardAction>
      </CardHeader>
      <Separator />
      <CardContent>
        <p className="font-sans text-[13px] text-l-ink-lo">
          Auto-deploys on every merge to <code className="font-mono text-[12px]">main</code>.
        </p>
      </CardContent>
    </Card>
  ),
};
