import type { Meta, StoryObj } from "@storybook/react";

import { Avatar, AvatarFallback } from "./avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";

const meta: Meta = {
  title: "Primitives/HoverCard",
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger asChild>
        <a
          href="#"
          className="font-sans text-[13px] text-ember underline-offset-4 hover:underline"
        >
          @eve
        </a>
      </HoverCardTrigger>
      <HoverCardContent>
        <div className="flex items-start gap-s-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback>EV</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-[2px]">
            <span className="font-sans text-[13px] font-medium text-l-ink">
              Eve Vance
            </span>
            <span className="font-sans text-[12px] text-l-ink-lo">
              Lead engineer · Workspace #chronicle-eu
            </span>
            <span className="mt-[6px] font-mono text-[11px] text-l-ink-dim">
              Last active 4m ago
            </span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
};
