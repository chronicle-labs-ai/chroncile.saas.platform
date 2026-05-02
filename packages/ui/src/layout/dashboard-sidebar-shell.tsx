"use client";

import * as React from "react";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  ChevronsUpDown,
  Command,
  CreditCard,
  Folder,
  LifeBuoy,
  LogOut,
  Moon,
  MoreHorizontal,
  Activity,
  PanelsTopLeft,
  Search,
  Send,
  SidebarIcon,
  CircleCheckBig,
  Share,
  Sparkles,
  Sun,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { Avatar } from "../primitives/avatar";
import { Button } from "../primitives/button";
import { Logo } from "../primitives/logo";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../primitives/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSection,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "./sidebar";
import { RouterLink, useNavigate } from "./link-context";
import { useTheme } from "../theme";

export interface DashboardShellUser {
  name: string;
  email: string;
  avatar?: string | null;
}

export interface DashboardShellWorkspace {
  name: string;
  plan?: string | null;
}

const defaultData = {
  navMain: [
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
  ],
  navSecondary: [
    { title: "Support", url: "#", icon: LifeBuoy },
    { title: "Feedback", url: "#", icon: Send },
  ],
};

const menuContentClassName =
  "w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-lg";
const menuIdentityClassName =
  "flex items-center gap-2 px-1 py-1.5 text-left text-sm";
const menuItemClassName =
  "flex items-center gap-2 rounded-sm px-2 py-1.5 font-sans text-sm leading-none";

export interface AppSidebarProps
  extends React.ComponentPropsWithoutRef<typeof Sidebar> {
  user: DashboardShellUser;
  workspace?: DashboardShellWorkspace;
  signOutHref?: string;
}

export function AppSidebar({
  user,
  workspace,
  signOutHref = "/api/auth/sign-out",
  className,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar
      {...props}
      className={[
        "top-[var(--header-height)] h-[calc(100svh-var(--header-height))]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <SidebarHeader>
        <WorkspaceMenu workspace={workspace} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={defaultData.navMain} />
        <NavSecondary items={defaultData.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} signOutHref={signOutHref} />
      </SidebarFooter>
    </Sidebar>
  );
}

function WorkspaceMenu({
  workspace,
}: {
  workspace?: DashboardShellWorkspace;
}) {
  const { theme, toggle } = useTheme();
  const nextTheme = theme === "light" ? "dark" : "light";
  const navigate = useNavigate();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Command className="size-4" strokeWidth={1.75} />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {workspace?.name || "Chronicle"}
                </span>
                <span className="truncate text-xs">
                  {workspace?.plan || "Workspace"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" strokeWidth={1.75} />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className={menuContentClassName}
            density="compact"
            side="right"
            align="start"
            sideOffset={4}
          >
            <DropdownMenuSection className="p-0">
              <div className={menuIdentityClassName}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Command className="size-4" strokeWidth={1.75} />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {workspace?.name || "Chronicle"}
                  </span>
                  <span className="truncate text-xs">
                    {workspace?.plan || "Workspace"}
                  </span>
                </div>
              </div>
            </DropdownMenuSection>
            <DropdownMenuSeparator />
            <DropdownMenuSection>
              <DropdownMenuItem
                className={menuItemClassName}
                onAction={() => navigate("/dashboard")}
              >
                <Command className="size-4" strokeWidth={1.75} />
                Dashboard
              </DropdownMenuItem>
            </DropdownMenuSection>
            <DropdownMenuSeparator />
            <DropdownMenuSection title="Appearance">
              <DropdownMenuItem className={menuItemClassName} onAction={toggle}>
                {theme === "light" ? (
                  <Moon className="size-4" strokeWidth={1.75} />
                ) : (
                  <Sun className="size-4" strokeWidth={1.75} />
                )}
                Switch to {nextTheme} mode
              </DropdownMenuItem>
            </DropdownMenuSection>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
    isActive?: boolean;
    items?: { title: string; url: string }[];
  }[];
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <Collapsible key={item.title} asChild defaultOpen={item.isActive}>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={item.title}>
                <RouterLink href={item.url}>
                  <item.icon className="size-4" strokeWidth={1.75} />
                  <span>{item.title}</span>
                </RouterLink>
              </SidebarMenuButton>
              {item.items?.length ? (
                <>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuAction className="data-[state=open]:rotate-90">
                      <ChevronRight />
                      <span className="sr-only">Toggle</span>
                    </SidebarMenuAction>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild>
                            <RouterLink href={subItem.url}>
                              <span>{subItem.title}</span>
                            </RouterLink>
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
  );
}

export function NavProjects({
  projects,
}: {
  projects: { name: string; url: string; icon: LucideIcon }[];
}) {
  const { isMobile } = useSidebar();

  return (
    <SidebarGroup className="group-data-[collapsible=icon]/sidebar:hidden">
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        {projects.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton asChild>
              <RouterLink href={item.url}>
                  <item.icon className="size-4" strokeWidth={1.75} />
                <span>{item.name}</span>
              </RouterLink>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <SidebarMenuAction showOnHover>
                  <MoreHorizontal />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-48"
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                <DropdownMenuItem>
                  <Folder className="text-muted-foreground" />
                  <span>View Project</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Share className="text-muted-foreground" />
                  <span>Share Project</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem danger>
                  <Trash2 className="text-muted-foreground" />
                  <span>Delete Project</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
        <SidebarMenuItem>
          <SidebarMenuButton>
            <MoreHorizontal />
            <span>More</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function NavSecondary({
  items,
  ...props
}: {
  items: { title: string; url: string; icon: LucideIcon }[];
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild size="sm">
                <RouterLink href={item.url}>
                  <item.icon className="size-4" strokeWidth={1.75} />
                  <span>{item.title}</span>
                </RouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function NavUser({
  user,
  signOutHref,
}: {
  user: DashboardShellUser;
  signOutHref: string;
}) {
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar
                className="h-8 w-8 rounded-lg"
                src={user.avatar}
                name={user.name}
                alt={user.name}
              />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" strokeWidth={1.75} />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className={menuContentClassName}
            density="compact"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuSection className="p-0">
              <div className={menuIdentityClassName}>
                <Avatar
                  className="h-8 w-8 rounded-lg"
                  src={user.avatar}
                  name={user.name}
                  alt={user.name}
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuSection>
            <DropdownMenuSeparator />
            <DropdownMenuSection>
              <DropdownMenuItem className={menuItemClassName}>
                <Sparkles className="size-4" strokeWidth={1.75} />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuSection>
            <DropdownMenuSeparator />
            <DropdownMenuSection>
              <DropdownMenuItem className={menuItemClassName}>
                <BadgeCheck className="size-4" strokeWidth={1.75} />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem className={menuItemClassName}>
                <CreditCard className="size-4" strokeWidth={1.75} />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem className={menuItemClassName}>
                <Bell className="size-4" strokeWidth={1.75} />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuSection>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={menuItemClassName}
              onAction={() => (window.location.href = signOutHref)}
            >
              <LogOut className="size-4" strokeWidth={1.75} />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function SearchForm({ className, ...props }: React.ComponentProps<"form">) {
  return (
    <form className={className} {...props}>
      <div className="relative">
        <label htmlFor="dashboard-search" className="sr-only">
          Search
        </label>
        <SidebarInput
          id="dashboard-search"
          placeholder="Type to search..."
          className="h-8 pl-7"
        />
        <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 select-none opacity-50" />
      </div>
    </form>
  );
}

export function SiteHeader() {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="sticky top-0 z-50 flex w-full items-center border-b border-border bg-background">
      <div className="flex h-[var(--header-height)] w-full items-center gap-2 px-4">
        <Button
          className="h-8 w-8"
          variant="icon"
          size="sm"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <SidebarIcon className="size-4" strokeWidth={1.75} />
        </Button>
        <div className="mr-2 h-4 w-px shrink-0 bg-border" />
        <nav aria-label="Breadcrumb" className="hidden sm:block">
          <ol className="flex items-center gap-2 text-sm text-muted-foreground">
            <li>
              <RouterLink
                href="/dashboard"
                aria-label="Chronicle Labs"
                className="flex items-center transition-colors hover:text-foreground"
              >
              <Logo
                variant="wordmark"
                theme="auto"
                className="h-5 w-auto"
              />
              </RouterLink>
            </li>
            <li aria-hidden className="text-muted-foreground/70">
              /
            </li>
            <li className="font-medium text-foreground" aria-current="page">
              Overview
            </li>
          </ol>
        </nav>
        <SearchForm className="w-full sm:ml-auto sm:w-auto" />
      </div>
    </header>
  );
}
