"use client";

import { useEffect, useCallback, useRef } from "react";

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

  // Handle escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  // Handle click outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Add/remove event listeners
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

  // Focus trap - focus the modal when it opens
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
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={isDark ? "px-4 py-4 text-secondary text-sm" : "px-6 py-4"}>
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

// Confirmation modal helper component
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
          <button
            onClick={onClose}
            disabled={isLoading}
            className={isDark ? "btn btn--secondary disabled:opacity-50" : "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={
              isDark
                ? "btn btn--critical disabled:opacity-50 flex items-center gap-2"
                : "px-4 py-2 text-sm font-medium text-white rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            }
          >
            {isLoading && (
              <svg
                className="w-4 h-4 animate-spin flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {confirmText}
          </button>
        </>
      }
    >
      <p className={isDark ? undefined : "text-gray-600"}>{message}</p>
    </Modal>
  );
}
