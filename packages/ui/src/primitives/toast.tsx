"use client";

/*
 * Toast — RAC's Toast primitives are marked UNSTABLE in v1.17 but are
 * production-ready. We wrap them behind a stable Chronicle API so the
 * namespace churn doesn't leak to consumers when RAC promotes them.
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
import {
  UNSTABLE_ToastRegion as RACToastRegion,
  UNSTABLE_Toast as RACToast,
  UNSTABLE_ToastContent as RACToastContent,
  UNSTABLE_ToastQueue as RACToastQueue,
  Button as RACButton,
  Text as RACText,
} from "react-aria-components";

import { tv } from "../utils/tv";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

export type ToastTone = "default" | "success" | "danger" | "info" | "warning";
export type ToastDensity = "compact" | "brand";

export interface ChronicleToastContent {
  title: React.ReactNode;
  description?: React.ReactNode;
  tone?: ToastTone;
  /**
   * Optional action rendered as a button at the right edge. Calling the
   * returned handler automatically dismisses the toast.
   */
  action?: { label: string; onPress: () => void };
}

const toastStyles = tv({
  slots: {
    region: "fixed top-s-4 right-s-4 z-50 flex flex-col gap-s-2 outline-none",
    toast:
      "relative pointer-events-auto flex items-start gap-s-3 border " +
      "shadow-panel min-w-[260px] max-w-[440px] outline-none " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:outline-ember",
    title: "",
    description: "",
    content: "flex-1 flex flex-col gap-s-1",
    action:
      "inline-flex items-center border outline-none " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:outline-ember",
    close:
      "inline-flex items-center justify-center outline-none " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:outline-ember",
  },
  variants: {
    density: {
      brand: {
        toast: "rounded-sm bg-surface-02 px-s-4 py-s-3",
        title: "font-sans text-sm font-medium text-ink-hi",
        description: "font-sans text-sm text-ink-lo",
        action:
          "rounded-xs border-hairline-strong bg-surface-01 px-s-2 py-s-1 " +
          "font-mono text-mono-sm uppercase tracking-tactical text-ink " +
          "data-[hovered=true]:bg-surface-03 data-[hovered=true]:text-ink-hi",
        close:
          "h-6 w-6 rounded-xs text-ink-dim " +
          "data-[hovered=true]:bg-surface-03 data-[hovered=true]:text-ink-hi",
      },
      compact: {
        toast: "rounded-l bg-l-surface-raised px-[12px] py-[10px]",
        title: "font-sans text-[13px] font-medium text-l-ink",
        description: "font-sans text-[13px] text-l-ink-lo",
        action:
          "rounded-l border-l-border bg-l-surface-input px-[8px] py-[4px] " +
          "font-sans text-[12px] font-medium text-l-ink " +
          "data-[hovered=true]:bg-l-surface-hover data-[hovered=true]:text-l-ink",
        close:
          "h-5 w-5 rounded-l text-l-ink-dim " +
          "data-[hovered=true]:bg-l-surface-hover data-[hovered=true]:text-l-ink",
      },
    },
    tone: {
      default: {},
      success: {},
      danger: {},
      info: {},
      warning: {},
    },
  },
  compoundVariants: [
    { density: "brand", tone: "default", class: { toast: "border-hairline-strong" } },
    { density: "brand", tone: "success", class: { toast: "border-event-green/40" } },
    { density: "brand", tone: "danger", class: { toast: "border-event-red/40" } },
    { density: "brand", tone: "info", class: { toast: "border-event-teal/40" } },
    { density: "brand", tone: "warning", class: { toast: "border-event-amber/40" } },
    { density: "compact", tone: "default", class: { toast: "border-l-border" } },
    { density: "compact", tone: "success", class: { toast: "border-event-green/40" } },
    { density: "compact", tone: "danger", class: { toast: "border-event-red/40" } },
    { density: "compact", tone: "info", class: { toast: "border-event-teal/40" } },
    { density: "compact", tone: "warning", class: { toast: "border-event-amber/40" } },
  ],
  defaultVariants: { tone: "default", density: "brand" },
});

/**
 * Module-level queue, created once per browser tab. RAC's `ToastQueue`
 * is a subscribe/publish store that multiple `ToastRegion`s could read
 * from, but we intentionally mount only one region per app.
 */
const toastQueue = new RACToastQueue<ChronicleToastContent>({
  maxVisibleToasts: 5,
});

export interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const density = useResolvedChromeDensity();
  const slots = toastStyles({ density });
  return (
    <>
      {children}
      <RACToastRegion queue={toastQueue} className={slots.region()}>
        {({ toast }) => {
          const tone = toast.content.tone ?? "default";
          const variantSlots = toastStyles({ tone, density });
          return (
            <RACToast toast={toast} className={variantSlots.toast()}>
              <RACToastContent className={variantSlots.content()}>
                <RACText slot="title" className={variantSlots.title()}>
                  {toast.content.title}
                </RACText>
                {toast.content.description ? (
                  <RACText
                    slot="description"
                    className={variantSlots.description()}
                  >
                    {toast.content.description}
                  </RACText>
                ) : null}
              </RACToastContent>
              {toast.content.action ? (
                <RACButton
                  onPress={() => {
                    toast.content.action?.onPress();
                    toastQueue.close(toast.key);
                  }}
                  className={variantSlots.action()}
                >
                  {toast.content.action.label}
                </RACButton>
              ) : null}
              <RACButton
                slot="close"
                className={variantSlots.close()}
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
              </RACButton>
            </RACToast>
          );
        }}
      </RACToastRegion>
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
      add: (content, options) =>
        toastQueue.add(content, { timeout: options?.timeout ?? 5000 }),
      dismiss: (key) => toastQueue.close(key),
    }),
    []
  );
}
