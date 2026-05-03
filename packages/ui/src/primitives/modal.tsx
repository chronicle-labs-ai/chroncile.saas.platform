"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils/cn";
import { Button } from "./button";

/*
 * Variant classnames for `<Modal>` and `<Dialog>` (which composes the
 * same Radix Dialog primitives but with a more granular API).
 *
 * Radix Dialog emits:
 *   - `data-state="open" | "closed"` on `Overlay` and `Content`
 *
 * Keep in sync with `drawer.tsx`. Earlier revisions used
 * `data-[entering=true]` / `data-[exiting=true]` (react-aria-components)
 * so the animations never fired.
 */

export const modalOverlayVariants = cva(
  "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm " +
    "data-[state=open]:animate-in data-[state=open]:fade-in-0 " +
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
);

export const modalVariants = cva(
  /*
   * Centered with `translate-x-[-50%] translate-y-[-50%]`. The
   * `slide-in-from-left-1/2` / `slide-in-from-top-[48%]` classes pin
   * `--tw-enter-translate-x` / `--tw-enter-translate-y` so the keyframe's
   * FROM transform matches the natural centering — without this the modal
   * would visibly jump from (0,0) on open. Mirror the same numbers in the
   * exit classes so close animates symmetrically.
   */
  "fixed top-[50%] left-[50%] z-50 max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[520px] " +
    "translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-md border border-hairline-strong bg-surface-01 shadow-panel outline-none duration-200 " +
    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 " +
    "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] " +
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 " +
    "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]"
);

export const modalDialogVariants = cva("outline-none");

export const modalHeaderVariants = cva(
  "flex items-center justify-between border-b border-hairline bg-surface-02 px-[14px] py-[10px]"
);

export const modalTitleVariants = cva(
  "font-sans text-[14px] font-medium tracking-normal",
  {
    variants: {
      variant: {
        default: "text-ink-hi",
        danger: "text-event-red",
        dark: "text-ink-hi",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export const modalCloseVariants = cva(
  "inline-flex items-center justify-center text-ink-dim transition-colors duration-fast ease-out " +
    "hover:bg-surface-03 hover:text-ink-hi " +
    "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember h-7 w-7 rounded-md"
);

export const modalBodyVariants = cva(
  "text-ink-lo px-[14px] py-[14px] font-sans text-[13px] leading-snug"
);

export const modalActionsVariants = cva(
  "flex items-center justify-end border-t border-hairline bg-surface-02 gap-[8px] px-[14px] py-[10px]"
);

type ModalVariantProps = VariantProps<typeof modalTitleVariants>;

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
  /** Defaults to true — outside click and Escape dismiss the dialog. */
  isDismissable?: boolean;
}

/**
 * @deprecated Prefer the shadcn-style `<Dialog>` compound for non-destructive
 * flows and `<AlertDialog>` for destructive confirms. `Modal` will be removed
 * once first-party callers have migrated.
 *
 * Migration:
 *
 *   <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
 *     <DialogContent>
 *       <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
 *       <DialogBody>{children}</DialogBody>
 *       {actions ? <DialogFooter>{actions}</DialogFooter> : null}
 *     </DialogContent>
 *   </Dialog>
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  actions,
  variant = "default",
  className,
  classNames,
  isDismissable = true,
}: ModalProps) {
  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(modalOverlayVariants(), classNames?.overlay)}
        />
        <DialogPrimitive.Content
          onPointerDownOutside={(event) => {
            if (!isDismissable) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (!isDismissable) event.preventDefault();
          }}
          className={cn(modalVariants(), classNames?.modal, className)}
        >
          <div className={modalDialogVariants({ className: classNames?.dialog })}>
            <div
              className={modalHeaderVariants({ className: classNames?.header })}
            >
              <DialogPrimitive.Title
                className={modalTitleVariants({
                  variant,
                  className: classNames?.title,
                })}
              >
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  aria-label="Close dialog"
                  className={modalCloseVariants({ className: classNames?.close })}
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
              </DialogPrimitive.Close>
            </div>

            <div className={modalBodyVariants({ className: classNames?.body })}>
              {children}
            </div>

            {actions ? (
              <div
                className={modalActionsVariants({
                  className: classNames?.actions,
                })}
              >
                {actions}
              </div>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
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

/**
 * @deprecated Use `<AlertDialog>` for destructive confirms (proper
 * `role=alertdialog` + outside-click / Escape are no-ops by default).
 * For non-destructive confirms, compose `<Dialog>` directly.
 *
 *   <AlertDialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
 *     <AlertDialogContent>
 *       <AlertDialogHeader>
 *         <AlertDialogTitle>{title}</AlertDialogTitle>
 *         <AlertDialogDescription>{message}</AlertDialogDescription>
 *       </AlertDialogHeader>
 *       <AlertDialogFooter>
 *         <AlertDialogCancel>{cancelText}</AlertDialogCancel>
 *         <AlertDialogAction onClick={onConfirm}>{confirmText}</AlertDialogAction>
 *       </AlertDialogFooter>
 *     </AlertDialogContent>
 *   </AlertDialog>
 */
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
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === "danger" ? "critical" : "primary"}
            onClick={onConfirm}
            disabled={isLoading}
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
