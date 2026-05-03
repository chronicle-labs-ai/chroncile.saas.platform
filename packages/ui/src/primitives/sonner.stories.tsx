import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import { Toaster, toast } from "./sonner";

/*
 * Sonner is the upstream-recommended toast primitive. The preview
 * already mounts a global `<Toaster />`, so any story can just call
 * `toast(...)`. The story below also mounts one inline so it stays
 * self-contained when viewed in isolation.
 */

const meta: Meta = {
  title: "Primitives/Sonner",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

const Demo = () => (
  <div className="flex flex-col gap-s-3">
    <Toaster />
    <div className="flex flex-wrap gap-s-2">
      <Button onPress={() => toast("Saved")}>Default</Button>
      <Button
        onPress={() =>
          toast.success("Deploy succeeded", {
            description: "Shipped to production in 38s.",
          })
        }
      >
        Success
      </Button>
      <Button
        onPress={() =>
          toast.info("New release rolling out", {
            description: "Canaries will reach 5% in ~2 minutes.",
          })
        }
      >
        Info
      </Button>
      <Button
        onPress={() =>
          toast.warning("Quota nearing limit", {
            description: "Backfill is consuming 78% of the daily token budget.",
          })
        }
      >
        Warning
      </Button>
      <Button
        variant="critical"
        onPress={() =>
          toast.error("Deploy failed", {
            description: "Rolled back to previous release.",
            action: {
              label: "Retry",
              onClick: () => toast("Retrying…"),
            },
          })
        }
      >
        Error with action
      </Button>
      <Button
        variant="ghost"
        onPress={() =>
          toast.promise(
            new Promise((resolve) => setTimeout(resolve, 1500)),
            {
              loading: "Publishing dataset…",
              success: "Dataset published",
              error: "Publish failed",
            }
          )
        }
      >
        Promise
      </Button>
    </div>
  </div>
);

export const Default: Story = {
  render: () => <Demo />,
};
