"use client";

import * as React from "react";
import { cva } from "class-variance-authority";

/*
 * FormField is a layout shell that pairs a label, description, and error
 * slot with a single field child. Consumers pass `htmlFor` / ARIA wiring
 * explicitly when the child needs programmatic association.
 */

export const formFieldRootVariants = cva("flex flex-col gap-[6px]");

export const formFieldLabelVariants = cva(
  "font-sans text-[12px] font-medium tracking-normal text-l-ink-lo",
  {
    variants: {
      tone: {
        default: "text-ink-dim",
        auth: "text-ink-hi",
      },
    },
    compoundVariants: [
      { tone: "default", className: "text-l-ink-lo" },
      { tone: "auth", className: "text-l-ink" },
    ],
    defaultVariants: {
      tone: "default",
    },
  }
);

export const formFieldDescriptionVariants = cva(
  "leading-[1.5] font-sans text-[12px] text-l-ink-dim"
);

export const formFieldErrorVariants = cva(
  "leading-[1.5] text-event-red font-sans text-[12px]"
);

export interface FormFieldProps {
  children: React.ReactNode;
  label?: React.ReactNode;
  htmlFor?: string;
  description?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  tone?: "default" | "auth";
  className?: string;
  labelClassName?: string;
  descriptionClassName?: string;
  errorClassName?: string;
}

export function FormField({
  children,
  label,
  htmlFor,
  description,
  error,
  required = false,
  tone = "default",
  className,
  labelClassName,
  descriptionClassName,
  errorClassName,
}: FormFieldProps) {
  return (
    <div className={formFieldRootVariants({ className })}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className={formFieldLabelVariants({
            tone,
            className: labelClassName,
          })}
        >
          {label}
          {required ? (
            <span className="ml-[4px] text-event-red">*</span>
          ) : null}
        </label>
      ) : null}

      {children}

      {description ? (
        <p
          className={formFieldDescriptionVariants({
            className: descriptionClassName,
          })}
        >
          {description}
        </p>
      ) : null}

      {error ? (
        <p
          className={formFieldErrorVariants({
            className: errorClassName,
          })}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
