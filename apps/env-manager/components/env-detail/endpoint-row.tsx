"use client";

import { CopyButton } from "@/shared/components/copy-button";

interface EndpointRowProps {
  label: string;
  url: string | null;
  badge?: string;
  badgeClass?: string;
  pending?: boolean;
  pendingHint?: string;
  extra?: string | null;
  extraLabel?: string;
}

export function EndpointRow({
  label,
  url,
  badge,
  badgeClass,
  pending,
  pendingHint,
  extra,
  extraLabel,
}: EndpointRowProps) {
  return (
    <div className="px-4 py-3 space-y-1.5">
      <div className="flex items-center gap-3">
        <span className="label shrink-0 w-20">{label}</span>

        {badge && (
          <span
            className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm shrink-0 ${badgeClass}`}
          >
            {badge}
          </span>
        )}

        {url ? (
          <>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-data hover:underline font-mono text-sm truncate flex-1 min-w-0"
            >
              {url}
            </a>
            <CopyButton text={url} />
          </>
        ) : pending ? (
          <div className="flex items-center gap-2 flex-1">
            <div className="w-1.5 h-1.5 rounded-full bg-caution animate-pulse" />
            <span className="font-mono text-xs text-caution">
              Pending deployment
            </span>
          </div>
        ) : (
          <span className="font-mono text-sm text-tertiary">—</span>
        )}
      </div>

      {url && extra && (
        <div className="flex items-center gap-3 pl-[6.5rem]">
          <span className="label shrink-0">{extraLabel}</span>
          <a
            href={extra}
            target="_blank"
            rel="noopener noreferrer"
            className="text-tertiary hover:text-data font-mono text-xs truncate flex-1 min-w-0 transition-colors"
          >
            {extra}
          </a>
          <CopyButton text={extra} />
        </div>
      )}

      {pending && pendingHint && (
        <p className="pl-[6.5rem] text-[10px] text-tertiary font-mono">
          {pendingHint}
        </p>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="panel">
      <div className="panel__content">
        <div className="metric">
          <span className="metric__label">{label}</span>
          <span className="metric__value metric__value--data">
            {value !== null ? value.toLocaleString() : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
