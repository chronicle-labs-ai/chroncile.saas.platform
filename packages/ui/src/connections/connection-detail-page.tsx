"use client";

import * as React from "react";
import { ChevronLeft } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import {
  ConnectionDetailBody,
  type ConnectionDetailBodyProps,
} from "./connection-detail-body";

/*
 * ConnectionDetailPage — full-page layout for the per-connection
 * detail view (e.g. `/dashboard/connections/[id]`). Same content as
 * the drawer, but laid out at page width with a top breadcrumb +
 * back affordance instead of the drawer's slide-in chrome.
 */

export interface ConnectionDetailPageProps extends ConnectionDetailBodyProps {
  /** Workspace name shown in the breadcrumb. */
  workspace?: string;
  /** Click handler for the breadcrumb back link. */
  onBack?: () => void;
  /** Replace the breadcrumb with a fully custom chrome node. */
  chrome?: React.ReactNode;
}

export function ConnectionDetailPage({
  workspace = "Chronicle",
  onBack,
  chrome,
  className,
  ...rest
}: ConnectionDetailPageProps) {
  return (
    <div
      className={cx(
        "flex min-h-[calc(100svh-var(--header-height)-2rem)] flex-col gap-6 bg-black p-6 text-ink",
        className,
      )}
    >
      {chrome ?? (
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
            <span>{workspace}</span>
            <span>/</span>
            <span>Connections</span>
            <span>/</span>
            <span className="text-ember">{rest.connection.name}</span>
          </div>
          {onBack ? (
            <Button
              variant="ghost"
              size="sm"
              onPress={onBack}
              leadingIcon={<ChevronLeft className="size-3.5" strokeWidth={1.75} />}
            >
              Back to connections
            </Button>
          ) : null}
        </header>
      )}
      <div className="rounded-[2px] border border-divider bg-[rgba(255,255,255,0.012)] p-5">
        <ConnectionDetailBody {...rest} />
      </div>
    </div>
  );
}
