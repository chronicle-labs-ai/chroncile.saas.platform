import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { AmbientBackground } from "../../surfaces/ambient-background";
import { Blinds } from "../../surfaces/recipes/blinds";
import { Display } from "../../typography/display";
import { Body } from "../../typography/body";
import { Eyebrow } from "../../primitives/eyebrow";
import { Logo } from "../../primitives/logo";
import { Badge } from "../../primitives/badge";
import { Button } from "../../primitives/button";
import { Tag } from "../../primitives/tag";
import { StatusDot } from "../../primitives/status-dot";
import { SectionHeader } from "../../product/section-header";
import { Principle } from "../../product/principle";
import { MetaKV } from "../../product/meta-kv";
import { Card } from "../../product/card";

/**
 * Full-page recreation of handoff page 05 (UI Components index).
 * This doubles as a visual regression fixture for the system.
 */
function Page05() {
  return (
    <div className="relative min-h-screen isolate overflow-hidden bg-page">
      <AmbientBackground />
      <header className="px-s-16 py-s-16 pl-[72px] pr-[72px]">
        <Logo variant="wordmark" className="h-[10px] opacity-70" />
      </header>
      <main className="mx-auto max-w-[1320px] px-[56px] pb-[120px] pt-[72px]">
        <header className="mb-s-12 grid grid-cols-[auto_1fr] items-end gap-s-12 border-b border-hairline pb-[60px]">
          <div className="flex flex-col gap-s-6">
            <div className="flex items-center gap-s-4">
              <div className="flex h-[56px] w-[56px] items-center justify-center">
                <Logo variant="icon" className="h-full w-full" />
              </div>
              <Eyebrow>
                CHRONICLE / BRAND &amp; PRODUCT SYSTEM · v0.1 DRAFT
              </Eyebrow>
            </div>
            <Display size="xl">
              The <em className="italic font-normal text-bone">system</em>
              <br />
              behind the stream.
            </Display>
            <Body size="lg" tone="lo" className="mt-s-4 max-w-[54ch]">
              A unified design language for Chronicle — the infrastructure layer
              for agent behavior. Serif headlines for authority, mono for time
              and topics, sans for reading. A restrained dark surface with one
              signature: the ember-to-sage light-source gradient.
            </Body>
          </div>
          <aside className="flex flex-col items-end gap-s-4 self-end pb-s-2">
            <div className="flex flex-wrap justify-end gap-s-3">
              <Badge>Kalice · display</Badge>
              <Badge>TWK Lausanne · sans</Badge>
              <Badge>Geist Mono · mono</Badge>
            </div>
            <MetaKV
              entries={[
                {
                  label: "Cards",
                  value: (
                    <>
                      <b className="text-ink-hi font-normal">7</b> · brand →
                      product
                    </>
                  ),
                },
                {
                  label: "Tokens",
                  value: (
                    <>
                      <b className="text-ink-hi font-normal">tokens.css</b> · 1
                      source of truth
                    </>
                  ),
                },
                {
                  label: "Canvas",
                  value: (
                    <>
                      <b className="text-ink-hi font-normal">1440</b> design
                      width · responsive
                    </>
                  ),
                },
                { label: "Ref", value: "Linear · Vercel · Anthropic" },
              ]}
            />
          </aside>
        </header>

        <SectionHeader title="Brand foundations" note="01 — 04 · FOUR CARDS" />
        <div className="grid grid-cols-[2fr_1fr] gap-s-5 mb-s-5">
          <Card
            num="01"
            title="Logo & mark"
            subtitle="Variations, clear space, don't-do list"
            href="#"
            thumb={
              <div className="relative flex h-full flex-col items-center justify-center gap-s-8 bg-black p-s-8">
                <Logo variant="icon" className="h-[96px] w-[96px]" />
                <Logo
                  variant="wordmark"
                  className="h-auto w-[180px] opacity-85"
                />
              </div>
            }
          />
          <Card
            num="02"
            title="Typography"
            subtitle="Display · body · mono scale"
            href="#"
            thumb={
              <div className="flex h-full flex-col items-start justify-center gap-s-3 bg-black p-s-8">
                <Display size="md">
                  Type <em className="italic font-normal text-bone">scale</em>
                </Display>
                <Body size="sm" tone="lo">
                  Kalice display over TWK Lausanne body, Geist Mono for time.
                </Body>
                <Eyebrow>05 / DISPLAY / BODY / MONO</Eyebrow>
              </div>
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-s-5">
          <Card
            num="03"
            title="Color system"
            subtitle="Brand arc + event palette"
            href="#"
            thumb={
              <div className="grid h-full grid-cols-5 grid-rows-2 gap-px bg-hairline">
                {[
                  "#d8430a",
                  "#905838",
                  "#b09b74",
                  "#709188",
                  "#3e547c",
                  "#2dd4bf",
                  "#fbbf24",
                  "#4ade80",
                  "#f472b6",
                  "#8b5cf6",
                ].map((c) => (
                  <span key={c} className="block" style={{ background: c }} />
                ))}
              </div>
            }
          />
          <Card
            num="04"
            title="Gradient & glass"
            subtitle="The light-source treatment"
            href="#"
            thumb={<Blinds className="h-full w-full" />}
          />
        </div>

        <SectionHeader
          title="Product system"
          note="05 — 07 · COMPONENTS → APP"
        />
        <div className="grid grid-cols-3 gap-s-5">
          <Card
            num="05"
            title="UI components"
            subtitle="Buttons · inputs · tags · events"
            href="#"
            thumb={
              <div className="flex h-full flex-col justify-center gap-s-3 bg-surface-00 p-s-5">
                <div className="flex flex-wrap gap-s-2">
                  <Button density="brand" size="sm">
                    Run replay
                  </Button>
                  <Button density="brand" size="sm" variant="secondary">
                    All sources
                  </Button>
                  <Button density="brand" size="sm" variant="ember">
                    ⚡ Inject
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-s-2">
                  <Tag variant="teal">CUSTOMER</Tag>
                  <Tag variant="amber">AGENT</Tag>
                  <Tag variant="green">SYSTEM</Tag>
                  <Tag variant="red">DIVERGENCE</Tag>
                </div>
                <div className="flex items-center gap-s-2 rounded-xs border border-hairline bg-surface-02 px-s-3 py-s-2 font-mono text-mono text-ink-lo">
                  <StatusDot variant="teal" />
                  support.conversation.created
                  <span className="ml-auto text-ink-dim">+0ms</span>
                </div>
                <div className="flex items-center gap-s-2 rounded-xs border border-hairline bg-surface-02 px-s-3 py-s-2 font-mono text-mono text-ink-lo">
                  <StatusDot variant="amber" />
                  shopify.order.created
                  <span className="ml-auto text-ink-dim">+2m</span>
                </div>
              </div>
            }
          />
          <Card
            num="06"
            title="Event stream"
            subtitle="The core product surface"
            href="#"
            thumb={
              <div className="flex h-full flex-col gap-[6px] bg-surface-00 p-s-5">
                {[
                  {
                    time: "14:04",
                    l: "support.conversation.created",
                    lane: "teal" as const,
                  },
                  {
                    time: "14:06",
                    l: "shopify.order.lookup",
                    lane: "amber" as const,
                  },
                  {
                    time: "14:06",
                    l: "agent.response.generated",
                    lane: "green" as const,
                  },
                  {
                    time: "14:09",
                    l: "ops.alert.triggered",
                    lane: "orange" as const,
                  },
                  {
                    time: "14:10",
                    l: "agent.tool.escalate()",
                    lane: "ember" as const,
                  },
                  {
                    time: "14:10",
                    l: "slack.channel.post",
                    lane: "pink" as const,
                  },
                ].map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-s-2 font-mono text-mono text-ink-lo"
                  >
                    <StatusDot variant={r.lane} halo={r.lane === "ember"} />
                    <span className={r.lane === "ember" ? "text-ink-hi" : ""}>
                      {r.time} &nbsp; {r.l}
                    </span>
                  </div>
                ))}
              </div>
            }
          />
          <Card
            num="07"
            title="Replay suite"
            subtitle="Scenario runner + divergence diff"
            href="#"
            thumb={
              <div className="flex h-full flex-col justify-center gap-s-2 bg-gradient-to-b from-surface-01 to-surface-00 p-s-5">
                <div className="flex justify-between font-mono text-mono-sm uppercase tracking-eyebrow text-ink-dim">
                  <span>
                    BASELINE <b className="text-ink-lo font-normal">v2.8</b>
                  </span>
                  <span>98.4% match</span>
                </div>
                <div className="h-[6px] overflow-hidden rounded-[3px] bg-white/[0.06]">
                  <span
                    className="block h-full bg-event-green opacity-40"
                    style={{ width: "98%" }}
                  />
                </div>
                <div className="flex justify-between font-mono text-mono-sm uppercase tracking-eyebrow text-ink-dim">
                  <span>
                    CANDIDATE <b className="text-ember font-normal">v3.0.4</b>
                  </span>
                  <span className="text-event-red">62.1% — FAIL</span>
                </div>
                <div className="h-[6px] overflow-hidden rounded-[3px] bg-white/[0.06]">
                  <span
                    className="block h-full bg-ember"
                    style={{ width: "62%" }}
                  />
                </div>
              </div>
            }
          />
        </div>

        <SectionHeader
          title="Three principles"
          note="HOW THIS SYSTEM DECIDES"
        />
        <div className="grid grid-cols-3 gap-s-5 pt-s-8">
          <Principle
            index="01"
            heading={
              <>
                Serif for judgement.
                <br />
                Mono for evidence.
              </>
            }
            body="Every claim about behavior lands in Kalice. Every piece of evidence lands in mono. The typography itself encodes the epistemology."
          />
          <Principle
            index="02"
            heading={
              <>
                One hot surface.
                <br />
                Everything else rests.
              </>
            }
            body="The ember gradient is a signal, not decoration. It marks the living scenario, the selected event, the active version — and nothing else."
          />
          <Principle
            index="03"
            heading={
              <>
                Streams are colored.
                <br />
                Systems are quiet.
              </>
            }
            body="Event streams each own a hue — teal for intercom, amber for shopify, green for stripe. System chrome stays neutral."
          />
        </div>
      </main>
    </div>
  );
}

const meta: Meta<typeof Page05> = {
  title: "Templates/Page 05 — Brand & Product Index",
  component: Page05,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof Page05>;

export const Canvas: Story = { render: () => <Page05 /> };
