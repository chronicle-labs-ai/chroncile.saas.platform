import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { TraceRow } from "./trace-row";
import { GroupHead } from "../layout/group-head";
import { Status } from "../primitives/status";

const meta: Meta<typeof TraceRow> = {
  title: "Product/TraceRow",
  component: TraceRow,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof TraceRow>;

export const Default: Story = {
  render: () => (
    <div className="w-[920px] border border-l-border bg-l-surface">
      <TraceRow
        id="CHR-1284"
        priority="urgent"
        title="Refund · wrong shipping address"
        subMeta="14:55 · 3m 18s · Sarah Chen · EU"
        events={[
          { lane: "teal" },
          { lane: "amber" },
          { lane: "green" },
          { lane: "ember", weight: 2 },
          { lane: "pink" },
          { lane: "green" },
        ]}
        meta="3m 18s"
        assignee="SC"
      />
    </div>
  ),
};

export const Lane: Story = {
  render: () => {
    function Demo() {
      const [sel, setSel] = React.useState("CHR-1284");
      const rows = [
        {
          id: "CHR-1285",
          priority: "high" as const,
          title: "Bulk import · validation failures",
          subMeta: "14:55 · 3m 18s",
          events: [
            { lane: "teal" as const },
            { lane: "violet" as const },
            { lane: "red" as const, weight: 2 },
          ],
          meta: "3m 18s",
          assignee: "GX",
        },
        {
          id: "CHR-1284",
          priority: "urgent" as const,
          title: "Refund · wrong shipping address",
          subMeta: "Sarah Chen · EU",
          events: [
            { lane: "teal" as const },
            { lane: "amber" as const },
            { lane: "green" as const },
            { lane: "ember" as const, weight: 2 },
            { lane: "pink" as const },
            { lane: "green" as const },
          ],
          meta: "Failed",
          assignee: "SC",
        },
        {
          id: "CHR-1278",
          priority: "med" as const,
          title: "p95 latency spike · ticket-fetch",
          subMeta: "14:48 · ops",
          events: [
            { lane: "orange" as const, weight: 2 },
            { lane: "orange" as const },
          ],
          meta: "3m 48s",
          assignee: "SYS",
        },
      ];
      return (
        <div className="w-[920px] border border-l-border bg-l-surface">
          <GroupHead>
            <Status kind="inprogress" />
            <span>In progress</span>
            <GroupHead.Count>{rows.length}</GroupHead.Count>
          </GroupHead>
          {rows.map((r) => (
            <TraceRow
              key={r.id}
              {...r}
              selected={sel === r.id}
              onSelect={() => setSel(r.id)}
            />
          ))}
        </div>
      );
    }
    return <Demo />;
  },
};
