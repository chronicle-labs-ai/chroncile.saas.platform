import type { Meta, StoryObj } from "@storybook/react";

import { AppSidebar, SiteHeader } from "./dashboard-sidebar-shell";
import { SidebarInset, SidebarProvider } from "./sidebar";

const meta: Meta = {
  title: "Layout/Dashboard Sidebar Shell",
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

const user = {
  name: "Ayman Saleh",
  email: "ayman@chroniclelabs.org",
  avatar: null,
};

const workspace = {
  name: "Chronicle Labs",
  plan: "Enterprise",
};

function DashboardSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <div className="aspect-video rounded-xl bg-muted/50" />
        <div className="aspect-video rounded-xl bg-muted/50" />
        <div className="aspect-video rounded-xl bg-muted/50" />
      </div>
      <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min" />
    </div>
  );
}

export const Default: Story = {
  render: () => (
    <div className="[--header-height:3.5rem]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar user={user} workspace={workspace} />
          <SidebarInset>
            <DashboardSkeleton />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  ),
};
