import type { Meta, StoryObj } from "@storybook/react";
import { Accordion, AccordionItem } from "./accordion";

const meta: Meta = {
  title: "Primitives/Accordion",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="w-[480px]">
      <Accordion defaultExpandedKeys={["intro"]}>
        <AccordionItem id="intro" title="Introduction">
          A quick overview of the Chronicle runtime.
        </AccordionItem>
        <AccordionItem id="rules" title="Rules">
          How rules evaluate against the event stream.
        </AccordionItem>
        <AccordionItem id="runs" title="Runs">
          Each execution of a scenario produces a run with replayable detail.
        </AccordionItem>
      </Accordion>
    </div>
  ),
};

export const Multiple: Story = {
  render: () => (
    <div className="w-[480px]">
      <Accordion allowsMultipleExpanded defaultExpandedKeys={["a", "c"]}>
        <AccordionItem id="a" title="Always open">
          These can expand independently.
        </AccordionItem>
        <AccordionItem id="b" title="Closed by default">
          Content here.
        </AccordionItem>
        <AccordionItem id="c" title="Also open">
          Content here.
        </AccordionItem>
      </Accordion>
    </div>
  ),
};
