import type { Meta, StoryObj } from "@storybook/react";
import {
  RunsTable,
  RunsTableCell,
  RunsTableHead,
  RunsTableHeader,
  RunsTableRow,
  RunName,
  SimBar,
  Verdict,
} from "./runs-table";
import { TurnDiffStrip } from "./turn-diff-strip";

const meta: Meta<typeof RunsTable> = {
  title: "Product/RunsTable",
  component: RunsTable,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof RunsTable>;

export const SuiteResults: Story = {
  render: () => (
    <div className="overflow-hidden rounded-md border border-hairline bg-surface-01 w-[960px]">
      <RunsTable>
        <RunsTableHead>
          <RunsTableRow>
            <RunsTableHeader>Scenario</RunsTableHeader>
            <RunsTableHeader>Turns</RunsTableHeader>
            <RunsTableHeader>Similarity</RunsTableHeader>
            <RunsTableHeader>Turn diff</RunsTableHeader>
            <RunsTableHeader>Latency Δ</RunsTableHeader>
            <RunsTableHeader>Verdict</RunsTableHeader>
          </RunsTableRow>
        </RunsTableHead>
        <tbody>
          <RunsTableRow>
            <RunsTableCell>
              <RunName
                name="Refund escalation — wrong address"
                sub="trace_cus_demo_01 · critical"
              />
            </RunsTableCell>
            <RunsTableCell>11</RunsTableCell>
            <RunsTableCell>
              <SimBar value={62} tone="lo" /> 62.1%
            </RunsTableCell>
            <RunsTableCell>
              <TurnDiffStrip
                turns={[
                  "hit",
                  "hit",
                  "hit",
                  "hit",
                  "miss",
                  "hit",
                  "miss",
                  "empty",
                  "empty",
                  "empty",
                  "empty",
                ]}
              />
            </RunsTableCell>
            <RunsTableCell className="text-event-red">+1.4s</RunsTableCell>
            <RunsTableCell>
              <Verdict kind="fail" />
            </RunsTableCell>
          </RunsTableRow>
          <RunsTableRow>
            <RunsTableCell>
              <RunName
                name="Chargeback dispute"
                sub="trace_cus_ent_22 · billing"
              />
            </RunsTableCell>
            <RunsTableCell>14</RunsTableCell>
            <RunsTableCell>
              <SimBar value={98} tone="hi" /> 98.4%
            </RunsTableCell>
            <RunsTableCell>
              <TurnDiffStrip turns={Array(14).fill("hit")} />
            </RunsTableCell>
            <RunsTableCell className="text-event-green">−0.2s</RunsTableCell>
            <RunsTableCell>
              <Verdict kind="pass" />
            </RunsTableCell>
          </RunsTableRow>
          <RunsTableRow>
            <RunsTableCell>
              <RunName
                name="Out-of-stock replacement"
                sub="trace_cus_ss_11 · commerce"
              />
            </RunsTableCell>
            <RunsTableCell>9</RunsTableCell>
            <RunsTableCell>
              <SimBar value={84} tone="md" /> 84.2%
            </RunsTableCell>
            <RunsTableCell>
              <TurnDiffStrip
                turns={[
                  "hit",
                  "hit",
                  "hit",
                  "miss",
                  "hit",
                  "hit",
                  "hit",
                  "hit",
                  "hit",
                ]}
              />
            </RunsTableCell>
            <RunsTableCell className="text-ink-dim">+0.1s</RunsTableCell>
            <RunsTableCell>
              <Verdict kind="partial" />
            </RunsTableCell>
          </RunsTableRow>
        </tbody>
      </RunsTable>
    </div>
  ),
};
