"use client";

import * as React from "react";
import {
  Copy,
  Edit3,
  ExternalLink,
  Files,
  MoreHorizontal,
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

import type { Dataset } from "./types";

/*
 * DatasetActionsMenu — Linear-density dropdown rendered on
 * `DatasetCard` / `DatasetRow` / `DatasetDetailPage` headers.
 *
 *   Open ↗
 *   Edit
 *   Duplicate
 *   Copy ID
 *   ────
 *   Delete (red)
 *
 * Pure presentational: every action is a callback, the parent owns
 * the modal state for Edit / Delete and the toast for Copy ID.
 */

export interface DatasetActionsMenuProps {
  dataset: Dataset;
  /** Renders the trigger. Defaults to a small icon button — pass a
   *  custom trigger when embedding in a row that already has its own
   *  affordance. */
  trigger?: React.ReactNode;
  onOpen?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onCopyId?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function DatasetActionsMenu({
  dataset,
  trigger,
  onOpen,
  onEdit,
  onDuplicate,
  onCopyId,
  onDelete,
}: DatasetActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        {trigger ?? (
          <Button
            density="compact"
            variant="icon"
            size="sm"
            aria-label={`Actions for ${dataset.name}`}
          >
            <MoreHorizontal className="size-4" strokeWidth={1.75} />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent density="compact" align="end">
        <DropdownMenuSection>
          {onOpen ? (
            <DropdownMenuItem onAction={() => onOpen(dataset.id)}>
              <ExternalLink className="size-3.5" strokeWidth={1.75} />
              Open
            </DropdownMenuItem>
          ) : null}
          {onEdit ? (
            <DropdownMenuItem onAction={() => onEdit(dataset.id)}>
              <Edit3 className="size-3.5" strokeWidth={1.75} />
              Edit
            </DropdownMenuItem>
          ) : null}
          {onDuplicate ? (
            <DropdownMenuItem onAction={() => onDuplicate(dataset.id)}>
              <Files className="size-3.5" strokeWidth={1.75} />
              Duplicate
            </DropdownMenuItem>
          ) : null}
          {onCopyId ? (
            <DropdownMenuItem onAction={() => onCopyId(dataset.id)}>
              <Copy className="size-3.5" strokeWidth={1.75} />
              Copy ID
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuSection>
        {onDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem danger onAction={() => onDelete(dataset.id)}>
              <Trash2 className="size-3.5" strokeWidth={1.75} />
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
