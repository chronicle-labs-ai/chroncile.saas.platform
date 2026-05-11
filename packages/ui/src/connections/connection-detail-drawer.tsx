"use client";

import * as React from "react";
import { ArrowUpRight } from "lucide-react";

import { CompanyLogo } from "../icons";
import { CopyButton } from "../primitives/copy-button";
import { Drawer } from "../primitives/drawer";
import { RouterLink, useNavigate } from "../layout/link-context";
import { getSource } from "../onboarding/data";
import { useIsCoarsePointer } from "../utils/use-is-coarse-pointer";
import { ConnectionHealthBadge } from "./connection-health-badge";
import {
  CONNECTION_DRAWER_TABS,
  ConnectionDetailBody,
  type ConnectionDetailBodyProps,
  type ConnectionDetailTab,
} from "./connection-detail-body";

/*
 * ConnectionDetailDrawer — slide-in right-edge drawer wrapping
 * `<ConnectionDetailBody />`. The drawer's own header replaces the
 * body's internal header so the workspace chrome doesn't double-up.
 *
 * Tab strategy: the drawer is sized for triage and only exposes a
 * thin tab strip (Overview + Activity) by default. Deeper config
 * tabs (Scopes, Secret, Backfills, Event types) live on the full
 * `/dashboard/connections/[id]` page route. The drawer header
 * exposes a "View full details" link wired through `detailHref`,
 * and a `Configure …` strip below the tabs deep-links into each
 * hidden tab on the full page.
 *
 * State (current tab, scope toggles, etc.) lives at the boundary;
 * pass through `tab` + `onTabChange` and the action callbacks.
 */

export interface ConnectionDetailDrawerProps
  extends Omit<ConnectionDetailBodyProps, "hideHeader" | "className"> {
  isOpen: boolean;
  onClose: () => void;
  /** Drawer width preset. Defaults to lg (~720px). */
  size?: React.ComponentProps<typeof Drawer>["size"];
  /**
   * Drawer placement. Defaults to `right` on fine pointers (desktop)
   * and `bottom` on coarse pointers (touch / mobile) — matches the
   * iOS native sheet pattern, including the drag-handle affordance.
   */
  placement?: React.ComponentProps<typeof Drawer>["placement"];
  /**
   * Canonical detail-page URL. When provided, the drawer header shows
   * a "View full details" link routing to this URL, and the hidden
   * tab strip in the body becomes a "Configure on detail page" hint.
   * Optional — when absent the drawer just renders the slim tab set.
   */
  detailHref?: string;
}

export function ConnectionDetailDrawer({
  isOpen,
  onClose,
  size = "lg",
  placement,
  connection,
  tab,
  onTabChange,
  tabs = CONNECTION_DRAWER_TABS,
  detailHref,
  ...rest
}: ConnectionDetailDrawerProps) {
  const coarse = useIsCoarsePointer();
  const effectivePlacement = placement ?? (coarse ? "bottom" : "right");
  const src = getSource(connection.source);
  const headerNode = (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-hairline bg-surface-02"
        aria-hidden
      >
        <CompanyLogo
          name={src?.name ?? connection.name}
          size={16}
          radius={4}
          fallbackBackground="var(--c-surface-02)"
          fallbackColor="var(--c-ink-dim)"
        />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-display text-[16px] leading-none tracking-[-0.02em] text-ink-hi">
          {connection.name}
        </span>
        <span className="flex min-w-0 items-center gap-2 font-mono text-mono-sm text-ink-dim">
          <span className="truncate">
            {src?.cat ?? "—"} · {connection.id}
          </span>
          <CopyButton
            text={connection.id}
            appearance="text"
            label="Copy"
            copiedLabel="Copied"
            aria-label="Copy connection id"
          />
        </span>
      </div>
      <ConnectionHealthBadge
        health={connection.health}
        size="sm"
        className="ml-auto"
        // Drawer is the singular focused-detail surface — pulse the
        // dot when we're showing a live stream so the user can tell
        // at a glance that the connection is currently emitting.
        pulse={connection.health === "live"}
      />
    </div>
  );

  const navigate = useNavigate();
  const handleJump = React.useCallback(
    (jumpTab: ConnectionDetailTab) => {
      if (!detailHref) return;
      const sep = detailHref.includes("?") ? "&" : "?";
      const target = `${detailHref}${sep}tab=${encodeURIComponent(jumpTab)}`;
      onClose();
      navigate(target);
    },
    [detailHref, navigate, onClose],
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      size={size}
      placement={effectivePlacement}
      title={headerNode}
    >
      <div className="flex flex-col gap-3">
        {detailHref ? (
          <RouterLink
            href={detailHref}
            prefetch={false}
            className="inline-flex w-fit items-center gap-1 rounded-xs font-mono text-mono-sm text-ember focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember hover:underline"
          >
            View full details
            <ArrowUpRight className="size-3" strokeWidth={1.75} />
          </RouterLink>
        ) : null}

        <ConnectionDetailBody
          connection={connection}
          tab={tab}
          onTabChange={onTabChange}
          tabs={tabs}
          hideHeader
          onJumpToFullDetail={detailHref ? handleJump : undefined}
          {...rest}
        />
      </div>
    </Drawer>
  );
}
