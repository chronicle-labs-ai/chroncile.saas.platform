"use client";

import * as React from "react";
import {
  Activity,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  Settings,
  Trash2,
} from "lucide-react";

import { Button } from "../primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSection,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu";
import { type Connection } from "./data";

/*
 * ConnectionActionsMenu — the per-connection ⋯ menu shared between
 * `ConnectionRow` (list view) and `ConnectionCard` (grid view). All
 * callbacks are optional; the corresponding menu item is omitted when
 * its handler is missing.
 *
 * The menu items are health-aware:
 *   • paused          → "Resume"
 *   • everything else → "Pause"
 *   • expired/error   → "Re-authorize" surfaced
 *
 * Lives outside the row/card so they don't drift apart and so the menu
 * itself can be unit-tested in isolation.
 */

export interface ConnectionActionsMenuProps {
  connection: Connection;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onReauth?: (id: string) => void;
  onTest?: (id: string) => void;
  onSettings?: (id: string) => void;
  onDisconnect?: (id: string) => void;
  /**
   * Wrapper className for the trigger's positioning. The row/card uses
   * `relative z-[1]` so the trigger sits above the stretched-link
   * overlay — pass that here.
   */
  className?: string;
}

export function ConnectionActionsMenu({
  connection,
  onPause,
  onResume,
  onReauth,
  onTest,
  onSettings,
  onDisconnect,
  className,
}: ConnectionActionsMenuProps) {
  const isPaused = connection.health === "paused";
  const isErrored = connection.health === "error";
  const isExpired = connection.health === "expired";
  const showResume = isPaused && !!onResume;
  const showPause = !isPaused && !!onPause;
  const showReauth = (isExpired || isErrored) && !!onReauth;

  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button
            variant="icon"
            size="sm"
            aria-label={`Actions for ${connection.name}`}
          >
            <MoreHorizontal className="size-4" strokeWidth={1.75} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuSection>
            {showResume ? (
              <DropdownMenuItem onAction={() => onResume?.(connection.id)}>
                <Play className="size-4" strokeWidth={1.75} />
                Resume
              </DropdownMenuItem>
            ) : null}
            {showPause ? (
              <DropdownMenuItem onAction={() => onPause?.(connection.id)}>
                <Pause className="size-4" strokeWidth={1.75} />
                Pause
              </DropdownMenuItem>
            ) : null}
            {showReauth ? (
              <DropdownMenuItem onAction={() => onReauth?.(connection.id)}>
                <RefreshCw className="size-4" strokeWidth={1.75} />
                Re-authorize
              </DropdownMenuItem>
            ) : null}
            {onTest ? (
              <DropdownMenuItem onAction={() => onTest?.(connection.id)}>
                <Activity className="size-4" strokeWidth={1.75} />
                Test connection
              </DropdownMenuItem>
            ) : null}
            {onSettings ? (
              <DropdownMenuItem onAction={() => onSettings?.(connection.id)}>
                <Settings className="size-4" strokeWidth={1.75} />
                Settings
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuSection>
          {onDisconnect ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                danger
                onAction={() => onDisconnect?.(connection.id)}
              >
                <Trash2 className="size-4" strokeWidth={1.75} />
                Disconnect
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
