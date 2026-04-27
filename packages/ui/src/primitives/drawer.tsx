"use client";

/*
 * Drawer — a Modal that slides in from one edge of the viewport.
 * Behaviourally identical to `Modal` (RAC-backed focus trap, portal,
 * scroll lock, ESC + outside-click dismiss); only the geometry changes.
 *
 * Use for side-panel editors, filter sheets, and detail drawers where
 * the underlying page context matters. For centered confirmation
 * dialogs, stay with `Modal`.
 */

import * as React from "react";
import {
  Modal as RACModal,
  ModalOverlay as RACModalOverlay,
  Dialog as RACDialog,
  Heading as RACHeading,
} from "react-aria-components";

import { tv, type VariantProps } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

const drawerStyles = tv({
  slots: {
    overlay:
      "fixed inset-0 z-50 flex bg-black/60 " +
      "data-[entering=true]:animate-in data-[entering=true]:fade-in " +
      "data-[exiting=true]:animate-out data-[exiting=true]:fade-out",
    drawer:
      "relative flex flex-col bg-surface-01 shadow-panel outline-none h-full",
    dialog: "flex h-full flex-col outline-none",
    header: "flex items-center justify-between border-b border-hairline bg-surface-02",
    title: "text-ink-hi",
    close:
      "inline-flex items-center justify-center text-ink-dim transition-colors duration-fast ease-out " +
      "data-[hovered=true]:bg-surface-03 data-[hovered=true]:text-ink-hi",
    body: "flex-1 overflow-auto text-ink-lo",
    actions: "flex items-center justify-end border-t border-hairline bg-surface-02",
  },
  variants: {
    density: {
      brand: {
        drawer: "border-hairline-strong",
        header: "px-s-5 py-s-3",
        title: "font-display text-title-sm tracking-tight",
        close: "h-8 w-8 rounded-sm",
        body: "px-s-5 py-s-4 text-body-sm",
        actions: "gap-s-3 px-s-5 py-s-3",
      },
      compact: {
        drawer: "border-l-border",
        header: "px-[14px] py-[10px]",
        title: "font-sans text-[14px] font-medium tracking-normal",
        close: "h-7 w-7 rounded-l",
        body: "px-[14px] py-[14px] font-sans text-[13px] leading-snug",
        actions: "gap-[8px] px-[14px] py-[10px]",
      },
    },
    placement: {
      right: {
        overlay: "justify-end",
        drawer:
          "w-full max-w-[520px] border-l " +
          "data-[entering=true]:animate-in data-[entering=true]:slide-in-from-right " +
          "data-[exiting=true]:animate-out data-[exiting=true]:slide-out-to-right",
      },
      left: {
        overlay: "justify-start",
        drawer:
          "w-full max-w-[520px] border-r " +
          "data-[entering=true]:animate-in data-[entering=true]:slide-in-from-left " +
          "data-[exiting=true]:animate-out data-[exiting=true]:slide-out-to-left",
      },
      bottom: {
        overlay: "items-end",
        drawer:
          "w-full max-h-[80vh] border-t " +
          "data-[entering=true]:animate-in data-[entering=true]:slide-in-from-bottom " +
          "data-[exiting=true]:animate-out data-[exiting=true]:slide-out-to-bottom",
      },
      top: {
        overlay: "items-start",
        drawer:
          "w-full max-h-[80vh] border-b " +
          "data-[entering=true]:animate-in data-[entering=true]:slide-in-from-top " +
          "data-[exiting=true]:animate-out data-[exiting=true]:slide-out-to-top",
      },
    },
    size: {
      sm: { drawer: "" },
      md: { drawer: "" },
      lg: { drawer: "max-w-[720px]" },
      xl: { drawer: "max-w-[960px]" },
    },
  },
  defaultVariants: { density: "brand", placement: "right", size: "md" },
});

type DrawerVariantProps = VariantProps<typeof drawerStyles>;

export interface DrawerProps extends DrawerVariantProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  placement?: "left" | "right" | "top" | "bottom";
  size?: "sm" | "md" | "lg" | "xl";
  density?: "compact" | "brand";
  isDismissable?: boolean;
  className?: string;
  classNames?: {
    overlay?: string;
    drawer?: string;
    dialog?: string;
    header?: string;
    title?: string;
    close?: string;
    body?: string;
    actions?: string;
  };
}

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  actions,
  placement = "right",
  size = "md",
  density: densityProp,
  isDismissable = true,
  className,
  classNames,
}: DrawerProps) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = drawerStyles({ density, placement, size });

  return (
    <RACModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable={isDismissable}
      className={composeTwRenderProps(classNames?.overlay, slots.overlay())}
    >
      <RACModal
        className={composeTwRenderProps(
          className ?? classNames?.drawer,
          slots.drawer()
        )}
      >
        <RACDialog className={slots.dialog({ className: classNames?.dialog })}>
          {({ close }) => (
            <>
              <div className={slots.header({ className: classNames?.header })}>
                <RACHeading
                  slot="title"
                  className={slots.title({ className: classNames?.title })}
                >
                  {title}
                </RACHeading>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close drawer"
                  className={slots.close({ className: classNames?.close })}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                    <path
                      d="M6 18L18 6M6 6l12 12"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              <div className={slots.body({ className: classNames?.body })}>
                {children}
              </div>

              {actions ? (
                <div
                  className={slots.actions({ className: classNames?.actions })}
                >
                  {actions}
                </div>
              ) : null}
            </>
          )}
        </RACDialog>
      </RACModal>
    </RACModalOverlay>
  );
}
