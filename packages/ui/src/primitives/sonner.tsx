"use client";

/*
 * Sonner — the upstream-recommended toast primitive (https://sonner.emilkowal.ski).
 * Mounted once near the app root via `<Toaster />`; emit toasts from
 * anywhere with the `toast()` function.
 *
 *   // Once, at app root:
 *   import { Toaster } from "ui";
 *   <Toaster />
 *
 *   // Anywhere:
 *   import { toast } from "ui";
 *   toast.success("Saved");
 *   toast.error("Failed", { description: "Try again." });
 *
 * Coexists with Chronicle's existing `<ToastProvider>` + `useToast()`
 * queue (still exported) during the transition. New code should reach
 * for sonner.
 */

import * as React from "react";
import { Toaster as SonnerPrimitive, toast } from "sonner";

export interface ToasterProps
  extends React.ComponentProps<typeof SonnerPrimitive> {}

export function Toaster({
  theme = "dark",
  position = "top-right",
  toastOptions,
  ...props
}: ToasterProps) {
  return (
    <SonnerPrimitive
      data-slot="sonner"
      theme={theme}
      position={position}
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast:
            "group toast pointer-events-auto flex items-start gap-[12px] rounded-md border border-hairline-strong bg-l-surface-raised px-[12px] py-[10px] font-sans text-[13px] text-l-ink shadow-panel",
          title: "font-medium text-l-ink",
          description: "text-l-ink-lo text-[12px]",
          actionButton:
            "inline-flex items-center rounded-md border border-hairline-strong bg-l-surface-input px-[8px] py-[4px] text-[12px] font-medium text-l-ink hover:bg-l-surface-hover",
          cancelButton:
            "inline-flex items-center rounded-md border-0 bg-transparent px-[8px] py-[4px] text-[12px] font-medium text-l-ink-dim hover:text-l-ink",
          closeButton:
            "h-5 w-5 rounded-md text-l-ink-dim hover:bg-l-surface-hover hover:text-l-ink",
          success: "border-event-green/40",
          error: "border-event-red/40",
          warning: "border-event-amber/40",
          info: "border-event-teal/40",
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
}

export { toast };
