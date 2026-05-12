"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import {
  Button,
  ConfirmModal,
  EnvCard,
  Panel,
  PanelContent,
  PanelHeader,
  Skeleton,
} from "ui";
import { apiErrorMessage, fetcher } from "@/frontend/shared/fetcher";
import type { EnvironmentRecord } from "@/frontend/shared/types";
import { destroyEnvironment } from "../api";
import { ENV_CARD_TYPE } from "../constants";
import { hostValue, relativeTimeLabel } from "../mappers";

export function DashboardPage() {
  const router = useRouter();
  const [destroyTarget, setDestroyTarget] = useState<EnvironmentRecord | null>(
    null
  );
  const [destroying, setDestroying] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<EnvironmentRecord[]>(
    "/api/environments",
    fetcher,
    { refreshInterval: 15_000 }
  );

  const permanentEnvs = data?.filter((e) => e.type !== "EPHEMERAL") ?? [];
  const ephemeralEnvs = data?.filter((e) => e.type === "EPHEMERAL") ?? [];

  const handleConfirmDestroy = async () => {
    if (!destroyTarget) return;
    setDestroying(true);
    await destroyEnvironment(destroyTarget.id);
    await mutate();
    setDestroying(false);
    setDestroyTarget(null);
  };

  return (
    <>
      <ConfirmModal
        isOpen={Boolean(destroyTarget)}
        onClose={() => !destroying && setDestroyTarget(null)}
        onConfirm={handleConfirmDestroy}
        title="Destroy environment"
        message={`Destroy "${destroyTarget?.name ?? "environment"}"? This cannot be undone.`}
        confirmText="Destroy"
        variant="danger"
        isLoading={destroying}
      />

      <div className="mx-auto flex max-w-6xl flex-col gap-s-8">
        <div className="flex items-center justify-between gap-s-4">
          <div>
            <h1 className="font-sans text-xl font-semibold text-ink-hi">
              Environments
            </h1>
            <p className="mt-1 text-xs text-ink-dim">
              Monitor and manage all platform environments.
            </p>
          </div>
          <Button onClick={() => router.push("/dashboard/new")}>
            New Environment
          </Button>
        </div>

        {error ? (
          <Panel>
            <PanelHeader title="Unable to load environments" />
            <PanelContent className="space-y-s-3">
              <p className="text-sm text-ink-dim">
                {apiErrorMessage(
                  error,
                  "The environments API did not respond successfully"
                )}
              </p>
              <Button size="sm" variant="secondary" onClick={() => void mutate()}>
                Retry
              </Button>
            </PanelContent>
          </Panel>
        ) : null}

        {isLoading && !error ? (
          <section>
            <PanelHeader title="Loading environments" />
            <div className="grid grid-cols-1 gap-s-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} name="env-card" loading>
                  <span />
                </Skeleton>
              ))}
            </div>
          </section>
        ) : null}

        {!isLoading && !error && permanentEnvs.length > 0 ? (
          <section>
            <PanelHeader
              title="Permanent"
              actions={
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-dim">
                  {permanentEnvs.length} envs
                </span>
              }
            />
            <div className="grid grid-cols-1 gap-s-4 md:grid-cols-2 xl:grid-cols-3">
              {permanentEnvs.map((env) => (
                <Link key={env.id} href={`/dashboard/${env.id}`} className="block">
                  <EnvCard
                    type={ENV_CARD_TYPE[env.type]}
                    title={env.name}
                    badgeLabel={env.type.toLowerCase()}
                    meta={[env.gitBranch, env.gitSha?.slice(0, 7)]
                      .filter(Boolean)
                      .join(" · ")}
                  >
                    <EnvCard.Hosts>
                      <EnvCard.HostRow
                        label="Backend"
                        value={hostValue(env.flyAppUrl)}
                      />
                      <EnvCard.HostRow
                        label="Frontend"
                        value={hostValue(env.vercelUrl)}
                      />
                    </EnvCard.Hosts>
                    <EnvCard.Footer>
                      <EnvCard.Health status={env.isHealthy ? "hot" : "error"}>
                        {relativeTimeLabel(env.lastHealthAt)}
                      </EnvCard.Health>
                    </EnvCard.Footer>
                  </EnvCard>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {!isLoading && !error && ephemeralEnvs.length > 0 ? (
          <section>
            <PanelHeader
              title="Ephemeral"
              actions={
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-dim">
                  {ephemeralEnvs.length} envs
                </span>
              }
            />
            <div className="grid grid-cols-1 gap-s-4 md:grid-cols-2 xl:grid-cols-3">
              {ephemeralEnvs.map((env) => (
                <Link key={env.id} href={`/dashboard/${env.id}`} className="block">
                  <EnvCard
                    type={ENV_CARD_TYPE[env.type]}
                    title={env.name}
                    badgeLabel={env.type.toLowerCase()}
                    meta={[env.gitBranch, env.gitSha?.slice(0, 7)]
                      .filter(Boolean)
                      .join(" · ")}
                  >
                    <EnvCard.Hosts>
                      <EnvCard.HostRow
                        label="Backend"
                        value={hostValue(env.flyAppUrl)}
                      />
                      <EnvCard.HostRow
                        label="Frontend"
                        value={hostValue(env.vercelUrl)}
                      />
                    </EnvCard.Hosts>
                    <EnvCard.Footer>
                      <EnvCard.Health status={env.isHealthy ? "hot" : "error"}>
                        {relativeTimeLabel(env.lastHealthAt)}
                      </EnvCard.Health>
                      {env.expiresAt ? (
                        <EnvCard.Ttl>
                          TTL {relativeTimeLabel(env.expiresAt)}
                        </EnvCard.Ttl>
                      ) : null}
                      {env.status === "RUNNING" ? (
                        <Button
                          size="sm"
                          variant="critical"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setDestroyTarget(env);
                          }}
                        >
                          Destroy
                        </Button>
                      ) : null}
                    </EnvCard.Footer>
                  </EnvCard>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {!isLoading && !error && data?.length === 0 ? (
          <Panel>
            <PanelContent className="py-s-8 text-center">
              <p className="text-sm text-ink">No environments yet.</p>
              <p className="mt-1 text-xs text-ink-dim">
                Create an environment to start monitoring deploy health.
              </p>
            </PanelContent>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
