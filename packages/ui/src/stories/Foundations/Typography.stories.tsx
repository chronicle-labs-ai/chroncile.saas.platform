import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { Display } from "../../typography/display";
import { Body } from "../../typography/body";
import { Mono } from "../../typography/mono";

function TypeScale() {
  return (
    <div className="flex flex-col gap-s-12 p-s-10">
      <section className="flex flex-col gap-s-5">
        <div className="font-mono text-mono uppercase tracking-eyebrow text-ember">
          Display · Kalice
        </div>
        <Display size="xxl">
          The <em className="italic font-normal text-bone">system</em>
        </Display>
        <Display size="xl">Behind the stream.</Display>
        <Display size="lg">Event-first observability</Display>
        <Display size="md">Replay what shipped.</Display>
        <Display size="sm">Section opener</Display>
      </section>

      <section className="flex flex-col gap-s-3">
        <div className="font-mono text-mono uppercase tracking-eyebrow text-ember">
          Body · TWK Lausanne
        </div>
        <Body size="lg">
          A unified design language for Chronicle — serif headlines for
          authority, mono for time and topics, sans for reading.
        </Body>
        <Body size="md" tone="lo">
          Heterogeneous events from every source land on one rail, colored by
          stream, sortable as list or timeline.
        </Body>
        <Body size="sm" tone="dim">
          Drafted in one session · tokens in tokens.css · Kalice + TWK Lausanne
          + Geist Mono.
        </Body>
      </section>

      <section className="flex flex-col gap-s-3">
        <div className="font-mono text-mono uppercase tracking-eyebrow text-ember">
          Mono · Geist Mono
        </div>
        <Mono size="lg" tone="hi">
          agent.tool.invoke → escalate()
        </Mono>
        <Mono size="md" tactical uppercase tone="lo">
          Chronicle / Brand &amp; Product System · v0.1 Draft
        </Mono>
        <Mono size="sm" tone="dim">
          14:10:02.418 · source: support-ai · trace: cus_demo_01
        </Mono>
        <Mono size="xs" tone="dim" uppercase tactical>
          05 / DISPLAY / BODY / MONO
        </Mono>
      </section>
    </div>
  );
}

const meta: Meta<typeof TypeScale> = {
  title: "Foundations/Typography",
  component: TypeScale,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof TypeScale>;

export const Scale: Story = { render: () => <TypeScale /> };
