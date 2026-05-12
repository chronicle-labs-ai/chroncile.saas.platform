import type { ProvisioningStepStatus } from "ui";
import type { EnvironmentRecord } from "@/frontend/shared/types";
import { BASE_DETAIL_TABS, DATABASE_DETAIL_TAB } from "./constants";

export function relativeTimeLabel(date: string | null) {
  if (!date) return "never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function hostValue(url: string | null) {
  return url?.replace("https://", "") ?? null;
}

export function nonEmptySecrets(secrets: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(secrets).filter(([, value]) => value.trim() !== "")
  );
}

export function buildProvisioningSteps(env: EnvironmentRecord) {
  const isError = env.status === "ERROR";
  const isProvisioning = env.status === "PROVISIONING";
  const pendingStatus: ProvisioningStepStatus = isError
    ? "error"
    : isProvisioning
      ? "active"
      : "pending";

  return [
    {
      label: "Environment record",
      description: env.id,
      status: "done" as ProvisioningStepStatus,
      time: new Date(env.createdAt).toLocaleDateString(),
    },
    {
      label: "Backend",
      description: env.flyAppName ?? "Fly app",
      status: env.flyAppUrl ? ("done" as ProvisioningStepStatus) : pendingStatus,
      time: env.flyAppUrl ? "ready" : undefined,
    },
    {
      label: "Frontend",
      description: env.vercelDeploymentId ?? "Vercel preview",
      status: env.vercelUrl ? ("done" as ProvisioningStepStatus) : pendingStatus,
      time: env.vercelUrl ? "ready" : undefined,
    },
  ];
}

export function getTabsForEnvironment(env: EnvironmentRecord) {
  return env.type === "LOCAL"
    ? [...BASE_DETAIL_TABS, DATABASE_DETAIL_TAB]
    : BASE_DETAIL_TABS;
}
