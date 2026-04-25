import * as React from "react";
import { tv } from "../utils/tv";

/**
 * AppShell — three-column product shell: top-bar + left-nav + center +
 * optional right detail. Two density flavors:
 *
 *   density="compact" (default) — Linear-inspired product chrome
 *     • full-bleed `--l-surface*` backplane, no card border
 *     • 44px topbar, 40px filter bar, 208–224px nav
 *     • optional `filterBar` slot between topbar and content
 *
 *   density="brand" — original bordered card shell (marketing pages,
 *                     decks, the brand spec showcase)
 *     • `bg-surface-00` backplane wrapped in a `shadow-panel` card
 *     • 52px topbar, 240px nav
 *
 * Consumers render their own content into each slot; the shell takes
 * care of grid sizing, borders, and background surfaces.
 */
const appShell = tv({
  slots: {
    root: "grid overflow-hidden",
    topbar: "col-span-full flex items-center",
    filterBar: "col-span-full flex items-center",
    nav: "flex flex-col",
    main: "flex min-w-0 flex-col",
    detail: "flex flex-col",
    footer: "col-span-full",
  },
  variants: {
    density: {
      compact: {
        root: "bg-l-surface text-l-ink",
        topbar:
          "gap-s-2 border-b border-l-border bg-l-surface px-s-3",
        filterBar:
          "gap-[6px] border-b border-l-border bg-l-surface-bar px-s-3",
        nav: "border-r border-l-border bg-l-surface-bar-2",
        main: "bg-l-surface",
        detail: "border-l border-l-border bg-l-surface-raised",
      },
      brand: {
        root: "bg-surface-00 text-ink",
        topbar:
          "gap-s-5 border-b border-hairline bg-surface-01 px-s-5",
        filterBar:
          "gap-s-3 border-b border-hairline bg-surface-01 px-s-5",
        nav: "border-r border-hairline bg-surface-01 p-s-5",
        main: "bg-surface-00",
        detail: "border-l border-hairline bg-surface-01",
      },
    },
    bordered: {
      true: { root: "rounded-md border border-hairline-strong shadow-panel" },
    },
  },
  defaultVariants: { density: "compact", bordered: false },
});

export type AppShellDensity = "compact" | "brand";

export interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  topbar?: React.ReactNode;
  /** Optional filter bar between topbar and content. Compact density only. */
  filterBar?: React.ReactNode;
  nav?: React.ReactNode;
  detail?: React.ReactNode;
  footer?: React.ReactNode;
  /** Sidebar column width. Defaults to 224 (compact) / 240 (brand). */
  navWidth?: number;
  /** Detail column width. Pass 0 to collapse. Defaults to 380. */
  detailWidth?: number;
  /** Topbar height. Defaults to 44 (compact) / 52 (brand). */
  topbarHeight?: number;
  /** Filter-bar height. Defaults to 40 (compact only). */
  filterBarHeight?: number;
  /** Footer (minimap) height. Default 64px. */
  footerHeight?: number;
  /**
   * Wraps the shell in a card with a panel shadow + 1px border. Default
   * `false` in compact density (full-bleed app chrome), `true` in brand
   * density (marketing-style).
   */
  bordered?: boolean;
  density?: AppShellDensity;
}

export function AppShell({
  topbar,
  filterBar,
  nav,
  detail,
  footer,
  children,
  density = "compact",
  navWidth,
  detailWidth = 380,
  topbarHeight,
  filterBarHeight = 40,
  footerHeight = 64,
  bordered,
  className,
  style,
  ...props
}: AppShellProps) {
  const resolvedBordered = bordered ?? density === "brand";
  const resolvedNavWidth = navWidth ?? (density === "compact" ? 224 : 240);
  const resolvedTopbarHeight =
    topbarHeight ?? (density === "compact" ? 44 : 52);

  const slots = appShell({ density, bordered: resolvedBordered });

  const hasDetail = detail != null && detailWidth !== 0;

  const gridCols = hasDetail
    ? `${resolvedNavWidth}px 1fr ${detailWidth}px`
    : `${resolvedNavWidth}px 1fr`;

  const gridRows = [
    topbar ? `${resolvedTopbarHeight}px` : null,
    filterBar ? `${filterBarHeight}px` : null,
    "1fr",
    footer ? `${footerHeight}px` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      data-density={density}
      className={slots.root({ className })}
      style={{
        gridTemplateColumns: gridCols,
        gridTemplateRows: gridRows,
        ...style,
      }}
      {...props}
    >
      {topbar ? (
        <div
          data-slot="appshell-topbar"
          className={slots.topbar()}
          style={{ height: resolvedTopbarHeight }}
        >
          {topbar}
        </div>
      ) : null}
      {filterBar ? (
        <div
          data-slot="appshell-filterbar"
          className={slots.filterBar()}
          style={{ height: filterBarHeight }}
        >
          {filterBar}
        </div>
      ) : null}
      {nav ? (
        <aside data-slot="appshell-nav" className={slots.nav()}>
          {nav}
        </aside>
      ) : null}
      <section data-slot="appshell-main" className={slots.main()}>
        {children}
      </section>
      {hasDetail ? (
        <aside data-slot="appshell-detail" className={slots.detail()}>
          {detail}
        </aside>
      ) : null}
      {footer ? (
        <div
          data-slot="appshell-footer"
          className={slots.footer()}
          style={{ height: footerHeight }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
