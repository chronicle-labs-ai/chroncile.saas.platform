"use client";

import * as React from "react";
import {
  Copy,
  ExternalLink,
  Hash,
  History,
  MoreHorizontal,
  Pin,
  PinOff,
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

import type { AgentSummary } from "./types";

/*
 * AgentActionsMenu — Linear-density dropdown rendered on `AgentCard`,
 * `AgentRow`, and the detail-page header.
 *
 *   Open ↗
 *   Pin / Unpin latest
 *   ────
 *   Copy artifactId
 *   Copy configHash
 *   Open in hash search
 *
 * Read-only surface: there is no "delete agent" action because
 * artifacts are immutable in the registry. Pinning a version is the
 * only mutation we expose — and it stays optional via `onPinLatest`.
 */

export interface AgentActionsMenuProps {
  agent: AgentSummary;
  trigger?: React.ReactNode;
  onOpen?: (name: string) => void;
  onPinLatest?: (name: string) => void;
  onUnpinLatest?: (name: string) => void;
  isPinned?: boolean;
  onCopyArtifactId?: (artifactId: string) => void;
  onCopyConfigHash?: (configHash: string) => void;
  /** Optional configHash to expose in the menu — pulled from the
   *  current version's artifact. */
  configHash?: string;
  onOpenHashSearch?: (artifactId: string) => void;
}

export function AgentActionsMenu({
  agent,
  trigger,
  onOpen,
  onPinLatest,
  onUnpinLatest,
  isPinned,
  onCopyArtifactId,
  onCopyConfigHash,
  configHash,
  onOpenHashSearch,
}: AgentActionsMenuProps) {
  const artifactId = `${agent.name}@${agent.latestVersion}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        {trigger ?? (
          <Button
            density="compact"
            variant="icon"
            size="sm"
            aria-label={`Actions for ${agent.name}`}
          >
            <MoreHorizontal className="size-4" strokeWidth={1.75} />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent density="compact" align="end">
        <DropdownMenuSection>
          {onOpen ? (
            <DropdownMenuItem onAction={() => onOpen(agent.name)}>
              <ExternalLink className="size-3.5" strokeWidth={1.75} />
              Open
            </DropdownMenuItem>
          ) : null}
          {isPinned && onUnpinLatest ? (
            <DropdownMenuItem onAction={() => onUnpinLatest(agent.name)}>
              <PinOff className="size-3.5" strokeWidth={1.75} />
              Unpin {agent.latestVersion}
            </DropdownMenuItem>
          ) : !isPinned && onPinLatest ? (
            <DropdownMenuItem onAction={() => onPinLatest(agent.name)}>
              <Pin className="size-3.5" strokeWidth={1.75} />
              Pin {agent.latestVersion} as current
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuSection>
        <DropdownMenuSeparator />
        <DropdownMenuSection>
          {onCopyArtifactId ? (
            <DropdownMenuItem onAction={() => onCopyArtifactId(artifactId)}>
              <Copy className="size-3.5" strokeWidth={1.75} />
              Copy artifactId
            </DropdownMenuItem>
          ) : null}
          {onCopyConfigHash && configHash ? (
            <DropdownMenuItem onAction={() => onCopyConfigHash(configHash)}>
              <Hash className="size-3.5" strokeWidth={1.75} />
              Copy configHash
            </DropdownMenuItem>
          ) : null}
          {onOpenHashSearch ? (
            <DropdownMenuItem onAction={() => onOpenHashSearch(artifactId)}>
              <History className="size-3.5" strokeWidth={1.75} />
              Find related runs
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuSection>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
