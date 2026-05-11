"use client";

import * as React from "react";
import {
  Activity,
  Copy,
  ExternalLink,
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
import { useCopy } from "../utils/use-copy";
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
 * Always-on items (independent of state):
 *   • Copy id          — `connection.id` to clipboard, with a transient
 *                        "Copied id" confirmation
 *   • Open in new tab  — when `onOpenInNewTab` is provided, fires a
 *                        navigation handler so customers can pop the
 *                        full detail page without losing their place
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
   * Optional click handler for the "Open in new tab" item. When omitted,
   * the item is hidden. Wire to the consumer's router so the underlying
   * tab opens at the canonical detail page URL.
   */
  onOpenInNewTab?: (id: string) => void;
  /**
   * Wrapper className for the trigger's positioning. Row/card containers
   * use a stretched-link activator behind their contents, so the actions
   * trigger lives in a `pointer-events-auto` zone with `stop propagation`
   * to keep its clicks out of the parent activator.
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
  onOpenInNewTab,
  className,
}: ConnectionActionsMenuProps) {
  const isPaused = connection.health === "paused";
  const isErrored = connection.health === "error";
  const isExpired = connection.health === "expired";
  const showResume = isPaused && !!onResume;
  const showPause = !isPaused && !!onPause;
  const showReauth = (isExpired || isErrored) && !!onReauth;
  const isPending = connection.lastTestStatus === "pending";
  const { copy, copied } = useCopy();

  return (
    <div
      className={className}
      onClick={(e) => {
        // Stop the parent stretched-link / row anchor from firing.
        e.stopPropagation();
      }}
    >
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
              <DropdownMenuItem
                onAction={() => onTest?.(connection.id)}
                disabled={isPending}
              >
                <Activity className="size-4" strokeWidth={1.75} />
                {isPending ? "Testing\u2026" : "Test connection"}
              </DropdownMenuItem>
            ) : null}
            {onSettings ? (
              <DropdownMenuItem onAction={() => onSettings?.(connection.id)}>
                <Settings className="size-4" strokeWidth={1.75} />
                Settings
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuSection>
          <DropdownMenuSeparator />
          <DropdownMenuSection>
            <DropdownMenuItem
              onAction={() => {
                void copy(connection.id);
              }}
            >
              <Copy className="size-4" strokeWidth={1.75} />
              {copied ? "Copied id" : "Copy id"}
            </DropdownMenuItem>
            {onOpenInNewTab ? (
              <DropdownMenuItem
                onAction={() => onOpenInNewTab(connection.id)}
              >
                <ExternalLink className="size-4" strokeWidth={1.75} />
                Open in new tab
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
