import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { ChronHeader } from "../../layout/chron-header";
import { PageHeader } from "../../layout/page-header";
import { Button } from "../../primitives/button";
import { Eyebrow } from "../../primitives/eyebrow";
import { Display } from "../../typography/display";
import { Mono } from "../../typography/mono";
import {
  RunsTable,
  RunsTableCell,
  RunsTableHead,
  RunsTableHeader,
  RunsTableRow,
  RunName,
  SimBar,
  Verdict,
} from "../../product/runs-table";
import { TurnDiffStrip } from "../../product/turn-diff-strip";
import { ReplayBar } from "../../product/replay-bar";

function ScenarioRunner() {
  return (
    <section className="relative overflow-hidden rounded-md border border-hairline-strong bg-surface-01 p-s-6 min-h-[440px]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[-10%] top-[-20%] h-[120%]"
        style={{
          background:
            "radial-gradient(ellipse at 20% 65%, rgba(176,155,116,0.22), transparent 40%), radial-gradient(ellipse at 85% 55%, rgba(216,67,10,0.28), transparent 45%), radial-gradient(ellipse at 50% 120%, rgba(112,145,136,.2), transparent 55%)",
          filter: "blur(4px)",
        }}
      />
      <div className="relative z-10 flex flex-col gap-s-5">
        <div className="flex items-center justify-between">
          <Mono size="md" tone="hi" uppercase tactical>
            SCENARIO — REFUND ESCALATION
          </Mono>
          <Button density="brand" variant="primary" size="sm">
            <span className="text-ember">⚡</span> Inject edge case
          </Button>
        </div>
        <div className="grid grid-cols-3 overflow-hidden rounded-xs border border-hairline">
          {["INSTANT", "Realtime", "Accelerated 8×"].map((label, i) => (
            <button
              key={label}
              className={`py-s-3 font-mono text-mono uppercase tracking-tactical ${i === 0 ? "bg-white text-[color:var(--c-btn-invert-fg)]" : "bg-transparent text-ink-lo"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-col divide-y divide-hairline">
          {[
            {
              role: "CUSTOMER",
              who: "Sarah Chen",
              msg: "My last order never arrived.",
            },
            {
              role: "SYSTEM",
              who: "OrderLookup",
              msg: '{ order_id: "8821", status: "delivered" }',
            },
            {
              role: "AGENT",
              who: "support-ai",
              msg: "Your order was delivered last Thursday.",
            },
            {
              role: "CUSTOMER",
              who: "Sarah Chen",
              msg: "The address is wrong — third time.",
            },
          ].map((t) => (
            <div
              key={t.msg}
              className="grid grid-cols-[16px_112px_1fr_auto] items-center gap-s-4 py-s-3"
            >
              <span className="h-[14px] w-[14px] rounded-xs border border-event-green bg-event-green" />
              <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
                {t.role}
                <b className="block text-[11px] normal-case tracking-normal text-ink-lo mt-[2px] font-normal">
                  {t.who}
                </b>
              </span>
              <span className="rounded-xs bg-black/35 px-s-3 py-s-2 font-mono text-mono text-ink-lo">
                {t.msg}
              </span>
              <Mono size="sm" tone="dim">
                intercom
              </Mono>
            </div>
          ))}
          <div className="grid grid-cols-[16px_112px_1fr_auto] items-center gap-s-4 py-s-3">
            <span className="h-[14px] w-[14px] rounded-xs border border-event-red bg-event-red" />
            <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
              AGENT
              <b className="block text-[11px] normal-case tracking-normal text-event-red mt-[2px] font-normal">
                support-agent-v3
              </b>
            </span>
            <span className="rounded-xs border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-s-3 py-s-2 font-mono text-mono text-ink">
              I apologize — unfortunately I'm unable to process a refund myself…
            </span>
            <Mono size="sm" tone="dim">
              sandbox
            </Mono>
          </div>
        </div>
      </div>
    </section>
  );
}

function Page07() {
  return (
    <div className="min-h-screen bg-surface-00">
      <ChronHeader />
      <main className="px-[72px] pb-[80px] pt-[16px] text-ink">
        <PageHeader
          eyebrow="07 / 07"
          title="Product — Replay Suite"
          lede="Run a recorded history against a new version of your agent, compare responses turn-by-turn, and surface the divergences. The ember gradient shows up here as the signature glow on the scenario runner — the only hot surface in an otherwise restrained UI."
        />

        <h2 className="m-0 mb-s-4 mt-s-12 font-display text-title-lg font-medium tracking-tight text-ink-hi">
          Scenario runner{" "}
          <span className="ml-s-3 align-middle font-mono text-mono-lg font-normal uppercase tracking-tactical text-ink-dim">
            Interactive composition
          </span>
        </h2>
        <div className="grid grid-cols-2 gap-s-6">
          <ScenarioRunner />
          <section className="rounded-md border border-hairline-strong bg-surface-01 p-s-6">
            <div className="mb-s-5 flex items-center justify-between">
              <Mono size="md" tone="hi" uppercase tactical>
                SCENARIO LIBRARY
              </Mono>
              <Eyebrow>18 SCENARIOS · 4 DRAFTS</Eyebrow>
            </div>
            <div className="flex flex-col gap-s-3">
              {[
                {
                  name: "Refund escalation",
                  status: "RUNNING",
                  tone: "text-event-red",
                  meta: "11 turns · 3 tools · 1 divergence",
                },
                {
                  name: "Chargeback dispute",
                  status: "✓ PASSING",
                  tone: "text-event-green",
                  meta: "14 turns · 6 tools · 3 handoffs",
                },
                {
                  name: "Out-of-stock replacement",
                  status: "◐ PARTIAL",
                  tone: "text-event-amber",
                  meta: "9 turns · 2 tools · sentiment drop",
                },
                {
                  name: "Multi-tenant permission confusion",
                  status: "",
                  tone: "",
                  meta: "22 turns · 4 tools · 2 SSO redirects",
                },
              ].map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between rounded-xs border border-hairline-strong bg-surface-01 p-s-4"
                >
                  <div>
                    <div className="font-mono text-mono-lg text-ink-hi mb-[4px]">
                      {s.name}
                      {s.status ? (
                        <span
                          className={`ml-s-3 font-mono text-mono-sm uppercase tracking-tactical ${s.tone}`}
                        >
                          ● {s.status}
                        </span>
                      ) : null}
                    </div>
                    <Mono size="sm" tone="dim">
                      {s.meta}
                    </Mono>
                  </div>
                  <Eyebrow>SUPPORT</Eyebrow>
                </div>
              ))}
            </div>
          </section>
        </div>

        <h2 className="m-0 mb-s-4 mt-s-16 font-display text-title-lg font-medium tracking-tight text-ink-hi">
          Run results —{" "}
          <em className="italic font-normal text-ink-lo not-italic">
            support-agent-v3 vs v2.8
          </em>
          <span className="ml-s-3 align-middle font-mono text-mono-lg font-normal uppercase tracking-tactical text-ink-dim">
            24 scenarios · run 14m ago
          </span>
        </h2>
        <div className="overflow-hidden rounded-md border border-hairline bg-surface-01">
          <div className="flex items-center gap-s-5 border-b border-hairline p-s-5">
            <Mono size="md" tone="hi" uppercase tactical>
              REPLAY SUITE
            </Mono>
            <Mono size="md" tone="dim">
              Pass <b className="text-event-green font-normal">19</b> · Partial{" "}
              <b className="text-event-amber font-normal">3</b> · Fail{" "}
              <b className="text-event-red font-normal">2</b>
            </Mono>
            <div className="ml-auto flex gap-s-3">
              <Button density="brand" variant="secondary" size="sm">
                Export report
              </Button>
              <Button density="brand" variant="primary" size="sm">
                ▶ Re-run suite
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-s-3 border-b border-hairline bg-surface-00 p-s-4">
            <ReplayBar
              variant="baseline"
              value={98}
              label={
                <>
                  BASELINE{" "}
                  <b className="text-ink-hi font-normal">support-agent-v2.8</b>
                </>
              }
              readout="98.4% match"
              tone="green"
            />
            <ReplayBar
              variant="candidate"
              value={62}
              label={
                <>
                  CANDIDATE{" "}
                  <b className="text-ember font-normal">support-agent-v3.0.4</b>
                </>
              }
              readout="62.1% match"
              tone="red"
            />
          </div>
          <RunsTable>
            <RunsTableHead>
              <RunsTableRow>
                <RunsTableHeader style={{ width: "30%" }}>
                  Scenario
                </RunsTableHeader>
                <RunsTableHeader style={{ width: 120 }}>Turns</RunsTableHeader>
                <RunsTableHeader style={{ width: 200 }}>
                  Similarity
                </RunsTableHeader>
                <RunsTableHeader style={{ width: 180 }}>
                  Turn diff
                </RunsTableHeader>
                <RunsTableHeader style={{ width: 120 }}>
                  Latency Δ
                </RunsTableHeader>
                <RunsTableHeader style={{ width: 120 }}>
                  Verdict
                </RunsTableHeader>
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
                <RunsTableCell className="text-event-green">
                  −0.2s
                </RunsTableCell>
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
      </main>
    </div>
  );
}

const meta: Meta<typeof Page07> = {
  title: "Templates/Page 07 — Replay Suite",
  component: Page07,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof Page07>;
export const Canvas: Story = { render: () => <Page07 /> };
