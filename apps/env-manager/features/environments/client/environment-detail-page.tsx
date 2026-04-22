"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import useSWR from "swr";
import { ConfirmDestroyModal } from "@/shared/components/confirm-destroy-modal";
import { ProvisioningTimeline } from "@/shared/components/provisioning-timeline";
import { BADGE_CLASS, TYPE_LABELS } from "@/shared/environment-ui";
import { fetcher } from "@/shared/fetcher";
import type { EnvironmentRecord, EnvironmentStats } from "@/shared/types";
import {
  EndpointRow,
  LoadTestsPanel,
  LogsPanel,
  ResourceMetricsPanel,
  StatCard,
  TenantsPanel,
} from "@/features/environments/components/detail";
import { DatabaseTab } from "@/features/local-db/components/database-tab";

type DetailTab = "deployment" | "users" | "resources" | "load-tests" | "database";

interface TabDef { id: DetailTab; label: string; icon: React.ReactNode }

const BASE_TABS: TabDef[] = [
  {
    id: "deployment",
    label: "Deployment",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 010 1.954l-7.108 4.061A1.125 1.125 0 013 16.811V8.689zM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 010 1.954l-7.108 4.061a1.125 1.125 0 01-1.683-.977V8.689z" /></svg>,
  },
  {
    id: "users",
    label: "Users & Orgs",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
  },
  {
    id: "resources",
    label: "Resources",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" /></svg>,
  },
  {
    id: "load-tests",
    label: "Load Tests",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>,
  },
];

const DATABASE_TAB: TabDef = {
  id: "database",
  label: "Database",
  icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>,
};

function getTabsForEnv(envType: string): TabDef[] {
  if (envType === "LOCAL") return [...BASE_TABS, DATABASE_TAB];
  return BASE_TABS;
}

function DeploymentTab({
  env,
  envId,
  stats,
  isProvisioning,
}: {
  env: EnvironmentRecord;
  envId: string;
  stats: EnvironmentStats | undefined;
  isProvisioning: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="panel">
        <div className="panel__content">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><span className="label block mb-1">Status</span><span className="font-mono text-sm text-primary">{env.status}</span></div>
            <div><span className="label block mb-1">Branch</span><span className="font-mono text-sm text-primary">{env.gitBranch ?? "—"}</span></div>
            <div><span className="label block mb-1">Commit</span><span className="font-mono text-sm text-primary">{env.gitSha?.slice(0, 7) ?? "—"}</span></div>
            <div><span className="label block mb-1">Created</span><span className="font-mono text-sm text-primary">{new Date(env.createdAt).toLocaleDateString()}</span></div>
          </div>
        </div>
      </div>

      {(env.provisionLog || env.type === "EPHEMERAL") && (
        <ProvisioningTimeline provisionLog={env.provisionLog} envStatus={env.status} isProvisioning={isProvisioning} />
      )}

      <div className="panel">
        <div className="panel__header"><span className="panel__title">Endpoints</span></div>
        <div className="divide-y divide-[var(--border-dim)]">
          <EndpointRow label="Backend" url={env.flyAppUrl} badge="Fly.io" badgeClass="bg-[#7c3aed]/20 text-[#a78bfa]" extra={env.flyAppUrl ? `${env.flyAppUrl}/health` : null} extraLabel="Health" />
          <EndpointRow label="Frontend" url={env.vercelUrl} badge="Vercel" badgeClass="bg-[#000]/30 text-[#e5e5e5]" pending={!env.vercelUrl && env.type === "EPHEMERAL"} pendingHint="Vercel preview will appear after the next branch push" extra={env.vercelUrl ? `${env.vercelUrl}/api/system/info` : null} extraLabel="Info" />
          {env.expiresAt && (
            <div className="flex items-center gap-4 px-4 py-3">
              <span className="label shrink-0 w-20">Expires</span>
              <span className="font-mono text-sm text-caution">{new Date(env.expiresAt).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {env.errorLog && (
        <div className="panel border-[var(--critical-dim)]">
          <div className="panel__header bg-[var(--critical-bg)]">
            <div className="flex items-center gap-2">
              <span className="status-dot status-dot--critical" />
              <span className="panel__title text-critical">{env.status === "ERROR" ? "Provisioning Error" : "Warnings"}</span>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto bg-[var(--critical-bg)]">
            <pre className="px-4 py-3 text-xs font-mono text-critical/90 whitespace-pre-wrap break-all leading-relaxed">{env.errorLog}</pre>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="label">Platform Metrics</span>
          {stats?._note && <span className="font-mono text-[10px] text-caution">{stats._note}</span>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Runs" value={stats?.runs ?? null} />
          <StatCard label="Connections" value={stats?.connections ?? null} />
          <StatCard label="Tenants" value={stats?.tenants ?? null} />
          <StatCard label="Users" value={stats?.users ?? null} />
          <StatCard label="Events" value={stats?.events ?? null} />
        </div>
      </div>

      <LogsPanel envId={envId} />
    </div>
  );
}

function EnvDetailTabs({
  env,
  envId,
  stats,
  isProvisioning,
}: {
  env: EnvironmentRecord;
  envId: string;
  stats: EnvironmentStats | undefined;
  isProvisioning: boolean;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("deployment");
  const tabs = getTabsForEnv(env.type);

  return (
    <div>
      <div className="flex border-b border-border-dim mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "text-data border-data"
                : "text-tertiary hover:text-secondary border-transparent"
            }`}
          >
            <span className={activeTab === tab.id ? "text-data" : "text-tertiary"}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "deployment" && (
        <DeploymentTab env={env} envId={envId} stats={stats} isProvisioning={isProvisioning} />
      )}

      {activeTab === "users" && (
        <div className="space-y-6">
          {env.status === "RUNNING" && env.isHealthy ? (
            <TenantsPanel envId={envId} />
          ) : (
            <div className="panel">
              <div className="panel__content text-center py-8">
                <p className="text-sm text-secondary">Backend must be running and healthy to view tenants</p>
                <p className="text-xs text-tertiary mt-1">Current status: {env.status}{!env.isHealthy && " (unhealthy)"}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "resources" && (
        <div className="space-y-6">
          {env.status === "RUNNING" || env.type === "LOCAL" ? (
            <ResourceMetricsPanel envId={envId} />
          ) : (
            <div className="panel">
              <div className="panel__content text-center py-8">
                <p className="text-sm text-secondary">Resources available once environment is running</p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "load-tests" && (
        <LoadTestsPanel envId={envId} isRunning={env.status === "RUNNING"} />
      )}

      {activeTab === "database" && env.type === "LOCAL" && (
        <DatabaseTab />
      )}
    </div>
  );
}

export function EnvironmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [destroying, setDestroying] = useState(false);
  const [showDestroyModal, setShowDestroyModal] = useState(false);
  const [fastPoll, setFastPoll] = useState(true);

  const { data: env, isLoading } = useSWR<EnvironmentRecord>(
    `/api/environments/${id}`,
    fetcher,
    {
      refreshInterval: fastPoll ? 2_000 : 10_000,
      onSuccess: (data) => {
        if (data.status !== "PROVISIONING" && data.status !== "DESTROYING") {
          setFastPoll(false);
        }
      },
    }
  );

  const isProvisioning = env?.status === "PROVISIONING";

  const { data: stats } = useSWR<EnvironmentStats>(
    env ? `/api/environments/${id}/stats` : null,
    fetcher,
    { refreshInterval: 60_000 }
  );

  const handleDestroy = async () => {
    if (!env) return;
    setDestroying(true);
    setShowDestroyModal(false);
    await fetch(`/api/environments/${id}`, { method: "DELETE" });
    router.push("/dashboard");
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-secondary text-sm font-mono">Loading environment...</div>
      </div>
    );
  }

  if (!env) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="panel">
          <div className="panel__content text-center py-8">
            <p className="text-secondary text-sm mb-3">Environment not found</p>
            <Link href="/dashboard" className="btn btn--secondary btn--sm">Back to Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {showDestroyModal && (
        <ConfirmDestroyModal
          environmentName={env.name}
          destroying={destroying}
          onConfirm={handleDestroy}
          onCancel={() => setShowDestroyModal(false)}
        />
      )}
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard" className="btn btn--ghost btn--sm mb-4 inline-flex">&larr; All Environments</Link>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {env.type !== "LOCAL" && (
                <span className={`badge ${BADGE_CLASS[env.type]}`}>{TYPE_LABELS[env.type]}</span>
              )}
              <h1 className="text-xl font-sans font-semibold">{env.name}</h1>
              <span className={`status-dot ${env.isHealthy ? "status-dot--nominal status-dot--pulse" : "status-dot--critical"}`} />
            </div>
            <div className="flex items-center gap-3">
              {env.type === "EPHEMERAL" && env.status !== "DESTROYING" && (
                <button
                  onClick={() => setShowDestroyModal(true)}
                  disabled={destroying}
                  className="btn btn--critical btn--sm disabled:opacity-40"
                >
                  {destroying ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full border-2 border-critical/40 border-t-critical animate-spin" />
                      Destroying...
                    </span>
                  ) : "Destroy Environment"}
                </button>
              )}
            </div>
          </div>
        </div>

        <EnvDetailTabs env={env} envId={id} stats={stats} isProvisioning={isProvisioning} />
      </div>
    </>
  );
}
