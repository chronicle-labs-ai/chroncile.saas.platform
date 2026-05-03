"use client";

import * as React from "react";

import { Drawer } from "../primitives/drawer";
import { CompanyLogo } from "../icons";
import { getSource } from "../onboarding/data";
import { ConnectionHealthBadge } from "./connection-health-badge";
import {
  ConnectionDetailBody,
  type ConnectionDetailBodyProps,
  type ConnectionDetailTab,
} from "./connection-detail-body";

/*
 * ConnectionDetailDrawer — slide-in right-edge drawer wrapping
 * `<ConnectionDetailBody />`. The drawer's own header replaces the
 * body's internal header so the workspace chrome doesn't double-up.
 *
 * State (current tab, scope toggles, etc.) lives at the boundary;
 * pass through `tab` + `onTabChange` and the action callbacks.
 */

export interface ConnectionDetailDrawerProps
  extends Omit<ConnectionDetailBodyProps, "hideHeader" | "className"> {
  isOpen: boolean;
  onClose: () => void;
  /** Drawer width preset. Defaults to lg (~480px in compact density). */
  size?: React.ComponentProps<typeof Drawer>["size"];
}

export function ConnectionDetailDrawer({
  isOpen,
  onClose,
  size = "lg",
  connection,
  tab,
  onTabChange,
  ...rest
}: ConnectionDetailDrawerProps) {
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
        <span className="truncate font-mono text-mono-sm text-ink-dim">
          {src?.cat ?? "—"} · {connection.id}
        </span>
      </div>
      <ConnectionHealthBadge
        health={connection.health}
        size="sm"
        className="ml-auto"
      />
    </div>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      size={size}
      placement="right"
      title={headerNode}
    >
      <ConnectionDetailBody
        connection={connection}
        tab={tab}
        onTabChange={onTabChange}
        hideHeader
        {...rest}
      />
    </Drawer>
  );
}
