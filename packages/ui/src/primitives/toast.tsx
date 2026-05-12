"use client";

/*
 * Toast — small module-level queue rendered by a single ToastProvider.
 *
 * Usage:
 *   // Once, at app root:
 *   <ToastProvider>
 *     …app…
 *   </ToastProvider>
 *
 *   // Anywhere:
 *   const toast = useToast();
 *   toast.add({ title: "Saved", tone: "success" });
 *
 * A toast is a plain object `{ title, description?, tone?, action? }`.
 */

import * as React from "react";
import { cva } from "class-variance-authority";

export const toastRegionVariants = cva(
  "fixed top-s-4 right-s-4 z-50 flex flex-col gap-s-2 outline-none"
);

export const toastVariants = cva(
  "relative pointer-events-auto flex items-start gap-s-3 border shadow-panel min-w-[260px] max-w-[440px] outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember rounded-md bg-l-surface-raised px-[12px] py-[10px]",
  {
    variants: {
      tone: {
        default: "",
        success: "",
        danger: "",
        info: "",
        warning: "",
      },
    },
    compoundVariants: [
      { tone: "default", className: "border-hairline-strong" },
      { tone: "success", className: "border-event-green/40" },
      { tone: "danger", className: "border-event-red/40" },
      { tone: "info", className: "border-event-teal/40" },
      { tone: "warning", className: "border-event-amber/40" },
    ],
    defaultVariants: {
      tone: "default",
    },
  }
);

export const toastContentVariants = cva("flex-1 flex flex-col gap-s-1");

export const toastTitleVariants = cva(
  "font-sans text-[13px] font-medium text-l-ink"
);

export const toastDescriptionVariants = cva(
  "font-sans text-[13px] text-l-ink-lo"
);

export const toastActionVariants = cva(
  "inline-flex items-center border outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember rounded-md border-hairline-strong bg-l-surface-input px-[8px] py-[4px] font-sans text-[12px] font-medium text-l-ink hover:bg-l-surface-hover hover:text-l-ink"
);

export const toastCloseVariants = cva(
  "inline-flex items-center justify-center outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember h-5 w-5 rounded-md text-l-ink-dim hover:bg-l-surface-hover hover:text-l-ink"
);

export type ToastTone = "default" | "success" | "danger" | "info" | "warning";

export interface ChronicleToastContent {
  title: React.ReactNode;
  description?: React.ReactNode;
  tone?: ToastTone;
  /**
   * Optional action rendered as a button at the right edge. Calling the
   * returned handler automatically dismisses the toast.
   */
  action?: { label: string; onClick?: () => void; onPress?: () => void };
}

interface ToastRecord {
  key: string;
  content: ChronicleToastContent;
}

let toasts: ToastRecord[] = [];
const listeners = new Set<() => void>();

function notifyToastListeners() {
  listeners.forEach((listener) => listener());
}

function subscribeToasts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function addToast(content: ChronicleToastContent, timeout = 5000) {
  const key = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  toasts = [...toasts, { key, content }].slice(-5);
  notifyToastListeners();
  if (timeout > 0) {
    window.setTimeout(() => closeToast(key), timeout);
  }
  return key;
}

function closeToast(key: string) {
  toasts = toasts.filter((toast) => toast.key !== key);
  notifyToastListeners();
}

export interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [items, setItems] = React.useState(toasts);

  React.useEffect(
    () =>
      subscribeToasts(() => {
        setItems([...toasts]);
      }),
    []
  );

  return (
    <>
      {children}
      <div className={toastRegionVariants()} role="region" aria-live="polite">
        {items.map((toast) => {
          const tone = toast.content.tone ?? "default";
          return (
            <div
              key={toast.key}
              role="status"
              className={toastVariants({ tone })}
            >
              <div className={toastContentVariants()}>
                <div className={toastTitleVariants()}>
                  {toast.content.title}
                </div>
                {toast.content.description ? (
                  <div className={toastDescriptionVariants()}>
                    {toast.content.description}
                  </div>
                ) : null}
              </div>
              {toast.content.action ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.content.action?.onClick?.();
                    toast.content.action?.onPress?.();
                    closeToast(toast.key);
                  }}
                  className={toastActionVariants()}
                >
                  {toast.content.action.label}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => closeToast(toast.key)}
                className={toastCloseVariants()}
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
                  <path
                    d="M6 18L18 6M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

export interface UseToastReturn {
  /** Push a new toast. Returns its key so callers can dismiss it early. */
  add: (
    content: ChronicleToastContent,
    options?: { timeout?: number }
  ) => string;
  /** Programmatically dismiss a toast by key. */
  dismiss: (key: string) => void;
}

export function useToast(): UseToastReturn {
  return React.useMemo(
    () => ({
      add: (content, options) => addToast(content, options?.timeout ?? 5000),
      dismiss: (key) => closeToast(key),
    }),
    []
  );
}
