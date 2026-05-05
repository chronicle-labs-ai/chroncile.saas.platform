"use client";

/*
 * Dashboard sidebar shell — Chronicle's product chrome.
 *
 * The shell is intentionally quiet:
 *   - The sidebar shares the page surface (`tone="canvas"`); a
 *     hairline rule on the inside edge separates it from the
 *     content room. No bg lift, no heavy borders.
 *   - The workspace switcher is a 28-pixel chip + two refined text
 *     lines. The previous filled-ember tile carried too much weight
 *     for a control users tap once a session.
 *   - Active state is derived from `currentPath` (passed in by a
 *     thin client wrapper that reads `usePathname()`), so the rail
 *     in the underlying primitive always reflects the actual route
 *     instead of a hardcoded flag on a single item.
 *   - The site-header toggle has a 44 × 44 invisible hit area, an
 *     `aria-pressed` mirror of the sidebar's open state, and
 *     `touch-action: manipulation` to suppress iOS double-tap zoom.
 */

import * as React from "react";
import {
  Activity,
  BadgeCheck,
  Bell,
  Bot,
  Boxes,
  Cable,
  ChevronsUpDown,
  Command,
  CreditCard,
  Database,
  Folder,
  History,
  Keyboard,
  LifeBuoy,
  LogOut,
  Moon,
  MoreHorizontal,
  PanelsTopLeft,
  Search,
  Send,
  Share,
  SidebarIcon,
  Sparkles,
  Sun,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  deriveInitials,
} from "../primitives/avatar";
import { Logo } from "../primitives/logo";
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
  useSidebar,
} from "./sidebar";
import { RouterLink, useNavigate } from "./link-context";
import { useSiteBreadcrumb } from "./site-breadcrumb";
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

/**
 * One organization the signed-in user is an active member of. Surfaced in
 * the workspace dropdown so the user can switch contexts. The shell itself
 * doesn't fetch this — the host app passes the list down.
 */
export interface DashboardShellOrganization {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  workosOrganizationId: string | null;
  role: string;
}

/*
 * Primary navigation — a flat list broken into labelled groups.
 *
 * We used to render Signals / Validation as collapsible parents with
 * their real destinations nested underneath. Nested rails inside a
 * rail read as two levels of hierarchy where the information
 * architecture only has one: every link here resolves to a top-level
 * `/dashboard/<thing>` page. Flattening keeps the click target on the
 * actual destination (one tap instead of expand-then-tap) and turns
 * the groupings into quiet section dividers — the pattern Linear /
 * Vercel / Height all use for product nav of this size.
 */
const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        title: "Overview",
        url: "/dashboard",
        icon: PanelsTopLeft,
        // Exact match — Overview is the bare /dashboard, not a prefix.
        match: "exact",
      },
    ],
  },
  {
    label: "Signals",
    items: [
      { title: "Connections", url: "/dashboard/connections", icon: Cable },
      { title: "Timeline", url: "/dashboard/timeline", icon: Activity },
    ],
  },
  {
    label: "Validation",
    items: [
      { title: "Datasets", url: "/dashboard/datasets", icon: Database },
      { title: "Environments", url: "/dashboard/environments", icon: Boxes },
      { title: "Agents", url: "/dashboard/agents", icon: Bot },
      { title: "Backtests / Replay", url: "/dashboard/backtests", icon: History },
    ],
  },
];

const defaultData = {
  navSecondary: [
    { title: "Support", url: "#", icon: LifeBuoy },
    { title: "Feedback", url: "#", icon: Send },
    { title: "Shortcuts", url: "#", icon: Keyboard },
  ],
};

/**
 * `pathname` matcher. Returns true when:
 *   - `match === "exact"` and the pathnames are identical, OR
 *   - `match === "prefix"` (default) and `pathname` begins with `target`
 *     followed by either nothing or a `/`. The trailing-segment guard
 *     keeps `/dashboard/agents-archive` from lighting up the
 *     "Agents" link.
 */
function isActivePath(
  pathname: string | undefined,
  target: string,
  match: "exact" | "prefix" = "prefix"
): boolean {
  if (!pathname || !target || target === "#") return false;
  if (match === "exact") return pathname === target;
  if (pathname === target) return true;
  return pathname.startsWith(`${target}/`);
}

const menuContentClassName =
  "w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-lg";
const menuIdentityClassName =
  "flex items-center gap-2 px-1 py-1.5 text-left text-[13px]";
const menuItemClassName =
  "flex items-center gap-2 rounded-sm px-2 py-1.5 font-sans text-[13px] leading-none";

export interface AppSidebarProps extends React.ComponentPropsWithoutRef<
  typeof Sidebar
> {
  user: DashboardShellUser;
  workspace?: DashboardShellWorkspace;
  signOutHref?: string;
  /**
   * Current pathname (typically the result of `usePathname()`). Used
   * to derive which nav item is active. Pass it from a client
   * wrapper — `AppSidebar` lives in the framework-agnostic `ui`
   * package and can't import `next/navigation` directly.
   */
  currentPath?: string;
  /**
   * All workspaces the user is an active member of. When more than one is
   * present, the workspace chip's dropdown shows a "Switch workspace"
   * section; clicking an entry navigates to the host's switch endpoint
   * (typically `/api/auth/switch-org?organizationId=…`). Empty / omitted
   * for single-workspace users.
   */
  organizations?: DashboardShellOrganization[];
  /** WorkOS organization id of the *currently active* workspace. */
  activeWorkosOrganizationId?: string | null;
  /**
   * Tenant id of the user's primary workspace. Marked with a "Primary"
   * label in the dropdown. The primary workspace is created at signup and
   * cannot be removed — it's the user's permanent home.
   */
  primaryTenantId?: string;
  /**
   * URL pattern used to switch organizations. The placeholder
   * `{organizationId}` is replaced with the WorkOS org id of the
   * destination workspace. Defaults to
   * `/api/auth/switch-org?organizationId={organizationId}&from=/dashboard`.
   */
  switchOrgHrefTemplate?: string;
}

export function AppSidebar({
  user,
  workspace,
  signOutHref = "/api/auth/sign-out",
  currentPath,
  organizations,
  activeWorkosOrganizationId,
  primaryTenantId,
  switchOrgHrefTemplate,
  className,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar
      tone="canvas"
      {...props}
      className={[
        "top-[var(--header-height)] h-[calc(100svh-var(--header-height))]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <SidebarHeader>
        <WorkspaceMenu
          workspace={workspace}
          organizations={organizations}
          activeWorkosOrganizationId={activeWorkosOrganizationId}
          primaryTenantId={primaryTenantId}
          switchOrgHrefTemplate={switchOrgHrefTemplate}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={navGroups} currentPath={currentPath} />
        <NavSecondary items={defaultData.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} signOutHref={signOutHref} />
      </SidebarFooter>
    </Sidebar>
  );
}

const DEFAULT_SWITCH_ORG_HREF =
  "/api/auth/switch-org?organizationId={organizationId}&from=/dashboard";

function buildSwitchOrgHref(
  template: string | undefined,
  organizationId: string
): string {
  return (template ?? DEFAULT_SWITCH_ORG_HREF).replace(
    "{organizationId}",
    encodeURIComponent(organizationId)
  );
}

function WorkspaceMenu({
  workspace,
  organizations,
  activeWorkosOrganizationId,
  primaryTenantId,
  switchOrgHrefTemplate,
}: {
  workspace?: DashboardShellWorkspace;
  organizations?: DashboardShellOrganization[];
  activeWorkosOrganizationId?: string | null;
  primaryTenantId?: string;
  switchOrgHrefTemplate?: string;
}) {
  const { theme, toggle } = useTheme();
  const nextTheme = theme === "light" ? "dark" : "light";
  const navigate = useNavigate();

  // Build the list of *other* workspaces (everything except the active one)
  // so the dropdown's "Switch workspace" section reads as actionable rows
  // rather than including a non-functional "you are here" entry.
  const switchableOrgs = (organizations ?? []).filter(
    (o) =>
      o.workosOrganizationId &&
      o.workosOrganizationId !== activeWorkosOrganizationId
  );

  /*
   * Workspace identity row.
   *
   * The chip is a 28-pixel rounded square that picks up an inset
   * hairline shadow instead of a real border — Emil prefers this
   * for finer chrome because it doesn't double-pixel against
   * adjacent strokes. The pulse-ember dot in the corner reads as
   * a quiet "live workspace" signal without resorting to a
   * full-tile coloured background.
   */
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <SidebarMenuButton
              size="default"
              aria-label="Workspace menu"
              className="h-10 gap-2.5 data-[state=open]:bg-[var(--c-row-hover)] data-[state=open]:text-foreground"
            >
              <WorkspaceChip />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-[13px] font-medium text-foreground">
                  {workspace?.name || "Chronicle"}
                </span>
                <span className="truncate text-[11px] font-normal text-l-ink-dim">
                  {workspace?.plan || "Workspace"}
                </span>
              </div>
              <ChevronsUpDown
                aria-hidden
                className="ml-auto size-3.5 shrink-0 text-l-ink-dim"
                strokeWidth={1.75}
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className={menuContentClassName}
            side="right"
            align="start"
            sideOffset={4}
          >
            <DropdownMenuSection className="p-0">
              <div className={menuIdentityClassName}>
                <WorkspaceChip />
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-[13px] font-medium text-foreground">
                    {workspace?.name || "Chronicle"}
                  </span>
                  <span className="truncate text-[11px] text-l-ink-dim">
                    {workspace?.plan || "Workspace"}
                  </span>
                </div>
              </div>
            </DropdownMenuSection>
            {switchableOrgs.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuSection title="Switch workspace">
                  {switchableOrgs.map((org) => {
                    const isPrimary = org.tenantId === primaryTenantId;
                    const href = buildSwitchOrgHref(
                      switchOrgHrefTemplate,
                      org.workosOrganizationId!
                    );
                    return (
                      <DropdownMenuItem
                        key={org.tenantId}
                        className={menuItemClassName}
                        onAction={() => {
                          // Full navigation: the switch endpoint sets the
                          // sealed cookie server-side and 302s back, which
                          // a client-side router can't handle.
                          window.location.assign(href);
                        }}
                      >
                        <span className="flex-1 truncate">
                          {org.tenantName}
                        </span>
                        {isPrimary ? (
                          <span className="ml-2 rounded bg-[var(--c-surface-02)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-l-ink-dim">
                            Primary
                          </span>
                        ) : null}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuSection>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuSection>
              <DropdownMenuItem
                className={menuItemClassName}
                onAction={() => navigate("/dashboard")}
              >
                <Command className="size-4" strokeWidth={1.75} />
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem
                className={menuItemClassName}
                onAction={() => navigate("/settings/team")}
              >
                <Users className="size-4" strokeWidth={1.75} />
                Team
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

/**
 * The workspace identity chip used by `WorkspaceMenu`. Hoisted so the
 * trigger and the dropdown identity row render the exact same node —
 * any future change (badge, status dot, monogram override) only has
 * to land in one place.
 */
function WorkspaceChip() {
  return (
    <div
      aria-hidden
      className="relative flex aspect-square size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--c-surface-02)] text-foreground shadow-[inset_0_0_0_1px_var(--c-hairline-strong)]"
    >
      <Logo
        variant="icon"
        theme="auto"
        className="h-3.5 w-3.5 opacity-90"
        aria-hidden
      />
      {/* Tiny ember pip in the corner — quiet "active workspace" signal */}
      <span
        aria-hidden
        className="absolute bottom-1 right-1 size-1 rounded-full bg-ember"
      />
    </div>
  );
}

export interface NavMainItem {
  title: string;
  url: string;
  icon: LucideIcon;
  match?: "exact" | "prefix";
  isActive?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavMainItem[];
}

/**
 * Primary nav list. Renders each `NavGroup` as its own `SidebarGroup`
 * with a small uppercase label. Inside a group, every item is a
 * single flat row — no collapsibles, no second rail. Active state is
 * resolved per-item directly from the current pathname.
 */
export function NavMain({
  groups,
  currentPath,
}: {
  groups: NavGroup[];
  currentPath?: string;
}) {
  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((item) => {
              const active =
                isActivePath(currentPath, item.url, item.match ?? "prefix") ||
                item.isActive === true;
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={item.title}
                  >
                    <RouterLink
                      href={item.url}
                      aria-current={active ? "page" : undefined}
                    >
                      <item.icon
                        aria-hidden
                        className="size-4"
                        strokeWidth={1.75}
                      />
                      <span>{item.title}</span>
                    </RouterLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
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
                  <item.icon
                    aria-hidden
                    className="size-4"
                    strokeWidth={1.75}
                  />
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
  const navigate = useNavigate();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <SidebarMenuButton
              size="default"
              aria-label="Account menu"
              className="h-10 gap-2.5 data-[state=open]:bg-[var(--c-row-hover)] data-[state=open]:text-foreground"
            >
              <Avatar size="sm" shape="square">
                {user.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
                <AvatarFallback>{deriveInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-[13px] font-medium text-foreground">
                  {user.name}
                </span>
                <span className="truncate text-[11px] font-normal text-l-ink-dim">
                  {user.email}
                </span>
              </div>
              <ChevronsUpDown
                aria-hidden
                className="ml-auto size-3.5 shrink-0 text-l-ink-dim"
                strokeWidth={1.75}
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className={menuContentClassName}
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuSection className="p-0">
              <div className={menuIdentityClassName}>
                <Avatar size="sm" shape="square">
                  {user.avatar ? (
                    <AvatarImage src={user.avatar} alt="" />
                  ) : null}
                  <AvatarFallback>{deriveInitials(user.name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-[13px] font-medium text-foreground">
                    {user.name}
                  </span>
                  <span className="truncate text-[11px] text-l-ink-dim">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuSection>
            <DropdownMenuSeparator />
            <DropdownMenuSection>
              <DropdownMenuItem className={menuItemClassName}>
                <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuSection>
            <DropdownMenuSeparator />
            <DropdownMenuSection title="Workspace">
              <DropdownMenuItem
                className={menuItemClassName}
                onAction={() => navigate("/settings/team")}
              >
                <Users aria-hidden className="size-4" strokeWidth={1.75} />
                Team
              </DropdownMenuItem>
            </DropdownMenuSection>
            <DropdownMenuSeparator />
            <DropdownMenuSection>
              <DropdownMenuItem className={menuItemClassName}>
                <BadgeCheck aria-hidden className="size-4" strokeWidth={1.75} />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem className={menuItemClassName}>
                <CreditCard aria-hidden className="size-4" strokeWidth={1.75} />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem className={menuItemClassName}>
                <Bell aria-hidden className="size-4" strokeWidth={1.75} />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuSection>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={menuItemClassName}
              onAction={() => (window.location.href = signOutHref)}
            >
              <LogOut aria-hidden className="size-4" strokeWidth={1.75} />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function SiteHeader() {
  const { toggleSidebar, open, isMobile, openMobile } = useSidebar();
  const expanded = isMobile ? openMobile : open;
  const crumbs = useSiteBreadcrumb();

  /* Fall back to a sensible default so empty routes don't render a
     bare logo. Pages register their own crumbs via
     `useSetSiteBreadcrumb` from the layout module. */
  const trail = crumbs.length > 0 ? crumbs : [{ label: "Overview" }];

  return (
    <header
      data-slot="site-header"
      className={[
        "sticky top-0 z-sticky flex w-full items-center bg-page",
        // Inset hairline keeps the seam crisp without doubling against
        // nearby strokes (the sidebar's right edge, breadcrumb dividers).
        "shadow-[inset_0_-1px_0_0_var(--c-hairline)]",
      ].join(" ")}
    >
      <div className="flex h-[var(--header-height)] w-full items-center gap-2 px-4">
        {/*
         * Toggle button — visual is 32 × 32 to match the rest of the
         * chrome density, but the `::after` pseudo extends the hit
         * area to the iOS-recommended 44 × 44. `aria-pressed`
         * mirrors the actual sidebar state so screen readers
         * announce "expanded" / "collapsed" without us having to
         * fork the icon.
         */}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          aria-pressed={expanded}
          className={[
            "relative inline-flex h-8 w-8 items-center justify-center rounded-md text-l-ink-lo touch-manipulation",
            "transition-colors duration-[150ms] ease-out motion-reduce:transition-none",
            "hover:bg-[var(--c-row-hover)] hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-l-ink-dim",
            "after:absolute after:inset-[-6px] after:content-['']",
          ].join(" ")}
        >
          <SidebarIcon aria-hidden className="size-4" strokeWidth={1.75} />
        </button>

        <div aria-hidden className="mr-2 h-4 w-px shrink-0 bg-hairline" />

        <nav aria-label="Breadcrumb" className="hidden sm:block">
          <ol className="flex items-center gap-2 text-[13px] text-l-ink-dim">
            <li>
              <RouterLink
                href="/dashboard"
                aria-label="Chronicle Labs"
                className="flex items-center text-l-ink-lo transition-colors duration-[150ms] ease-out hover:text-foreground motion-reduce:transition-none"
              >
                <Logo variant="wordmark" theme="auto" className="h-5 w-auto" />
              </RouterLink>
            </li>
            {trail.map((crumb, idx) => {
              const isLast = idx === trail.length - 1;
              return (
                <React.Fragment key={`${crumb.label}-${idx}`}>
                  <li aria-hidden className="text-l-ink-dim/70 select-none">
                    /
                  </li>
                  <li
                    className={
                      isLast ? "font-medium text-foreground" : "text-l-ink-lo"
                    }
                    aria-current={isLast ? "page" : undefined}
                  >
                    {!isLast && crumb.href ? (
                      <RouterLink
                        href={crumb.href}
                        className="transition-colors duration-[150ms] ease-out hover:text-foreground motion-reduce:transition-none"
                      >
                        {crumb.label}
                      </RouterLink>
                    ) : (
                      crumb.label
                    )}
                  </li>
                </React.Fragment>
              );
            })}
          </ol>
        </nav>

      </div>
    </header>
  );
}
