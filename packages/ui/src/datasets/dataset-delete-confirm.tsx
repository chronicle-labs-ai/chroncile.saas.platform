"use client";

import * as React from "react";

import { Button } from "../primitives/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../primitives/dialog";
import { Input } from "../primitives/input";

import { formatNumber } from "../connections/time";

import type { Dataset, DeleteDatasetHandler } from "./types";

/*
 * DatasetDeleteConfirm — destructive confirm dialog. Deleting a
 * dataset removes the dataset itself + all trace memberships;
 * the underlying traces (events) are not touched.
 *
 * When `dataset.traceCount > 0` the user is gated by a typed-name
 * confirmation: we only enable the destructive button once the
 * typed value matches the dataset name. The typed input renders in
 * `font-mono` so it visually echoes "this is destructive".
 */

export interface DatasetDeleteConfirmProps {
  dataset: Dataset | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: DeleteDatasetHandler;
  onError?: (err: unknown) => void;
}

export function DatasetDeleteConfirm({
  dataset,
  isOpen,
  onOpenChange,
  onDelete,
  onError,
}: DatasetDeleteConfirmProps) {
  const [typed, setTyped] = React.useState("");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setTyped("");
      setPending(false);
    }
  }, [isOpen, dataset?.id]);

  if (!dataset) return null;

  const requireTypedConfirm = dataset.traceCount > 0;
  const matchesName = typed.trim() === dataset.name;
  const canDelete = !requireTypedConfirm || matchesName;

  const handleDelete = async () => {
    if (!canDelete) return;
    if (!onDelete) {
      onOpenChange(false);
      return;
    }
    setPending(true);
    try {
      await onDelete({ id: dataset.id, cascade: requireTypedConfirm });
      onOpenChange(false);
    } catch (err) {
      (onError ?? console.error)(err);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[380px] max-w-[92vw]">
        <DialogHeader>
          <DialogTitle>Delete dataset</DialogTitle>
          <DialogDescription>
            This removes the dataset and all trace memberships. The underlying
            traces and events stay in place.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <div className="rounded-[3px] border border-l-border bg-l-surface-input px-3 py-2 font-sans text-[12.5px] text-l-ink">
            <div className="font-medium">{dataset.name}</div>
            <div className="mt-0.5 font-mono text-[11px] text-l-ink-dim">
              {formatNumber(dataset.traceCount)}{" "}
              {dataset.traceCount === 1 ? "trace" : "traces"}
              {dataset.eventCount != null
                ? ` · ${formatNumber(dataset.eventCount)} events`
                : ""}
            </div>
          </div>

          {requireTypedConfirm ? (
            <label className="flex flex-col gap-1.5">
              <span className="font-sans text-[11px] font-medium text-l-ink-lo">
                Type the dataset name to confirm
              </span>
              <Input
                density="compact"
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.currentTarget.value)}
                placeholder={dataset.name}
                className="font-mono text-[12px]"
              />
              <span className="font-sans text-[11px] text-l-ink-dim">
                Required because this dataset still has{" "}
                {formatNumber(dataset.traceCount)}{" "}
                {dataset.traceCount === 1 ? "trace" : "traces"}.
              </span>
            </label>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button density="compact" variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            density="compact"
            variant="critical"
            size="sm"
            isLoading={pending}
            disabled={!canDelete}
            onPress={handleDelete}
          >
            Delete dataset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
