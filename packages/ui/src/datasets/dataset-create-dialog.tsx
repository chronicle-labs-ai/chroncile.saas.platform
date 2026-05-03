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
import type { CreateDatasetHandler, CreateDatasetPayload } from "./types";

/*
 * DatasetCreateDialog — modal for creating a new dataset. Wraps the
 * shared `DatasetForm` in a Linear-density `Dialog`. Stays open while
 * the `onCreate` promise resolves so async backends can surface
 * server-side validation; the dialog closes only on success.
 */

export interface DatasetCreateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional initial values — used by the "Duplicate" action. */
  initialValues?: Partial<DatasetFormValues>;
  /** Async-friendly handler. Resolves with the created dataset on
   *  success; the dialog closes when the promise resolves. */
  onCreate?: CreateDatasetHandler;
  /** Optional error sink — bubbles handler errors back so the dialog
   *  can render an inline alert. Defaults to console.error. */
  onError?: (err: unknown) => void;
}

export function DatasetCreateDialog({
  isOpen,
  onOpenChange,
  initialValues,
  onCreate,
  onError,
}: DatasetCreateDialogProps) {
  const [values, setValues] = React.useState<DatasetFormValues>(() => ({
    ...DATASET_FORM_EMPTY,
    ...initialValues,
  }));
  const [showErrors, setShowErrors] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const nameRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setValues({ ...DATASET_FORM_EMPTY, ...initialValues });
      setShowErrors(false);
      setPending(false);
      const id = window.setTimeout(() => nameRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [isOpen, initialValues]);

  const handleSubmit = async () => {
    if (!isFormValid(values)) {
      setShowErrors(true);
      nameRef.current?.focus();
      return;
    }
    if (!onCreate) {
      onOpenChange(false);
      return;
    }
    const payload: CreateDatasetPayload = {
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      purpose: values.purpose ?? undefined,
      tags: parseTagsInput(values.tagsInput),
    };
    setPending(true);
    try {
      await onCreate(payload);
      onOpenChange(false);
    } catch (err) {
      (onError ?? console.error)(err);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[420px] max-w-[92vw]">
        <DialogHeader>
          <DialogTitle>Create dataset</DialogTitle>
          <DialogDescription>
            Group traces for evals, training, replay, or review. Add traces
            from the timeline inspector once the dataset is created.
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
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="primary"
            size="sm"
            isLoading={pending}
            onPress={handleSubmit}
          >
            Create dataset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
