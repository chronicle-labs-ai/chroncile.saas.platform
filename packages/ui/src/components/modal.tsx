"use client";

import { useEffect, useCallback, useRef } from "react";
import { Button } from "./button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  variant?: "default" | "danger" | "dark";
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  actions,
  variant = "default",
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, handleEscape]);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isDark = variant === "dark" || variant === "danger";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className={
          isDark
            ? "max-w-md w-full bg-surface border border-border-dim rounded-md shadow-xl outline-none"
            : "bg-white rounded-xl shadow-xl max-w-md w-full outline-none"
        }
      >
        <div
          className={
            isDark
              ? "flex items-center justify-between px-4 py-3 border-b border-border-dim bg-elevated"
              : "flex items-center justify-between px-6 py-4 border-b border-gray-200"
          }
        >
          <h2
            id="modal-title"
            className={
              isDark
                ? `text-base font-semibold ${variant === "danger" ? "text-critical" : "text-primary"}`
                : "text-lg font-semibold text-gray-900"
            }
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className={
              isDark
                ? "p-2 text-tertiary hover:text-primary hover:bg-hover rounded transition-colors"
                : "p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            }
            aria-label="Close modal"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div
          className={
            isDark ? "px-4 py-4 text-secondary text-sm" : "px-6 py-4"
          }
        >
          {children}
        </div>

        {actions && (
          <div
            className={
              isDark
                ? "flex items-center justify-end gap-3 px-4 py-3 border-t border-border-dim bg-elevated"
                : "flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl"
            }
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
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
  const isDark = variant === "danger";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      variant={variant}
      actions={
        <>
          <Button
            onClick={onClose}
            disabled={isLoading}
            variant="secondary"
            className="disabled:opacity-50"
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            variant={isDark ? "critical" : "primary"}
            isLoading={isLoading}
            className="disabled:opacity-50"
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <p className={isDark ? undefined : "text-gray-600"}>{message}</p>
    </Modal>
  );
}
