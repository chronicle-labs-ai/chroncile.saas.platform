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

import {
  DatasetForm,
  DATASET_FORM_EMPTY,
  isFormValid,
  parseTagsInput,
  type DatasetFormValues,
} from "./dataset-form";
import type {
  Dataset,
  UpdateDatasetHandler,
  UpdateDatasetPayload,
} from "./types";

/*
 * DatasetEditDialog — modal for renaming and re-tagging a dataset.
 * Wraps the shared `DatasetForm`; submit is disabled until the form
 * is dirty (something actually changed) AND valid (name non-empty).
 */

export interface DatasetEditDialogProps {
  /** Dataset to edit. When null, the dialog renders nothing. */
  dataset: Dataset | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: UpdateDatasetHandler;
  onError?: (err: unknown) => void;
}

function fromDataset(dataset: Dataset): DatasetFormValues {
  return {
    name: dataset.name,
    description: dataset.description ?? "",
    purpose: dataset.purpose ?? null,
    tagsInput: (dataset.tags ?? []).join(", "),
  };
}

function buildPatch(
  dataset: Dataset,
  values: DatasetFormValues,
): UpdateDatasetPayload["patch"] | null {
  const trimmedName = values.name.trim();
  const trimmedDescription = values.description.trim();
  const tags = parseTagsInput(values.tagsInput);
  const patch: UpdateDatasetPayload["patch"] = {};
  if (trimmedName !== dataset.name) patch.name = trimmedName;
  if ((trimmedDescription || undefined) !== (dataset.description || undefined)) {
    patch.description = trimmedDescription || undefined;
  }
  if ((values.purpose ?? undefined) !== (dataset.purpose ?? undefined)) {
    patch.purpose = values.purpose ?? undefined;
  }
  const tagsBefore = (dataset.tags ?? []).join("|");
  const tagsAfter = tags.join("|");
  if (tagsBefore !== tagsAfter) {
    patch.tags = tags;
  }
  return Object.keys(patch).length === 0 ? null : patch;
}

export function DatasetEditDialog({
  dataset,
  isOpen,
  onOpenChange,
  onUpdate,
  onError,
}: DatasetEditDialogProps) {
  const [values, setValues] = React.useState<DatasetFormValues>(DATASET_FORM_EMPTY);
  const [showErrors, setShowErrors] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const nameRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen && dataset) {
      setValues(fromDataset(dataset));
      setShowErrors(false);
      setPending(false);
      const id = window.setTimeout(() => nameRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [isOpen, dataset]);

  const patch = dataset ? buildPatch(dataset, values) : null;
  const isDirty = Boolean(patch);
  const isValid = isFormValid(values);

  const handleSubmit = async () => {
    if (!dataset) return;
    if (!isValid) {
      setShowErrors(true);
      nameRef.current?.focus();
      return;
    }
    if (!patch) {
      onOpenChange(false);
      return;
    }
    if (!onUpdate) {
      onOpenChange(false);
      return;
    }
    setPending(true);
    try {
      await onUpdate({ id: dataset.id, patch });
      onOpenChange(false);
    } catch (err) {
      (onError ?? console.error)(err);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={isOpen && !!dataset} onOpenChange={onOpenChange}>
      <DialogContent className="w-[420px] max-w-[92vw]">
        <DialogHeader>
          <DialogTitle>Edit dataset</DialogTitle>
          <DialogDescription>
            Rename, re-tag, or change the purpose. Trace memberships are not
            affected.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <DatasetForm
            values={values}
            onChange={setValues}
            onSubmit={handleSubmit}
            showErrors={showErrors}
            nameRef={nameRef}
          />
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button density="compact" variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            density="compact"
            variant="primary"
            size="sm"
            isLoading={pending}
            disabled={!isDirty || !isValid}
            onPress={handleSubmit}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
