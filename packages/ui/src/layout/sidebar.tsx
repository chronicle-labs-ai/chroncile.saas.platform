"use client";

import * as React from "react";

import { cn } from "../utils/cn";

/*
 * Sidebar primitives — Chronicle's quiet take on the shadcn sidebar.
 *
 * Design intent (Emil's principles applied):
 *   - The sidebar shares the page surface (`tone="canvas"`) so the
 *     dashboard reads as one room with a hairline rule between
 *     navigation and content. The legacy raised tone (`tone="raised"`)
 *     stays the default to avoid regressing existing consumers.
 *   - Active state is signalled by a 2 px ember rail + soft selection
 *     wash + lifted ink, never by a font-weight change. Idle and
 *     active items use the same `font-medium` weight, so toggling
 *     selection causes zero layout shift.
 *   - Hover effects only apply on devices that actually support hover
 *     (Tailwind's `hover:` is wrapped in `(hover: hover)` via
 *     `hoverOnlyWhenSupported` in the workspace tailwind config).
 *   - Interactive controls carry `touch-manipulation` to suppress the
 *     iOS 300 ms double-tap delay and use a neutral focus ring; per
 *     Emil, focus outlines should not be brand-coloured.
 *   - Width transitions use a token-driven ease-out curve. Reduced
 *     motion is honoured by the global guard in `globals.css`.
 */

const SIDEBAR_WIDTH = "15rem";
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
          "group/sidebar-wrapper flex min-h-svh w-full text-foreground isolate has-[[data-variant=inset]]:bg-sidebar",
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
  /**
   * Surface tone.
   *   - `raised` (default) — `bg-sidebar` (`--c-surface-01`); the legacy
   *     shadcn-style behaviour. Reads as a slightly lifted slab.
   *   - `canvas` — shares the page surface (`--c-surface-00`). The
   *     sidebar and main content live on the same plane, separated
   *     by a hairline divider only. Quieter, Linear/Vercel-style.
   */
  tone?: "raised" | "canvas";
}

function SidebarRoot({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  tone = "raised",
  className,
  children,
  ...props
}: SidebarProps) {
  const context = React.useContext(SidebarContext);
  const open = context?.isMobile ? context.openMobile : (context?.open ?? true);
  const staticVariant = variant === "static";

  /*
   * Tone surface:
   *   - canvas: the sidebar shares the page surface. Separation comes
   *     from a single hairline divider on the inside edge, never a
   *     filled border, so the seam reads as a 1 px rule on standard
   *     displays and 0.5 px on retina (the underlying token already
   *     accounts for that).
   *   - raised: the legacy `bg-sidebar` slab + `border-sidebar-border`.
   *     Kept so existing surfaces (env-manager, primitive stories)
   *     don't regress.
   */
  const surfaceClass =
    tone === "canvas"
      ? "bg-page text-foreground"
      : "bg-sidebar text-sidebar-foreground";

  // Side-divider as inset shadow keeps the divider crisp without the
  // double-pixel feel of a real border, and lets the bg blend cleanly.
  const dividerClass =
    tone === "canvas"
      ? side === "right"
        ? "shadow-[inset_1px_0_0_0_var(--c-hairline)]"
        : "shadow-[inset_-1px_0_0_0_var(--c-hairline)]"
      : "";

  if (staticVariant || collapsible === "none") {
    return (
      <aside
        data-slot="sidebar"
        data-state={open ? "expanded" : "collapsed"}
        data-side={side}
        data-variant={variant}
        data-tone={tone}
        data-collapsible={open ? "" : collapsible}
        className={cn(
          "group/sidebar peer flex h-full w-[var(--sidebar-width)] shrink-0 flex-col",
          surfaceClass,
          dividerClass,
          // Only paint a real border when we're staying with the raised tone;
          // canvas tone uses the inset shadow above instead.
          tone === "raised" && "border-r border-sidebar-border",
          tone === "raised" && side === "right" && "border-l border-r-0",
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
      data-tone={tone}
      data-collapsible={open ? "" : collapsible}
      className={cn(
        "group/sidebar peer hidden md:block",
        tone === "canvas" ? "text-foreground" : "text-sidebar-foreground",
        className,
      )}
    >
      <div
        className={cn(
          "relative w-[var(--sidebar-width)] bg-transparent transition-[width] duration-[220ms] ease-out motion-reduce:transition-none",
          "group-data-[collapsible=offcanvas]/sidebar:w-0",
          "group-data-[side=right]/sidebar:rotate-180",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]/sidebar:w-[calc(var(--sidebar-width-icon)+1rem)]"
            : "group-data-[collapsible=icon]/sidebar:w-[var(--sidebar-width-icon)]",
        )}
      />
      <aside
        className={cn(
          "fixed inset-y-0 z-sticky hidden h-svh w-[var(--sidebar-width)] transition-[left,right,width] duration-[220ms] ease-out motion-reduce:transition-none md:flex",
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]/sidebar:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[collapsible=offcanvas]/sidebar:right-[calc(var(--sidebar-width)*-1)]",
          variant === "floating" || variant === "inset"
            ? "p-2 group-data-[collapsible=icon]/sidebar:w-[calc(var(--sidebar-width-icon)+1rem+2px)]"
            : "group-data-[collapsible=icon]/sidebar:w-[var(--sidebar-width-icon)]",
          // Real border only on raised tone.
          variant !== "floating" &&
            variant !== "inset" &&
            tone === "raised" &&
            "group-data-[side=left]/sidebar:border-r group-data-[side=right]/sidebar:border-l",
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          className={cn(
            "flex h-full w-full flex-col",
            surfaceClass,
            dividerClass,
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
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto chron-scrollbar group-data-[collapsible=icon]/sidebar:overflow-hidden",
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
        padded &&
          "border-t border-hairline group-data-[tone=canvas]/sidebar:border-hairline group-data-[tone=raised]/sidebar:border-sidebar-border",
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
  // Eyebrow-style: uppercase mono microcaps, dim ink, generous tracking.
  // The label is structural; it should never compete with nav items.
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn(
        "flex h-7 shrink-0 items-center px-2 font-mono text-[10px] font-medium uppercase tracking-[0.08em] leading-none text-l-ink-dim",
        "transition-[margin,opacity] duration-[150ms] ease-out motion-reduce:transition-none",
        "group-data-[collapsible=icon]/sidebar:-mt-7 group-data-[collapsible=icon]/sidebar:opacity-0",
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
  /*
   * Idle / hover / active language:
   *   - All three states share the same `font-medium` weight, so
   *     toggling selection causes zero layout shift (Emil's
   *     "no font weight change on selected" rule).
   *   - Idle ink is one step dimmer than active so the eye lands on
   *     the chosen page first.
   *   - Active state: a 2 px ember rail at the inner edge + soft
   *     `--c-row-selected` wash + lifted ink. The rail is rendered
   *     by a `::before` pseudo so it never participates in the flex
   *     measurement of the row.
   *   - Hover wash uses the page-wide `--c-row-hover` token. The
   *     `hover:` variant is wrapped in `(hover: hover) and (pointer:
   *     fine)` by the workspace tailwind config, so touch devices
   *     never see a stale pressed state.
   *   - Transitions are explicit (colors + opacity) and short
   *     (150 ms ease-out). The collapse-to-icon transition keeps
   *     `width/padding` on its own track.
   *   - Focus ring is a neutral hairline; brand-coloured outlines
   *     clash with the surrounding chrome.
   */
  const classes = cn(
    "peer/menu-button group/menu-button relative isolate flex w-full items-center gap-2 overflow-hidden rounded-md px-2 text-left font-medium outline-none touch-manipulation",
    // Idle / hover / focus / active colour states
    "text-l-ink-lo [&>svg]:text-l-ink-dim",
    "hover:bg-[var(--c-row-hover)] hover:text-foreground hover:[&>svg]:text-foreground",
    "focus-visible:ring-1 focus-visible:ring-l-ink-dim focus-visible:ring-offset-0",
    "active:bg-[var(--c-row-selected)] active:text-foreground",
    // Selected state: rail + wash + ink lift, no weight change
    "data-[active=true]:bg-[var(--c-row-selected)] data-[active=true]:text-foreground data-[active=true]:[&>svg]:text-foreground",
    "before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-4 before:w-[2px] before:-translate-y-1/2 before:rounded-full before:bg-ember before:opacity-0 before:transition-opacity before:duration-[150ms] before:ease-out motion-reduce:before:transition-none",
    "data-[active=true]:before:opacity-100",
    // Disabled
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    // Trailing space when an action sits beside the row
    "group-has-[[data-sidebar=menu-action]]/menu-item:pr-8",
    // Collapsed (icon-only) sizing override
    "group-data-[collapsible=icon]/sidebar:!size-8 group-data-[collapsible=icon]/sidebar:!p-2 group-data-[collapsible=icon]/sidebar:before:hidden",
    // Children rules
    "[&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:transition-colors [&>svg]:duration-[150ms] [&>svg]:ease-out",
    // Transition surface stays minimal — width/padding only here for the
    // collapse animation; colours have their own short ease-out.
    "transition-[width,height,padding,color,background-color] duration-[150ms] ease-out motion-reduce:transition-none",
    // Size variants
    size === "sm" && "h-7 text-[12px]",
    size === "default" && "h-8 text-[13px]",
    size === "lg" &&
      "h-12 text-[13px] group-data-[collapsible=icon]/sidebar:!p-0",
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
  /*
   * Trailing action (chevron / "more" dots): a 20 × 20 visual that
   * the parent menu-item reserves padding for. The pseudo `::after`
   * extends the hit area to ~36 px on all viewports so it remains
   * easy to tap without enlarging the visual. Per Emil, hover only
   * surfaces on devices that support it (handled by the workspace
   * tailwind config), and `transition: transform` is replaced by an
   * explicit colour/opacity transition so we never trip the
   * "transition: all" anti-pattern.
   */
  const classes = cn(
    "absolute right-1 top-1/2 -translate-y-1/2 flex aspect-square w-6 items-center justify-center rounded-md p-0 text-l-ink-dim outline-none touch-manipulation",
    "transition-[color,background-color,opacity,transform] duration-[150ms] ease-out motion-reduce:transition-none",
    "hover:bg-[var(--c-row-hover)] hover:text-foreground focus-visible:ring-1 focus-visible:ring-l-ink-dim peer-hover/menu-button:text-foreground",
    "after:absolute after:-inset-2 after:content-[''] group-data-[collapsible=icon]/sidebar:hidden [&>svg]:size-4 [&>svg]:shrink-0",
    showOnHover &&
      "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-foreground md:opacity-0",
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
  /*
   * Submenu list — softer than the legacy heavy left-rule.
   * Indent communicates hierarchy; we don't need a vertical rule.
   * The active item's own ember rail provides enough visual anchor.
   */
  return (
    <ul
      data-slot="sidebar-menu-sub"
      className={cn(
        "ml-7 mt-0.5 flex min-w-0 flex-col gap-0.5 py-0.5 pr-2",
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
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      className={cn("relative", className)}
      {...props}
    />
  );
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
  /*
   * Sub-button — same Emil language as the parent button (consistent
   * weight, neutral focus, ember rail on active, soft selection
   * wash) but at a quieter type scale and a slightly smaller rail
   * so children read as subordinate without resorting to italics
   * or weight changes.
   */
  const classes = cn(
    "relative isolate flex h-7 min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 font-medium text-l-ink-lo outline-none touch-manipulation",
    "transition-colors duration-[150ms] ease-out motion-reduce:transition-none",
    "hover:bg-[var(--c-row-hover)] hover:text-foreground",
    "focus-visible:ring-1 focus-visible:ring-l-ink-dim",
    "active:bg-[var(--c-row-selected)] active:text-foreground",
    "aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "data-[active=true]:bg-[var(--c-row-selected)] data-[active=true]:text-foreground",
    "before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-3 before:w-[2px] before:-translate-y-1/2 before:rounded-full before:bg-ember before:opacity-0 before:transition-opacity before:duration-[150ms] before:ease-out motion-reduce:before:transition-none",
    "data-[active=true]:before:opacity-100",
    "group-data-[collapsible=icon]/sidebar:hidden [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-l-ink-dim",
    size === "sm" && "text-[12px]",
    size === "md" && "text-[12px]",
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
      // Inputs must be at least 16 px on iOS to prevent the page-zoom
      // jump on focus; we ship 13 px on desktop and bump to 16 px on
      // narrow viewports via the responsive variant below.
      className={cn(
        "flex h-8 w-full rounded-md border border-hairline bg-l-surface-input px-2 text-[13px] outline-none shadow-none touch-manipulation",
        "placeholder:text-l-ink-dim",
        "transition-[border-color,background-color,box-shadow] duration-[150ms] ease-out motion-reduce:transition-none",
        "focus-visible:border-l-ink-dim focus-visible:ring-1 focus-visible:ring-l-ink-dim",
        "max-md:text-[16px]",
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
        // Trailing badge — quieter than the legacy ember-tinted chip.
        // Tabular nums so changing counters never shift the row.
        <span className="ml-auto rounded-sm bg-l-wash-3 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em] tabular-nums text-l-ink-dim">
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
    ember: "text-ember",
    neutral: "text-l-ink-dim",
  }[tone ?? "neutral"];

  return (
    <div
      data-slot="sidebar-status"
      className={cn(
        "flex items-center justify-between border-y border-hairline px-4 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim",
        className,
      )}
      {...props}
    >
      <span className={toneClass}>{label}</span>
      {trailing ? (
        <span className="tabular-nums text-l-ink-dim">{trailing}</span>
      ) : null}
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
      className={cn(
        "border-t border-hairline p-4 text-[12px] text-l-ink-dim",
        className,
      )}
      {...props}
    >
      {title ? (
        <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-l-ink-dim">
          {title}
        </div>
      ) : null}
      <div className="space-y-1">
        {rows.map((row, index) => (
          <div key={index} className="flex justify-between gap-3">
            <span>{row.label}</span>
            {/* tabular-nums prevents column drift when values change live */}
            <span className="tabular-nums text-foreground">{row.value}</span>
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
      className={cn(
        "flex items-center justify-between gap-2 p-2 text-[13px]",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">
          {name ?? initials ?? "User"}
        </p>
        {email ? (
          <p className="truncate text-[12px] text-l-ink-dim">{email}</p>
        ) : null}
      </div>
      {trailing ??
        (onSignOut ? (
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-md px-2 py-1 text-[12px] text-l-ink-dim transition-colors duration-[150ms] ease-out touch-manipulation hover:bg-[var(--c-row-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-l-ink-dim motion-reduce:transition-none"
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
