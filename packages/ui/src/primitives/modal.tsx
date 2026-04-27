"use client";

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
import { Button } from "./button";

/*
 * RAC owns the hard parts: portal to document.body, focus trap + restore,
 * scroll lock, ESC to dismiss, backdrop click to dismiss, `aria-modal`,
 * and linking `<Heading slot="title">` to `aria-labelledby` automatically.
 * We keep the old `isOpen` / `onClose` API as a thin translation over RAC's
 * `isOpen` / `onOpenChange(open)`.
 */

const modalStyles = tv({
  slots: {
    overlay:
      "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-s-4 " +
      "data-[entering=true]:animate-in data-[entering=true]:fade-in " +
      "data-[exiting=true]:animate-out data-[exiting=true]:fade-out",
    modal:
      "w-full max-w-[520px] border bg-surface-01 shadow-panel outline-none " +
      "data-[entering=true]:animate-in data-[entering=true]:zoom-in-95 " +
      "data-[exiting=true]:animate-out data-[exiting=true]:zoom-out-95",
    dialog: "outline-none",
    header: "flex items-center justify-between border-b border-hairline bg-surface-02",
    title: "",
    close:
      "inline-flex items-center justify-center text-ink-dim transition-colors duration-fast ease-out " +
      "data-[hovered=true]:bg-surface-03 data-[hovered=true]:text-ink-hi " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:outline-ember",
    body: "text-ink-lo",
    actions: "flex items-center justify-end border-t border-hairline bg-surface-02",
  },
  variants: {
    density: {
      brand: {
        modal: "rounded-md border-hairline-strong",
        header: "px-s-4 py-s-3",
        title: "font-display text-title-sm tracking-tight",
        close: "h-8 w-8 rounded-sm",
        body: "px-s-4 py-s-4 text-body-sm",
        actions: "gap-s-3 px-s-4 py-s-3",
      },
      compact: {
        modal: "rounded-l border-l-border",
        header: "px-[14px] py-[10px]",
        title: "font-sans text-[14px] font-medium tracking-normal",
        close: "h-7 w-7 rounded-l",
        body: "px-[14px] py-[14px] font-sans text-[13px] leading-snug",
        actions: "gap-[8px] px-[14px] py-[10px]",
      },
    },
    variant: {
      default: { title: "text-ink-hi" },
      danger: { title: "text-event-red" },
      dark: { title: "text-ink-hi" },
    },
  },
  defaultVariants: { density: "brand", variant: "default" },
});

type ModalVariantProps = VariantProps<typeof modalStyles>;

export interface ModalProps extends ModalVariantProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  /**
   * `default` — neutral surface
   * `danger`  — same surface, red title (destructive intent)
   * `dark`    — alias for `default`, kept for API compatibility
   */
  variant?: "default" | "danger" | "dark";
  density?: "compact" | "brand";
  className?: string;
  /** Per-slot overrides. */
  classNames?: {
    overlay?: string;
    modal?: string;
    dialog?: string;
    header?: string;
    title?: string;
    close?: string;
    body?: string;
    actions?: string;
  };
  /** Defaults to true — RAC dismisses on outside click. */
  isDismissable?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  actions,
  variant = "default",
  density: densityProp,
  className,
  classNames,
  isDismissable = true,
}: ModalProps) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = modalStyles({ density, variant });

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
          className ?? classNames?.modal,
          slots.modal()
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
                  aria-label="Close dialog"
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

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: React.ReactNode;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger";
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  isLoading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      variant={variant}
      actions={
        <>
          <Button variant="secondary" onPress={onClose} isDisabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === "danger" ? "critical" : "primary"}
            onPress={onConfirm}
            isDisabled={isLoading}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      {typeof message === "string" ? <p>{message}</p> : message}
    </Modal>
  );
}
