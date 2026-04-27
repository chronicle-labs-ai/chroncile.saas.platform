import type { Meta, StoryObj } from "@storybook/react";
import { ToastProvider, useToast } from "./toast";
import { Button } from "./button";

const meta: Meta = {
  title: "Primitives/Toast",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

const Demo = () => {
  const toast = useToast();
  return (
    <ToastProvider>
      <div className="flex flex-wrap gap-s-2">
        <Button
          onPress={() => toast.add({ title: "Deploy started", tone: "info" })}
        >
          Info
        </Button>
        <Button
          variant="ember"
          onPress={() =>
            toast.add({
              title: "Deploy succeeded",
              description: "Shipped to production in 38s.",
              tone: "success",
            })
          }
        >
          Success
        </Button>
        <Button
          variant="critical"
          onPress={() =>
            toast.add({
              title: "Deploy failed",
              description: "Rolled back to previous release.",
              tone: "danger",
              action: {
                label: "Retry",
                onPress: () => console.log("retry"),
              },
            })
          }
        >
          Danger with action
        </Button>
      </div>
    </ToastProvider>
  );
};

export const Default: Story = {
  render: () => <Demo />,
};
