"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import { Input } from "../primitives/input";
import { Textarea } from "../primitives/textarea";
import { Radio, RadioGroup } from "../primitives/radio";

import { DATASET_PURPOSE_META } from "./purpose-meta";
import type { DatasetPurpose } from "./types";

/*
 * DatasetForm — shared field group for the create + edit dialogs.
 *
 * Controlled component: parent owns the values. Returns `isValid` +
 * `isDirty` so the dialog can disable submit when there's nothing to
 * save / when the name is blank. Parents pass `initialValues` to seed
 * the form (the Edit dialog uses this; Create starts empty).
 *
 * Linear-density throughout: stacked fields, 11px sans-medium labels
 * in `text-l-ink-lo`, 11px helper text in `text-l-ink-dim`.
 */

export interface DatasetFormValues {
  name: string;
  description: string;
  purpose: DatasetPurpose | null;
  /** Comma- or newline-separated tags edited inline. */
  tagsInput: string;
}

export interface DatasetFormProps {
  values: DatasetFormValues;
  onChange: (next: DatasetFormValues) => void;
  /** Emit-on-Enter shortcut for the keyboard-friendly Submit. */
  onSubmit?: () => void;
  /** Show inline error states on the name field. Defaults to false. */
  showErrors?: boolean;
  className?: string;
  /** Forwarded to the name input — used by the dialog to pin focus. */
  nameRef?: React.Ref<HTMLInputElement>;
}

export const DATASET_FORM_EMPTY: DatasetFormValues = {
  name: "",
  description: "",
  purpose: null,
  tagsInput: "",
};

/** Convert the textual tag input to a deduped, trimmed list. */
export function parseTagsInput(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    ),
  );
}

export function isFormValid(values: DatasetFormValues): boolean {
  return values.name.trim().length > 0;
}

const PURPOSES: DatasetPurpose[] = ["eval", "training", "replay", "review"];

export function DatasetForm({
  values,
  onChange,
  onSubmit,
  showErrors,
  className,
  nameRef,
}: DatasetFormProps) {
  const nameError = showErrors && values.name.trim().length === 0;

  const handlePurposeChange = (next: string) => {
    onChange({ ...values, purpose: next as DatasetPurpose });
  };

  return (
    <div className={cx("flex flex-col gap-3.5", className)}>
      <Field
        label="Name"
        helper="Required. Shows up in the dataset list and the trace inspector."
        error={nameError ? "Pick a name to identify this dataset." : undefined}
      >
        <Input
          ref={nameRef}
          density="compact"
          autoFocus
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.currentTarget.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSubmit?.();
            }
          }}
          placeholder="Eval suite v3"
          invalid={Boolean(nameError)}
        />
      </Field>

      <Field
        label="Description"
        helper="Optional. A line about how this dataset will be used."
      >
        <Textarea
          density="compact"
          rows={3}
          value={values.description}
          onChange={(e) =>
            onChange({ ...values, description: e.currentTarget.value })
          }
          placeholder="Hand-picked traces used to gate releases on the agent regression suite."
        />
      </Field>

      <Field label="Purpose" helper="Drives the colored badge and routing.">
        <RadioGroup
          density="compact"
          value={values.purpose ?? undefined}
          onValueChange={handlePurposeChange}
          className="grid grid-cols-2 gap-2"
        >
          {PURPOSES.map((purpose) => {
            const meta = DATASET_PURPOSE_META[purpose];
            const PurposeIcon = meta.Icon;
            return (
              <label
                key={purpose}
                className={cx(
                  "flex cursor-pointer items-center gap-2.5 rounded-[3px] border border-l-border bg-l-surface-input px-2.5 py-2",
                  "hover:border-l-border-strong",
                  values.purpose === purpose
                    ? "border-l-border-strong bg-l-surface-hover"
                    : null,
                )}
              >
                <Radio value={purpose} aria-label={meta.label} />
                <span
                  className={cx(
                    "flex size-5 items-center justify-center rounded-[2px]",
                    meta.tile,
                  )}
                  aria-hidden
                >
                  <PurposeIcon
                    className={cx("size-3", meta.ink)}
                    strokeWidth={1.6}
                  />
                </span>
                <span className="font-sans text-[12.5px] text-l-ink">
                  {meta.label}
                </span>
              </label>
            );
          })}
        </RadioGroup>
      </Field>

      <Field
        label="Tags"
        helper="Comma- or newline-separated. Tags help filter the dataset list."
      >
        <Input
          density="compact"
          value={values.tagsInput}
          onChange={(e) =>
            onChange({ ...values, tagsInput: e.currentTarget.value })
          }
          placeholder="regression, support"
        />
      </Field>
    </div>
  );
}

interface FieldProps {
  label: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, helper, error, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-sans text-[11px] font-medium text-l-ink-lo">
        {label}
      </span>
      {children}
      {error ? (
        <span className="font-sans text-[11px] text-event-red">{error}</span>
      ) : helper ? (
        <span className="font-sans text-[11px] leading-snug text-l-ink-dim">
          {helper}
        </span>
      ) : null}
    </label>
  );
}
