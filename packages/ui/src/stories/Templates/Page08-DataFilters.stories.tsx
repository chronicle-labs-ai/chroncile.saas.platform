import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { ChronHeader } from "../../layout/chron-header";
import { PageHeader } from "../../layout/page-header";
import { Eyebrow } from "../../primitives/eyebrow";
import { Tag } from "../../primitives/tag";
import {
  DataTableFilterBar,
  useDataTableFilters,
  type ColumnConfig,
  type FilterState,
} from "../../product/filters";
import {
  RunsTable,
  RunsTableCell,
  RunsTableHead,
  RunsTableHeader,
  RunsTableRow,
  RunName,
  SimBar,
  Verdict,
  type VerdictKind,
} from "../../product/runs-table";
import { Mono } from "../../typography/mono";

/* ----------------------------------------------------------------------- */
/* Dataset                                                                 */
/* ----------------------------------------------------------------------- */

type Run = {
  id: string;
  scenario: string;
  subtitle: string;
  status: VerdictKind;
  environment: "prod" | "staging" | "dev";
  owners: string[];
  turns: number;
  similarity: number;
  latencyDelta: string;
  latencyTone: "green" | "amber" | "red" | "dim";
};

const RUNS: Run[] = [
  {
    id: "r01",
    scenario: "Refund escalation — wrong address",
    subtitle: "trace_cus_demo_01 · critical",
    status: "fail",
    environment: "prod",
    owners: ["sc", "mk"],
    turns: 11,
    similarity: 62.1,
    latencyDelta: "+1.4s",
    latencyTone: "red",
  },
  {
    id: "r02",
    scenario: "Chargeback dispute",
    subtitle: "trace_cus_ent_22 · billing",
    status: "pass",
    environment: "prod",
    owners: ["mk"],
    turns: 14,
    similarity: 98.4,
    latencyDelta: "−0.2s",
    latencyTone: "green",
  },
  {
    id: "r03",
    scenario: "Out-of-stock replacement",
    subtitle: "trace_cus_ss_11 · commerce",
    status: "partial",
    environment: "staging",
    owners: ["sc", "jp"],
    turns: 9,
    similarity: 84.2,
    latencyDelta: "+0.1s",
    latencyTone: "amber",
  },
  {
    id: "r04",
    scenario: "Multi-tenant permission confusion",
    subtitle: "trace_cus_sso_07 · auth",
    status: "pass",
    environment: "prod",
    owners: ["jp"],
    turns: 22,
    similarity: 95.6,
    latencyDelta: "+0.4s",
    latencyTone: "dim",
  },
  {
    id: "r05",
    scenario: "Subscription pause edge case",
    subtitle: "trace_cus_ent_33 · billing",
    status: "pass",
    environment: "staging",
    owners: ["mk", "av"],
    turns: 7,
    similarity: 97.1,
    latencyDelta: "−0.3s",
    latencyTone: "green",
  },
  {
    id: "r06",
    scenario: "International shipping lookup",
    subtitle: "trace_cus_uk_12 · commerce",
    status: "fail",
    environment: "prod",
    owners: ["sc"],
    turns: 13,
    similarity: 58.7,
    latencyDelta: "+2.1s",
    latencyTone: "red",
  },
  {
    id: "r07",
    scenario: "Gift card redemption",
    subtitle: "trace_cus_gc_09 · commerce",
    status: "partial",
    environment: "dev",
    owners: ["jp", "av"],
    turns: 10,
    similarity: 78.3,
    latencyDelta: "+0.2s",
    latencyTone: "amber",
  },
  {
    id: "r08",
    scenario: "Double-charge reconciliation",
    subtitle: "trace_cus_ent_19 · billing",
    status: "pending",
    environment: "staging",
    owners: ["mk"],
    turns: 5,
    similarity: 0,
    latencyDelta: "—",
    latencyTone: "dim",
  },
];

const OWNERS = [
  { value: "sc", label: "Sarah Chen", tone: "teal" as const },
  { value: "mk", label: "Maya Kovač", tone: "violet" as const },
  { value: "jp", label: "Jordan Park", tone: "amber" as const },
  { value: "av", label: "Aaron Vasquez", tone: "pink" as const },
];

/* ----------------------------------------------------------------------- */
/* Columns                                                                 */
/* ----------------------------------------------------------------------- */

const COLUMNS: ColumnConfig<Run>[] = [
  {
    id: "status",
    label: "Status",
    type: "option",
    accessor: (r) => r.status,
    options: [
      { value: "pass", label: "Pass", tone: "green" },
      { value: "fail", label: "Fail", tone: "red" },
      { value: "partial", label: "Partial", tone: "amber" },
      { value: "pending", label: "Pending", tone: "neutral" },
    ],
  },
  {
    id: "environment",
    label: "Environment",
    type: "option",
    accessor: (r) => r.environment,
    options: [
      { value: "prod", label: "Production", tone: "ember" },
      { value: "staging", label: "Staging", tone: "teal" },
      { value: "dev", label: "Development", tone: "neutral" },
    ],
  },
  {
    id: "owners",
    label: "Owner",
    type: "multiOption",
    accessor: (r) => r.owners,
    options: OWNERS,
  },
  {
    id: "scenario",
    label: "Scenario",
    type: "text",
    accessor: (r) => r.scenario,
    placeholder: "Search scenario name\u2026",
  },
  {
    id: "turns",
    label: "Turns",
    type: "number",
    accessor: (r) => r.turns,
  },
  {
    id: "similarity",
    label: "Similarity",
    type: "number",
    accessor: (r) => r.similarity,
  },
];

/* ----------------------------------------------------------------------- */
/* View                                                                    */
/* ----------------------------------------------------------------------- */

function latencyToneClass(tone: Run["latencyTone"]): string {
  switch (tone) {
    case "green":
      return "text-event-green";
    case "amber":
      return "text-event-amber";
    case "red":
      return "text-event-red";
    default:
      return "text-ink-dim";
  }
}

function RunsView({ initial }: { initial?: FilterState[] }) {
  const { filters, actions, predicate } = useDataTableFilters<Run>({
    columns: COLUMNS,
    initialFilters: initial,
  });

  const visible = React.useMemo(() => RUNS.filter(predicate), [predicate]);
  const counts = React.useMemo(() => {
    const c: Record<VerdictKind, number> = {
      pass: 0,
      fail: 0,
      partial: 0,
      pending: 0,
    };
    for (const r of visible) c[r.status] += 1;
    return c;
  }, [visible]);

  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-surface-01">
      <div className="flex flex-col gap-s-4 border-b border-hairline p-s-5">
        <div className="flex items-center gap-s-5">
          <Mono size="md" tone="hi" uppercase tactical>
            REPLAY SUITE
          </Mono>
          <Mono size="md" tone="dim">
            <b className="font-normal text-event-green">{counts.pass}</b> pass ·{" "}
            <b className="font-normal text-event-amber">{counts.partial}</b>{" "}
            partial ·{" "}
            <b className="font-normal text-event-red">{counts.fail}</b> fail ·{" "}
            <b className="font-normal text-ink-lo">{counts.pending}</b> pending
          </Mono>
          <Eyebrow className="ml-auto">
            {visible.length} / {RUNS.length} rows
          </Eyebrow>
        </div>
        <DataTableFilterBar
          columns={COLUMNS}
          filters={filters}
          actions={actions}
        />
      </div>
      <RunsTable>
        <RunsTableHead>
          <RunsTableRow>
            <RunsTableHeader style={{ width: "34%" }}>Scenario</RunsTableHeader>
            <RunsTableHeader style={{ width: 120 }}>
              Environment
            </RunsTableHeader>
            <RunsTableHeader style={{ width: 160 }}>Owners</RunsTableHeader>
            <RunsTableHeader style={{ width: 80 }}>Turns</RunsTableHeader>
            <RunsTableHeader style={{ width: 200 }}>Similarity</RunsTableHeader>
            <RunsTableHeader style={{ width: 100 }}>Latency</RunsTableHeader>
            <RunsTableHeader style={{ width: 120 }}>Verdict</RunsTableHeader>
          </RunsTableRow>
        </RunsTableHead>
        <tbody>
          {visible.length === 0 ? (
            <RunsTableRow>
              <RunsTableCell colSpan={7}>
                <div className="flex flex-col items-center gap-s-2 py-s-8 text-center">
                  <Mono size="md" tone="hi" uppercase tactical>
                    No runs match
                  </Mono>
                  <Mono size="sm" tone="dim">
                    Try widening the filters or clearing them entirely.
                  </Mono>
                </div>
              </RunsTableCell>
            </RunsTableRow>
          ) : (
            visible.map((r) => {
              const simTone =
                r.similarity >= 90 ? "hi" : r.similarity >= 75 ? "md" : "lo";
              return (
                <RunsTableRow key={r.id}>
                  <RunsTableCell>
                    <RunName name={r.scenario} sub={r.subtitle} />
                  </RunsTableCell>
                  <RunsTableCell>
                    <Tag
                      variant={
                        r.environment === "prod"
                          ? "ember"
                          : r.environment === "staging"
                            ? "teal"
                            : "neutral"
                      }
                    >
                      {r.environment}
                    </Tag>
                  </RunsTableCell>
                  <RunsTableCell>
                    <div className="flex flex-wrap gap-s-1">
                      {r.owners.map((id) => {
                        const o = OWNERS.find((x) => x.value === id);
                        return (
                          <Tag key={id} variant={o?.tone ?? "neutral"}>
                            {o?.label.split(" ")[0] ?? id}
                          </Tag>
                        );
                      })}
                    </div>
                  </RunsTableCell>
                  <RunsTableCell>{r.turns}</RunsTableCell>
                  <RunsTableCell>
                    <SimBar value={r.similarity} tone={simTone} />{" "}
                    {r.similarity.toFixed(1)}%
                  </RunsTableCell>
                  <RunsTableCell className={latencyToneClass(r.latencyTone)}>
                    {r.latencyDelta}
                  </RunsTableCell>
                  <RunsTableCell>
                    <Verdict kind={r.status} />
                  </RunsTableCell>
                </RunsTableRow>
              );
            })
          )}
        </tbody>
      </RunsTable>
    </div>
  );
}

function Page08({ initial }: { initial?: FilterState[] }) {
  return (
    <div className="min-h-screen bg-surface-00">
      <ChronHeader />
      <main className="px-[72px] pb-[80px] pt-[16px] text-ink">
        <PageHeader
          eyebrow="08 / 08"
          title="Product — Data filters"
          lede="A Chronicle-native port of bazza/ui's Linear-style filter bar. Pills compose with AND logic, operator and value share a single popover, and the column picker lives a keystroke away. Built on react-aria-components and the shared token layer — no Radix, no cmdk, no tailwind-merge."
        />

        <h2 className="m-0 mb-s-4 mt-s-12 font-display text-title-lg font-medium tracking-tight text-ink-hi">
          Replay runs{" "}
          <span className="ml-s-3 align-middle font-mono text-mono-lg font-normal uppercase tracking-tactical text-ink-dim">
            faceted · client-side predicate
          </span>
        </h2>
        <RunsView initial={initial} />

        <h2 className="m-0 mb-s-4 mt-s-16 font-display text-title-lg font-medium tracking-tight text-ink-hi">
          Column types{" "}
          <span className="ml-s-3 align-middle font-mono text-mono-lg font-normal uppercase tracking-tactical text-ink-dim">
            option · multiOption · text · number
          </span>
        </h2>
        <div className="rounded-md border border-hairline bg-surface-01 p-s-6">
          <Mono size="md" tone="dim">
            Click <b className="font-normal text-ink-hi">+ Filter</b> to open
            the column picker. Click an operator or value to edit inline. All
            popovers mount inside the shared RAC overlay layer and respect the
            ember focus ring.
          </Mono>
        </div>
      </main>
    </div>
  );
}

const meta: Meta<typeof Page08> = {
  title: "Templates/Page 08 — Data Filters",
  component: Page08,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof Page08>;

export const Canvas: Story = { render: () => <Page08 /> };

export const WithPreappliedFilters: Story = {
  render: () => (
    <Page08
      initial={[
        {
          id: "seed_status",
          columnId: "status",
          operator: "isNot",
          value: "pass",
        },
        {
          id: "seed_env",
          columnId: "environment",
          operator: "is",
          value: "prod",
        },
        {
          id: "seed_owners",
          columnId: "owners",
          operator: "isAnyOf",
          value: ["sc", "mk"],
        },
      ]}
    />
  ),
};

export const SimilarityRange: Story = {
  render: () => (
    <Page08
      initial={[
        {
          id: "seed_sim",
          columnId: "similarity",
          operator: "between",
          value: [75, 95],
        },
      ]}
    />
  ),
};
