"use client";

import { useRouter } from "next/navigation";
import { use, useState } from "react";
import useSWR from "swr";
import {
  Badge,
  Button,
  ConfirmModal,
  EndpointRow,
  KpiCard,
  KpiGrid,
  LogStream,
  Panel,
  PanelContent,
  PanelHeader,
  ProvisioningTimeline,
  SkeletonBlock,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from "ui";
import { apiErrorMessage, fetcher } from "@/frontend/shared/fetcher";
import type { EnvironmentRecord, EnvironmentStats } from "@/frontend/shared/types";
import { destroyEnvironment } from "../api";
import { ENV_TYPE_LABELS } from "../constants";
import { buildProvisioningSteps, getTabsForEnvironment } from "../mappers";
import type { DetailTab } from "../types";

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
  const [activeTab, setActiveTab] = useState<DetailTab>("deployment");

  const {
    data: env,
    error,
    isLoading,
    mutate,
  } = useSWR<EnvironmentRecord>(
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

  const { data: stats, error: statsError, mutate: retryStats } = useSWR<EnvironmentStats>(
    env ? `/api/environments/${id}/stats` : null,
    fetcher,
    { refreshInterval: 60_000 }
  );

  const handleDestroy = async () => {
    if (!env) return;
    setDestroying(true);
    setShowDestroyModal(false);
    await destroyEnvironment(id);
    router.push("/dashboard");
  };

  if (isLoading && !error) {
    return (
      <div className="mx-auto max-w-6xl">
        <SkeletonBlock className="h-6 w-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <Panel>
          <PanelHeader title="Unable to load environment" />
          <PanelContent className="space-y-s-3 py-s-8 text-center">
            <p className="text-sm text-ink-dim">
              {apiErrorMessage(error, "The environment API did not respond successfully")}
            </p>
            <div className="flex justify-center gap-s-3">
              <Button size="sm" variant="secondary" onClick={() => void mutate()}>
                Retry
              </Button>
              <Button size="sm" variant="ghost" onClick={() => router.push("/dashboard")}>
                Back to Dashboard
              </Button>
            </div>
          </PanelContent>
        </Panel>
      </div>
    );
  }

  if (!env) {
    return (
      <div className="mx-auto max-w-6xl">
        <Panel>
          <PanelContent className="py-s-8 text-center">
            <p className="mb-s-3 text-sm text-ink-dim">Environment not found</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push("/dashboard")}
            >
              Back to Dashboard
            </Button>
          </PanelContent>
        </Panel>
      </div>
    );
  }

  const tabs = getTabsForEnvironment(env);

  return (
    <>
      <ConfirmModal
        isOpen={showDestroyModal}
        onClose={() => setShowDestroyModal(false)}
        onConfirm={handleDestroy}
        title="Destroy environment"
        message={`Destroy "${env.name}"? This cannot be undone.`}
        confirmText="Destroy"
        variant="danger"
        isLoading={destroying}
      />

      <div className="mx-auto flex max-w-6xl flex-col gap-s-6">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="mb-s-4"
          >
            All Environments
          </Button>
          <div className="flex items-start justify-between gap-s-4">
            <div className="flex min-w-0 items-center gap-s-3">
              <Badge>{ENV_TYPE_LABELS[env.type]}</Badge>
              <h1 className="truncate font-sans text-xl font-semibold text-ink-hi">
                {env.name}
              </h1>
              <Badge variant={env.isHealthy ? "green" : "red"}>
                {env.isHealthy ? "healthy" : "unhealthy"}
              </Badge>
            </div>
            {env.type === "EPHEMERAL" && env.status !== "DESTROYING" ? (
              <Button
                variant="critical"
                size="sm"
                disabled={destroying}
                isLoading={destroying}
                onClick={() => setShowDestroyModal(true)}
              >
                Destroy Environment
              </Button>
            ) : null}
          </div>
        </div>

        <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as DetailTab)}>
          <TabList aria-label="Environment detail tabs">
            {tabs.map((tab) => (
              <Tab key={tab.id} id={tab.id}>
                {tab.label}
              </Tab>
            ))}
          </TabList>

          <TabPanel id="deployment" className="space-y-s-6">
            <KpiGrid columns={4}>
              <KpiCard label="Status" value={env.status} monoValue />
              <KpiCard label="Branch" value={env.gitBranch ?? "—"} monoValue />
              <KpiCard
                label="Commit"
                value={env.gitSha?.slice(0, 7) ?? "—"}
                monoValue
              />
              <KpiCard
                label="Created"
                value={new Date(env.createdAt).toLocaleDateString()}
                monoValue
              />
            </KpiGrid>

            <ProvisioningTimeline
              title="Provisioning"
              meta={env.status.toLowerCase()}
            >
              {buildProvisioningSteps(env).map((step, index, steps) => (
                <ProvisioningTimeline.Step
                  key={step.label}
                  label={step.label}
                  description={step.description}
                  status={step.status}
                  time={step.time}
                  isLast={index === steps.length - 1}
                />
              ))}
            </ProvisioningTimeline>

            <Panel>
              <PanelHeader title="Endpoints" />
              <EndpointRow
                label="Backend"
                value={env.flyAppUrl}
                externalHref={env.flyAppUrl ?? undefined}
              />
              <EndpointRow
                label="Frontend"
                value={env.vercelUrl}
                externalHref={env.vercelUrl ?? undefined}
              />
              {env.expiresAt ? (
                <EndpointRow
                  label="Expires"
                  value={new Date(env.expiresAt).toLocaleString()}
                  externalHref={undefined}
                />
              ) : null}
            </Panel>

            {env.errorLog ? (
              <Panel>
                <PanelHeader title={env.status === "ERROR" ? "Provisioning Error" : "Warnings"} />
                <LogStream heightClassName="max-h-48">
                  <LogStream.Line level="error">{env.errorLog}</LogStream.Line>
                </LogStream>
              </Panel>
            ) : null}

            <KpiGrid columns={4}>
              <KpiCard label="Runs" value={stats?.runs ?? "—"} />
              <KpiCard label="Connections" value={stats?.connections ?? "—"} />
              <KpiCard label="Tenants" value={stats?.tenants ?? "—"} />
              <KpiCard label="Users" value={stats?.users ?? "—"} />
            </KpiGrid>
            {statsError ? (
              <Panel>
                <PanelContent className="flex items-center justify-between gap-s-3">
                  <p className="text-xs text-event-red">
                    {apiErrorMessage(statsError, "Unable to load environment stats")}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void retryStats()}
                  >
                    Retry
                  </Button>
                </PanelContent>
              </Panel>
            ) : null}
          </TabPanel>

          <TabPanel id="users">
            <Panel>
              <PanelContent className="py-s-8 text-center">
                <p className="text-sm text-ink">
                  Tenant and organization controls will render here once the
                  shared table/form composition is migrated.
                </p>
                <p className="mt-1 text-xs text-ink-dim">
                  Current status: {env.status}
                  {!env.isHealthy ? " (unhealthy)" : ""}
                </p>
              </PanelContent>
            </Panel>
          </TabPanel>

          <TabPanel id="resources">
            <Panel>
              <PanelContent className="py-s-8 text-center">
                <p className="text-sm text-ink">
                  Resource metrics will render here through shared `MetricChart`
                  and `Panel` components.
                </p>
              </PanelContent>
            </Panel>
          </TabPanel>

          <TabPanel id="load-tests">
            <Panel>
              <PanelContent className="py-s-8 text-center">
                <p className="text-sm text-ink">
                  Load test controls will render here through shared table and
                  button primitives.
                </p>
              </PanelContent>
            </Panel>
          </TabPanel>

          <TabPanel id="database">
            <Panel>
              <PanelContent className="py-s-8 text-center">
                <p className="text-sm text-ink">
                  Local database controls are available for local environments.
                </p>
              </PanelContent>
            </Panel>
          </TabPanel>
        </Tabs>
      </div>
    </>
  );
}
