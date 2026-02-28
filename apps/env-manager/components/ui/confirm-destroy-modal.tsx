"use client";

import { useEffect, useRef } from "react";

interface ConfirmDestroyModalProps {
  environmentName: string;
  onConfirm: () => void;
  onCancel: () => void;
  destroying?: boolean;
}

export function ConfirmDestroyModal({
  environmentName,
  onConfirm,
  onCancel,
  destroying = false,
}: ConfirmDestroyModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus cancel button on open for accessibility
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !destroying) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel, destroying]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !destroying) onCancel();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 panel border-critical-dim">
        {/* Header */}
        <div className="panel__header bg-critical-bg border-b border-critical-dim">
          <div className="flex items-center gap-2">
            <span className="status-dot status-dot--critical" />
            <span className="panel__title text-critical">Destroy Environment</span>
          </div>
        </div>

        {/* Body */}
        <div className="panel__content space-y-4">
          <p className="text-sm text-secondary">
            This will permanently destroy the environment and all associated resources:
          </p>

          <div className="bg-elevated border border-border-default rounded-sm px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-tertiary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
              </svg>
              <span className="font-mono text-xs text-primary">Fly.io app + machines</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-tertiary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
              <span className="font-mono text-xs text-primary">Fly Postgres database</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-tertiary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              <span className="font-mono text-xs text-primary">Vercel branch env var</span>
            </div>
          </div>

          <div className="bg-critical-bg border border-critical-dim rounded-sm px-3 py-2">
            <p className="font-mono text-xs text-critical">
              Environment: <span className="font-semibold">{environmentName}</span>
            </p>
            <p className="text-xs text-critical/70 mt-1">
              This action cannot be undone.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 flex items-center justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={destroying}
            className="btn btn--secondary btn--sm disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={destroying}
            className="btn btn--critical disabled:opacity-40"
          >
            {destroying ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-critical/40 border-t-critical animate-spin" />
                Destroying...
              </span>
            ) : (
              "Destroy Environment"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
