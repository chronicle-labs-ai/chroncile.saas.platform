"use client";

import * as React from "react";

import { cn } from "../utils/cn";

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_ICON = "3rem";

type SidebarContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
}

export interface SidebarProviderProps
  extends React.ComponentPropsWithoutRef<"div"> {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const [openMobile, setOpenMobile] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const open = openProp ?? uncontrolledOpen;

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const setOpen = React.useCallback(
    (value: boolean) => {
      onOpenChange?.(value);
      if (openProp === undefined) setUncontrolledOpen(value);
    },
    [onOpenChange, openProp],
  );

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((value) => !value);
    } else {
      setOpen(!open);
    }
  }, [isMobile, open, setOpen]);

  const value = React.useMemo(
    () => ({
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile,
      toggleSidebar,
    }),
    [isMobile, open, openMobile, setOpen, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={value}>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          "group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-sidebar text-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export interface SidebarProps extends React.ComponentPropsWithoutRef<"aside"> {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset" | "fixed" | "static";
  collapsible?: "offcanvas" | "icon" | "none";
  width?: "sm" | "md" | "product" | "lg";
  density?: "compact" | "brand" | "product";
}

function SidebarRoot({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: SidebarProps) {
  const context = React.useContext(SidebarContext);
  const open = context?.isMobile ? context.openMobile : (context?.open ?? true);
  const staticVariant = variant === "static";

  if (staticVariant || collapsible === "none") {
    return (
      <aside
        data-slot="sidebar"
        data-state={open ? "expanded" : "collapsed"}
        data-side={side}
        data-variant={variant}
        data-collapsible={open ? "" : collapsible}
        className={cn(
          "group/sidebar peer flex h-full w-[var(--sidebar-width)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
          side === "right" && "border-l border-r-0",
          className,
        )}
        {...props}
      >
        {children}
      </aside>
    );
  }

  return (
    <div
      data-slot="sidebar"
      data-state={open ? "expanded" : "collapsed"}
      data-side={side}
      data-variant={variant}
      data-collapsible={open ? "" : collapsible}
      className={cn(
        "group/sidebar peer hidden text-sidebar-foreground md:block",
        className,
      )}
    >
      <div
        className={cn(
          "relative w-[var(--sidebar-width)] bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]/sidebar:w-0",
          "group-data-[side=right]/sidebar:rotate-180",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]/sidebar:w-[calc(var(--sidebar-width-icon)+1rem)]"
            : "group-data-[collapsible=icon]/sidebar:w-[var(--sidebar-width-icon)]",
        )}
      />
      <aside
        className={cn(
          "fixed inset-y-0 z-10 hidden h-svh w-[var(--sidebar-width)] transition-[left,right,width] duration-200 ease-linear md:flex",
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]/sidebar:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[collapsible=offcanvas]/sidebar:right-[calc(var(--sidebar-width)*-1)]",
          variant === "floating" || variant === "inset"
            ? "p-2 group-data-[collapsible=icon]/sidebar:w-[calc(var(--sidebar-width-icon)+1rem+2px)]"
            : "group-data-[collapsible=icon]/sidebar:w-[var(--sidebar-width-icon)] group-data-[side=left]/sidebar:border-r group-data-[side=right]/sidebar:border-l",
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          className={cn(
            "flex h-full w-full flex-col bg-sidebar text-sidebar-foreground",
            "group-data-[variant=floating]/sidebar:rounded-lg group-data-[variant=floating]/sidebar:border group-data-[variant=floating]/sidebar:border-sidebar-border group-data-[variant=floating]/sidebar:shadow",
          )}
        >
          {children}
        </div>
      </aside>
    </div>
  );
}

export function SidebarInset({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "relative flex min-w-0 flex-1 flex-col bg-background",
        "peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] peer-data-[variant=inset]:rounded-xl peer-data-[variant=inset]:shadow",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  );
}

export function SidebarContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]/sidebar:overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarFooter({
  className,
  padded,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { padded?: boolean }) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn(
        "flex flex-col gap-2 p-2",
        padded && "border-t border-sidebar-border",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarGroup({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  );
}

export function SidebarGroupLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn(
        "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2",
        "group-data-[collapsible=icon]/sidebar:-mt-8 group-data-[collapsible=icon]/sidebar:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarGroupContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      className={cn("w-full text-sm", className)}
      {...props}
    />
  );
}

export function SidebarMenu({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  );
}

export function SidebarMenuItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  );
}

export interface SidebarMenuButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string | React.ReactNode;
  size?: "default" | "sm" | "lg";
}

export function SidebarMenuButton({
  asChild = false,
  isActive = false,
  tooltip: _tooltip,
  size = "default",
  className,
  children,
  ...props
}: SidebarMenuButtonProps) {
  const classes = cn(
    "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md px-2 text-left text-sm outline-none ring-sidebar-ring",
    "transition-[width,height,padding,color,background-color] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "group-has-[[data-sidebar=menu-action]]/menu-item:pr-8",
    "data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground",
    "group-data-[collapsible=icon]/sidebar:!size-8 group-data-[collapsible=icon]/sidebar:!p-2",
    "[&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
    size === "sm" && "h-7 text-xs",
    size === "default" && "h-8",
    size === "lg" && "h-12 text-sm group-data-[collapsible=icon]/sidebar:!p-0",
    className,
  );

  const shared = {
    className: classes,
    "data-active": isActive || undefined,
    "data-sidebar": "menu-button",
    "data-size": size,
  };

  if (asChild && React.isValidElement(children)) {
    return mergeChild(children, { ...props, ...shared });
  }

  return (
    <button type="button" {...props} {...shared}>
      {children}
    </button>
  );
}

export interface SidebarMenuActionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  showOnHover?: boolean;
}

export function SidebarMenuAction({
  asChild = false,
  showOnHover = false,
  className,
  children,
  ...props
}: SidebarMenuActionProps) {
  const classes = cn(
    "absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform",
    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground",
    "after:absolute after:-inset-2 after:md:hidden group-data-[collapsible=icon]/sidebar:hidden [&>svg]:size-4 [&>svg]:shrink-0",
    showOnHover &&
      "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0",
    className,
  );

  const shared = {
    className: classes,
    "data-sidebar": "menu-action",
  };

  if (asChild && React.isValidElement(children)) {
    return mergeChild(children, { ...props, ...shared });
  }

  return (
    <button type="button" {...props} {...shared}>
      {children}
    </button>
  );
}

export function SidebarMenuSub({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      className={cn(
        "mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5",
        "group-data-[collapsible=icon]/sidebar:hidden",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarMenuSubItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"li">) {
  return <li data-slot="sidebar-menu-sub-item" className={className} {...props} />;
}

export interface SidebarMenuSubButtonProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  asChild?: boolean;
  isActive?: boolean;
  size?: "sm" | "md";
}

export function SidebarMenuSubButton({
  asChild = false,
  isActive = false,
  size = "md",
  className,
  children,
  ...props
}: SidebarMenuSubButtonProps) {
  const classes = cn(
    "flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground/80 outline-none ring-sidebar-ring",
    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground",
    "aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
    "group-data-[collapsible=icon]/sidebar:hidden [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
    size === "sm" && "text-xs",
    size === "md" && "text-sm",
    className,
  );

  if (asChild && React.isValidElement(children)) {
    return mergeChild(children, {
      ...props,
      className: classes,
      "data-active": isActive || undefined,
    });
  }

  return (
    <a className={classes} data-active={isActive || undefined} {...props}>
      {children}
    </a>
  );
}

export function SidebarInput({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"input">) {
  return (
    <input
      data-slot="sidebar-input"
      className={cn(
        "flex h-8 w-full rounded-md border border-sidebar-border bg-background px-2 text-sm outline-none shadow-none",
        "placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        className,
      )}
      {...props}
    />
  );
}

export interface SidebarNavItemProps {
  href?: string;
  isActive?: boolean;
  isDisabled?: boolean;
  icon?: React.ReactNode;
  status?: React.ReactNode;
  statusTone?: "nominal" | "ember" | "data" | "caution" | "critical";
  onPress?: () => void;
  className?: string;
  children: React.ReactNode;
}

export function SidebarNav({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"nav">) {
  return <nav data-slot="sidebar-nav" className={cn("flex-1", className)} {...props} />;
}

export function SidebarNavSection({
  title,
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { title?: React.ReactNode }) {
  return (
    <SidebarGroup className={className} {...props}>
      {title ? <SidebarGroupLabel>{title}</SidebarGroupLabel> : null}
      <SidebarGroupContent>
        <SidebarMenu>{children}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function SidebarNavItem({
  href,
  isActive,
  isDisabled,
  icon,
  status,
  onPress,
  className,
  children,
}: SidebarNavItemProps) {
  const content = (
    <>
      {icon}
      <span className="truncate">{children}</span>
      {status ? (
        <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          {status}
        </span>
      ) : null}
    </>
  );

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild={Boolean(href)}
        isActive={isActive}
        disabled={isDisabled}
        onClick={onPress}
        className={className}
      >
        {href ? (
          <a href={href} aria-current={isActive ? "page" : undefined}>
            {content}
          </a>
        ) : (
          content
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function SidebarStatus({
  label,
  trailing,
  tone,
  pulse: _pulse,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  label: React.ReactNode;
  trailing?: React.ReactNode;
  tone?: "nominal" | "data" | "caution" | "critical" | "ember" | "neutral";
  pulse?: boolean;
}) {
  const toneClass = {
    nominal: "text-event-green",
    data: "text-event-teal",
    caution: "text-event-amber",
    critical: "text-event-red",
    ember: "text-primary",
    neutral: "text-muted-foreground",
  }[tone ?? "neutral"];

  return (
    <div
      data-slot="sidebar-status"
      className={cn(
        "flex items-center justify-between border-y border-border px-4 py-2 text-xs text-muted-foreground",
        className,
      )}
      {...props}
    >
      <span className={toneClass}>{label}</span>
      {trailing ? <span>{trailing}</span> : null}
    </div>
  );
}

export function SidebarMeta({
  rows,
  title,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  rows: { label: React.ReactNode; value: React.ReactNode; tone?: string }[];
  title?: React.ReactNode;
}) {
  return (
    <div
      data-slot="sidebar-meta"
      className={cn("border-t border-border p-4 text-xs text-muted-foreground", className)}
      {...props}
    >
      {title ? <div className="mb-2 font-medium">{title}</div> : null}
      <div className="space-y-1">
        {rows.map((row, index) => (
          <div key={index} className="flex justify-between gap-3">
            <span>{row.label}</span>
            <span className="text-foreground">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SidebarUserCard({
  name,
  email,
  initials,
  trailing,
  onSignOut,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  initials?: string;
  onSignOut?: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      data-slot="sidebar-user-card"
      className={cn("flex items-center justify-between gap-2 p-2 text-sm", className)}
      {...props}
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{name ?? initials ?? "User"}</p>
        {email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
      </div>
      {trailing ??
        (onSignOut ? (
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Sign out
          </button>
        ) : null)}
    </div>
  );
}

function mergeChild(
  child: React.ReactElement,
  props: Record<string, unknown> & { className?: string },
) {
  const childProps = child.props as { className?: string };
  return React.cloneElement(child, {
    ...props,
    className: cn(childProps.className, props.className),
  } as React.HTMLAttributes<HTMLElement>);
}

interface SidebarNamespace {
  (props: SidebarProps): React.ReactElement;
  Header: typeof SidebarHeader;
  Status: typeof SidebarStatus;
  Nav: typeof SidebarNav;
  NavSection: typeof SidebarNavSection;
  NavItem: typeof SidebarNavItem;
  Meta: typeof SidebarMeta;
  Footer: typeof SidebarFooter;
  UserCard: typeof SidebarUserCard;
}

const Sidebar = SidebarRoot as SidebarNamespace;
Sidebar.Header = SidebarHeader;
Sidebar.Status = SidebarStatus;
Sidebar.Nav = SidebarNav;
Sidebar.NavSection = SidebarNavSection;
Sidebar.NavItem = SidebarNavItem;
Sidebar.Meta = SidebarMeta;
Sidebar.Footer = SidebarFooter;
Sidebar.UserCard = SidebarUserCard;

export { Sidebar };
export type SidebarDensity = "compact" | "brand" | "product";
export type SidebarHeaderProps = React.ComponentPropsWithoutRef<typeof SidebarHeader>;
export type SidebarStatusProps = React.ComponentPropsWithoutRef<typeof SidebarStatus>;
export type SidebarNavProps = React.ComponentPropsWithoutRef<typeof SidebarNav>;
export type SidebarNavSectionProps = React.ComponentPropsWithoutRef<typeof SidebarNavSection>;
export type SidebarMetaProps = React.ComponentPropsWithoutRef<typeof SidebarMeta>;
export type SidebarFooterProps = React.ComponentPropsWithoutRef<typeof SidebarFooter>;
export type SidebarUserCardProps = React.ComponentPropsWithoutRef<typeof SidebarUserCard>;
export type SidebarMetaRow = { label: React.ReactNode; value: React.ReactNode; tone?: string };
