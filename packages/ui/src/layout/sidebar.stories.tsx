import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import {
  Activity,
  CircleCheckBig,
  Command,
  LifeBuoy,
  MoreHorizontal,
  PanelsTopLeft,
  Search,
  Send,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../primitives/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarNav,
  SidebarNavItem,
  SidebarNavSection,
  SidebarProvider,
  SidebarStatus,
  SidebarUserCard,
} from "./sidebar";

const meta: Meta = {
  title: "Layout/Sidebar",
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

const navItems = [
  {
    title: "Overview",
    url: "/dashboard",
    icon: PanelsTopLeft,
    isActive: true,
  },
  {
    title: "Signals",
    url: "#",
    icon: Activity,
    items: [
      { title: "Connections", url: "/dashboard/connections" },
      { title: "Timeline", url: "/dashboard/timeline" },
    ],
  },
  {
    title: "Validation",
    url: "#",
    icon: CircleCheckBig,
    items: [
      { title: "Datasets", url: "/dashboard/datasets" },
      { title: "Agents", url: "/dashboard/agents" },
      { title: "Backtests / Replay", url: "/dashboard/backtests" },
    ],
  },
];

function PrimitiveSidebar() {
  return (
    <Sidebar collapsible="none">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Acme Inc</span>
                  <span className="truncate text-xs">Enterprise</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="relative">
          <label htmlFor="sidebar-story-search" className="sr-only">
            Search
          </label>
          <SidebarInput
            id="sidebar-story-search"
            placeholder="Type to search..."
            className="pl-7"
          />
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 opacity-50" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <Collapsible key={item.title} asChild defaultOpen={item.isActive}>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={item.isActive}>
                    <a href={item.url}>
                      <item.icon className="size-4" strokeWidth={1.75} />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                  {item.items?.length ? (
                    <>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuAction>
                          <MoreHorizontal />
                          <span className="sr-only">Toggle</span>
                        </SidebarMenuAction>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild>
                                <a href={subItem.url}>{subItem.title}</a>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </>
                  ) : null}
                </SidebarMenuItem>
              </Collapsible>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild size="sm">
                  <a href="#">
                    <LifeBuoy className="size-4" strokeWidth={1.75} />
                    <span>Support</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild size="sm">
                  <a href="#">
                    <Send className="size-4" strokeWidth={1.75} />
                    <span>Feedback</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarUserCard
          name="Ayman Saleh"
          email="ayman@chroniclelabs.org"
          onSignOut={() => console.log("sign out")}
        />
      </SidebarFooter>
    </Sidebar>
  );
}

function StoryHeader() {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-background px-4">
      <span className="text-sm text-muted-foreground">
        Sidebar remains expanded for the dashboard shell.
      </span>
    </header>
  );
}

export const PrimitiveComposition: Story = {
  render: () => (
    <SidebarProvider>
      <PrimitiveSidebar />
      <SidebarInset>
        <StoryHeader />
        <div className="grid gap-4 p-4 md:grid-cols-3">
          <div className="aspect-video rounded-xl bg-muted/50" />
          <div className="aspect-video rounded-xl bg-muted/50" />
          <div className="aspect-video rounded-xl bg-muted/50" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  ),
};

export const LegacyCompoundAliases: Story = {
  render: () => (
    <div className="grid min-h-screen grid-cols-[16rem_1fr] bg-background">
      <Sidebar variant="static">
        <Sidebar.Header>
          <div className="font-medium">Legacy namespace</div>
        </Sidebar.Header>
        <Sidebar.Status tone="nominal" label="System Nominal" trailing="live" />
        <Sidebar.Nav aria-label="Legacy nav">
          <Sidebar.NavSection title="Workspace">
            <Sidebar.NavItem
              icon={<PanelsTopLeft className="size-4" strokeWidth={1.75} />}
              isActive
            >
              Overview
            </Sidebar.NavItem>
            <Sidebar.NavItem
              icon={<Activity className="size-4" strokeWidth={1.75} />}
              status="BETA"
            >
              Signals
            </Sidebar.NavItem>
          </Sidebar.NavSection>
        </Sidebar.Nav>
        <Sidebar.Footer>
          <Sidebar.UserCard name="Ayman Saleh" email="ayman@chroniclelabs.org" />
        </Sidebar.Footer>
      </Sidebar>
      <main className="p-8">
        <h1 className="text-2xl font-semibold">Compatibility surface</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Existing dot-namespace consumers can keep compiling while new
          dashboard code uses the shadcn-compatible primitive exports.
        </p>
      </main>
    </div>
  ),
};
