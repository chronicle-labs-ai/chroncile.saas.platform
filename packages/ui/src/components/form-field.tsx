import * as React from "react";

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
  className = "",
  labelClassName = "",
  descriptionClassName = "",
  errorClassName = "",
}: FormFieldProps) {
  const labelClasses = [
    tone === "default"
      ? "label block mb-1.5"
      : "block text-sm font-medium text-[hsl(0,0%,8%)] mb-1.5",
    labelClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const descriptionClasses = [
    tone === "default"
      ? "mt-1 text-[10px] text-tertiary"
      : "mt-2 text-xs text-[hsl(0,0%,45%)]",
    descriptionClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const errorClasses = [
    tone === "default"
      ? "mt-2 text-xs text-critical"
      : "mt-2 text-xs text-[#ff3b3b]",
    errorClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      {label ? (
        <label htmlFor={htmlFor} className={labelClasses}>
          {label}
          {required ? " *" : null}
        </label>
      ) : null}
      {children}
      {description ? <p className={descriptionClasses}>{description}</p> : null}
      {error ? <p className={errorClasses}>{error}</p> : null}
    </div>
  );
}
