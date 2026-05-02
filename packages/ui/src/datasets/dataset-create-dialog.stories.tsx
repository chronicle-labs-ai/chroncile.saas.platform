import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../primitives/button";

import { DatasetCreateDialog } from "./dataset-create-dialog";
import { ProductChromeFrame } from "./_story-frame";
import type { CreateDatasetPayload, Dataset } from "./types";

const meta: Meta<typeof DatasetCreateDialog> = {
  title: "Datasets/DatasetCreateDialog",
  component: DatasetCreateDialog,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DatasetCreateDialog>;

function makeCreated(payload: CreateDatasetPayload): Dataset {
  return {
    id: `ds_${Date.now().toString(36)}`,
    name: payload.name,
    description: payload.description,
    purpose: payload.purpose,
    tags: payload.tags ? [...payload.tags] : undefined,
    traceCount: 0,
    eventCount: 0,
    createdBy: "you",
    updatedAt: new Date().toISOString(),
  };
}

export const Empty: Story = {
  render: function Render() {
    const [open, setOpen] = React.useState(true);
    const [last, setLast] = React.useState<Dataset | null>(null);
    return (
      <div className="flex flex-col gap-3">
        <Button density="compact" variant="primary" onPress={() => setOpen(true)}>
          Open create dialog
        </Button>
        {last ? (
          <pre className="max-w-md overflow-x-auto rounded-[3px] border border-l-border bg-l-surface-raised p-3 font-mono text-[11px] text-l-ink-lo">
            {JSON.stringify(last, null, 2)}
          </pre>
        ) : null}
        <DatasetCreateDialog
          isOpen={open}
          onOpenChange={setOpen}
          onCreate={(payload) => {
            const created = makeCreated(payload);
            setLast(created);
            return created;
          }}
        />
      </div>
    );
  },
};

export const FromDuplicate: Story = {
  render: function Render() {
    const [open, setOpen] = React.useState(true);
    return (
      <DatasetCreateDialog
        isOpen={open}
        onOpenChange={setOpen}
        initialValues={{
          name: "Eval suite v2 copy",
          description: "Forked from v1 to start a new release suite.",
          purpose: "eval",
          tagsInput: "regression, fork",
        }}
        onCreate={(p) => makeCreated(p)}
      />
    );
  },
};

export const ValidationErrors: Story = {
  render: function Render() {
    const [open, setOpen] = React.useState(true);
    return (
      <DatasetCreateDialog
        isOpen={open}
        onOpenChange={setOpen}
        initialValues={{ name: "" }}
        onCreate={(p) => makeCreated(p)}
      />
    );
  },
};
