import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import {
  DatasetsToolbar,
  type DatasetsView,
} from "./datasets-toolbar";
import { ProductChromeFrame } from "./_story-frame";
import type { DatasetPurpose } from "./types";

const meta: Meta<typeof DatasetsToolbar> = {
  title: "Datasets/DatasetsToolbar",
  component: DatasetsToolbar,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="980px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DatasetsToolbar>;

function Wrapper(initial: {
  query?: string;
  purposes?: DatasetPurpose[];
  view?: DatasetsView;
}) {
  return function Component() {
    const [query, setQuery] = React.useState(initial.query ?? "");
    const [purposes, setPurposes] = React.useState<DatasetPurpose[]>(
      initial.purposes ?? [],
    );
    const [view, setView] = React.useState<DatasetsView>(
      initial.view ?? "grid",
    );
    return (
      <DatasetsToolbar
        query={query}
        onQueryChange={setQuery}
        view={view}
        onViewChange={setView}
        selectedPurposes={purposes}
        onPurposeToggle={(p) =>
          setPurposes((cur) =>
            cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p],
          )
        }
        totalCount={6}
        onCreate={() => undefined}
      />
    );
  };
}

export const Default: Story = { render: Wrapper({}) };

export const FiltersActive: Story = {
  render: Wrapper({
    query: "support",
    purposes: ["eval", "training"],
    view: "list",
  }),
};

export const NoCreate: Story = {
  render: function Render() {
    const [query, setQuery] = React.useState("");
    const [purposes, setPurposes] = React.useState<DatasetPurpose[]>([]);
    const [view, setView] = React.useState<DatasetsView>("grid");
    return (
      <DatasetsToolbar
        query={query}
        onQueryChange={setQuery}
        view={view}
        onViewChange={setView}
        selectedPurposes={purposes}
        onPurposeToggle={(p) =>
          setPurposes((cur) =>
            cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p],
          )
        }
        hideAdd
      />
    );
  },
};
