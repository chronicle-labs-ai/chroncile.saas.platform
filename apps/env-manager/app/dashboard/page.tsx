"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import type { EnvironmentRecord } from "@/lib/types";
import { ConfirmDestroyModal } from "@/components/ui/confirm-destroy-modal";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TYPE_LABELS: Record<string, string> = {
  PRODUCTION: "PROD",
  STAGING: "STG",
  DEVELOPMENT: "DEV",
  EPHEMERAL: "EPH",
};

const BADGE_CLASS: Record<string, string> = {
  PRODUCTION: "badge--critical",
  STAGING: "badge--caution",
  DEVELOPMENT: "badge--data",
  EPHEMERAL: "badge--neutral",
};

const STATUS_DOT_CLASS: Record<string, string> = {
  RUNNING: "status-dot--nominal",
  STOPPED: "status-dot--offline",
  PROVISIONING: "status-dot--caution status-dot--pulse",
  DESTROYING: "status-dot--critical status-dot--pulse",
  ERROR: "status-dot--critical",
};

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-sm bg-[var(--bg-hover)] ${className ?? ""}`}
    />
  );
}

function SkeletonCard() {
  return (
    <div className="panel flex flex-col gap-3">
      <div className="panel__header">
        <div className="flex items-center gap-2">
          <Skeleton className="w-12 h-5" />
          <Skeleton className="w-24 h-4" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="w-2 h-2 rounded-full" />
          <Skeleton className="w-14 h-3" />
        </div>
      </div>
      <div className="panel__content flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="w-3.5 h-3.5 rounded-sm" />
          <Skeleton className="w-20 h-3" />
          <Skeleton className="w-12 h-3" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="w-14 h-3" />
            <Skeleton className="w-44 h-3" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-14 h-3" />
            <Skeleton className="w-36 h-3" />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border-dim">
          <div className="flex items-center gap-2">
            <Skeleton className="w-1.5 h-1.5 rounded-full" />
            <Skeleton className="w-12 h-3" />
          </div>
        </div>
      </div>
    </div>
  );
}

function RelativeTime({ date }: { date: string | null }) {
  if (!date) return <span className="text-tertiary">never</span>;
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return <span>just now</span>;
  if (mins < 60) return <span>{mins}m ago</span>;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return <span>{hours}h ago</span>;
  return <span>{Math.floor(hours / 24)}d ago</span>;
}

function EnvironmentCard({ env, onDestroyRequest }: { env: EnvironmentRecord; onDestroyRequest: (env: EnvironmentRecord) => void }) {
  return (
    <Link
      href={`/dashboard/${env.id}`}
      className="panel flex flex-col gap-3 hover:border-[var(--border-bright)] transition-colors cursor-pointer"
    >
      <div className="panel__header">
        <div className="flex items-center gap-2">
          <span className={`badge ${BADGE_CLASS[env.type]}`}>
            {TYPE_LABELS[env.type]}
          </span>
          <h3 className="font-mono text-sm text-primary">{env.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`status-dot ${STATUS_DOT_CLASS[env.status]}`} />
          <span className="font-mono text-[10px] text-tertiary uppercase tracking-wider">
            {env.status}
          </span>
        </div>
      </div>

      <div className="panel__content flex flex-col gap-3">
        {env.gitBranch && (
          <div className="flex items-center gap-2 text-xs text-secondary">
            <svg className="w-3.5 h-3.5 text-tertiary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
            <span className="font-mono">{env.gitBranch}</span>
            {env.gitSha && (
              <span className="text-tertiary font-mono">
                {env.gitSha.slice(0, 7)}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5 text-xs">
          {env.flyAppUrl && (
            <div className="flex items-center gap-2">
              <span className="label shrink-0 w-14">Backend</span>
              <span className="text-data truncate font-mono">
                {env.flyAppUrl.replace("https://", "")}
              </span>
            </div>
          )}
          {env.vercelUrl && (
            <div className="flex items-center gap-2">
              <span className="label shrink-0 w-14">Frontend</span>
              <span className="text-data truncate font-mono">
                {env.vercelUrl.replace("https://", "")}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border-dim">
          <div className="flex items-center gap-2">
            <span
              className={`status-dot ${env.isHealthy ? "status-dot--nominal" : "status-dot--critical"}`}
            />
            <span className="font-mono text-[10px] text-tertiary">
              <RelativeTime date={env.lastHealthAt} />
            </span>
          </div>

          <div className="flex items-center gap-3">
            {env.expiresAt && (
              <span className="font-mono text-[10px] text-caution">
                TTL: <RelativeTime date={env.expiresAt} />
              </span>
            )}
            {env.type === "EPHEMERAL" && env.status === "RUNNING" && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDestroyRequest(env); }}
                className="btn btn--critical btn--sm"
              >
                Destroy
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const [destroyTarget, setDestroyTarget] = useState<EnvironmentRecord | null>(null);
  const [destroying, setDestroying] = useState(false);

  const { data, isLoading, mutate } = useSWR<EnvironmentRecord[]>(
    "/api/environments",
    fetcher,
    { refreshInterval: 15_000 }
  );

  const permanentEnvs = data?.filter((e) => e.type !== "EPHEMERAL") ?? [];
  const ephemeralEnvs = data?.filter((e) => e.type === "EPHEMERAL") ?? [];

  const handleConfirmDestroy = async () => {
    if (!destroyTarget) return;
    setDestroying(true);
    await fetch(`/api/environments/${destroyTarget.id}`, { method: "DELETE" });
    await mutate();
    setDestroying(false);
    setDestroyTarget(null);
  };

  return (
    <>
    {destroyTarget && (
      <ConfirmDestroyModal
        environmentName={destroyTarget.name}
        destroying={destroying}
        onConfirm={handleConfirmDestroy}
        onCancel={() => !destroying && setDestroyTarget(null)}
      />
    )}
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-sans font-semibold">Environments</h1>
          <p className="text-xs text-tertiary mt-1">
            Monitor and manage all platform environments
          </p>
        </div>
        <Link href="/dashboard/new" className="btn btn--primary">
          New Environment
        </Link>
      </div>

      {isLoading && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="w-40 h-3" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </section>
      )}

      {!isLoading && permanentEnvs.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="label">Permanent Environments</span>
            <span className="font-mono text-[10px] text-tertiary">
              {permanentEnvs.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {permanentEnvs.map((env) => (
              <EnvironmentCard key={env.id} env={env} onDestroyRequest={setDestroyTarget} />
            ))}
          </div>
        </section>
      )}

      {!isLoading && (
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="label">Ephemeral Environments</span>
          <span className="font-mono text-[10px] text-tertiary">
            {ephemeralEnvs.length}
          </span>
        </div>
        {ephemeralEnvs.length === 0 ? (
          <div className="panel border-dashed">
            <div className="panel__content text-center py-8">
              <p className="text-secondary text-sm mb-3">
                No ephemeral environments running
              </p>
              <Link href="/dashboard/new" className="btn btn--secondary btn--sm">
                Spin one up from a branch
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {ephemeralEnvs.map((env) => (
              <EnvironmentCard key={env.id} env={env} onDestroyRequest={setDestroyTarget} />
            ))}
          </div>
        )}
      </section>
      )}
    </div>
    </>
  );
}
