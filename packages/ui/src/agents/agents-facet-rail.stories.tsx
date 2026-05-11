import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { AgentsFacetRail } from "./agents-facet-rail";
import { agentsManagerSeed } from "./data";
import { ProductChromeFrame } from "./_story-frame";
import type { AgentFramework } from "./types";

const meta: Meta<typeof AgentsFacetRail> = {
  title: "Agents/AgentsFacetRail",
  component: AgentsFacetRail,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="none">
        <div className="flex h-screen">
          <div className="flex-1 bg-l-surface" />
          <Story />
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentsFacetRail>;

function FacetRailHarness() {
  const [width, setWidth] = React.useState(320);
  const [frameworks, setFrameworks] = React.useState<AgentFramework[]>([]);
  const [owners, setOwners] = React.useState<string[]>([]);
  const [categories, setCategories] = React.useState<string[]>([]);

  const toggle = <T,>(value: T, list: T[], setList: (next: T[]) => void) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  return (
    <AgentsFacetRail
      agents={agentsManagerSeed}
      selectedFrameworks={frameworks}
      onFrameworkToggle={(fw) => toggle(fw, frameworks, setFrameworks)}
      selectedOwners={owners}
      onOwnerToggle={(owner) => toggle(owner, owners, setOwners)}
      selectedCategories={categories}
      onCategoryToggle={(cat) => toggle(cat, categories, setCategories)}
      width={width}
      onWidthChange={setWidth}
    />
  );
}

export const Default: Story = {
  render: () => <FacetRailHarness />,
};
