"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { Button, FormField, Input } from "ui";
import { BranchPicker } from "@/shared/components/branch-picker";
import { fetcher } from "@/shared/fetcher";

interface Branch {
  name: string;
  sha: string;
  isDefault: boolean;
}

interface DbTemplate {
  id: string;
  name: string;
  description: string | null;
  mode: "FLY_DB" | "ENVIRONMENT" | "SEED_ONLY";
}

const SECRET_FIELDS = [
  { key: "AUTH_SECRET", label: "Auth Secret", placeholder: "Override or leave blank for default" },
  { key: "STRIPE_SECRET_KEY", label: "Stripe Secret Key", placeholder: "sk_test_..." },
  { key: "PIPEDREAM_CLIENT_ID", label: "Pipedream Client ID", placeholder: "" },
  { key: "PIPEDREAM_CLIENT_SECRET", label: "Pipedream Client Secret", placeholder: "" },
  { key: "PIPEDREAM_PROJECT_ID", label: "Pipedream Project ID", placeholder: "" },
];

const TTL_OPTIONS = [
  { value: 4, label: "4 hours" },
  { value: 12, label: "12 hours" },
  { value: 24, label: "24 hours" },
  { value: 48, label: "48 hours" },
  { value: 168, label: "7 days" },
];

export function NewEnvironmentPage() {
  const router = useRouter();
  const { data: branches, isLoading: branchesLoading } = useSWR<Branch[]>("/api/branches", fetcher);
  const { data: templates } = useSWR<DbTemplate[]>("/api/db-templates", fetcher);

  const [selectedBranch, setSelectedBranch] = useState("");
  const [ttlHours, setTtlHours] = useState(24);
  const [dbTemplateId, setDbTemplateId] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) return;

    setSubmitting(true);
    setError(null);

    try {
      const nonEmptySecrets = Object.fromEntries(
        Object.entries(secrets).filter(([, v]) => v.trim() !== "")
      );

      const res = await fetch("/api/environments/ephemeral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch: selectedBranch,
          ttlHours,
          secrets: nonEmptySecrets,
          dbTemplateId: dbTemplateId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to provision");
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Button
          onClick={() => router.push("/dashboard")}
          variant="ghost"
          size="sm"
        >
          &larr; Back to Dashboard
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-sans font-semibold">New Ephemeral Environment</h1>
        <p className="text-xs text-tertiary mt-1">
          Spin up an isolated environment for any git branch
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Git Branch</span>
          </div>
          <div className="panel__content">
            <BranchPicker
              branches={branches ?? []}
              value={selectedBranch}
              onChange={setSelectedBranch}
              loading={branchesLoading}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Time to Live</span>
          </div>
          <div className="panel__content">
            <div className="flex gap-2 flex-wrap">
              {TTL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTtlHours(opt.value)}
                  className={
                    ttlHours === opt.value
                      ? "btn btn--primary btn--sm"
                      : "btn btn--secondary btn--sm"
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Database</span>
            <Link href="/dashboard/templates" className="text-[10px] text-data font-mono hover:underline">
              Manage Templates
            </Link>
          </div>
          <div className="panel__content space-y-3">
            <label
              className={`flex items-start gap-3 p-3 rounded-sm border cursor-pointer transition-colors ${
                !dbTemplateId ? "border-data bg-data-bg" : "border-border-dim hover:border-border-bright"
              }`}
            >
              <input
                type="radio"
                name="dbTemplate"
                checked={!dbTemplateId}
                onChange={() => setDbTemplateId(null)}
                className="mt-0.5"
              />
              <div>
                <span className={`text-sm font-medium ${!dbTemplateId ? "text-data" : "text-primary"}`}>
                  Fresh empty database
                </span>
                <p className="text-[10px] text-tertiary mt-0.5">
                  New Fly Postgres cluster with only migrations applied
                </p>
              </div>
            </label>

            {(templates ?? []).map((t) => (
              <label
                key={t.id}
                className={`flex items-start gap-3 p-3 rounded-sm border cursor-pointer transition-colors ${
                  dbTemplateId === t.id ? "border-data bg-data-bg" : "border-border-dim hover:border-border-bright"
                }`}
              >
                <input
                  type="radio"
                  name="dbTemplate"
                  checked={dbTemplateId === t.id}
                  onChange={() => setDbTemplateId(t.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${dbTemplateId === t.id ? "text-data" : "text-primary"}`}>
                      {t.name}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-elevated text-tertiary">
                      {t.mode === "FLY_DB" ? "Fork" : t.mode === "ENVIRONMENT" ? "Env" : "Seed"}
                    </span>
                  </div>
                  {t.description && (
                    <p className="text-[10px] text-tertiary mt-0.5">{t.description}</p>
                  )}
                </div>
              </label>
            ))}

            {(templates ?? []).length === 0 && (
              <p className="text-xs text-tertiary pl-7">
                No templates created yet.{" "}
                <Link href="/dashboard/templates" className="text-data hover:underline">Create one</Link>
              </p>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Secrets</span>
            <span className="font-mono text-[10px] text-tertiary">Optional overrides</span>
          </div>
          <div className="panel__content space-y-4">
            <p className="text-xs text-tertiary">
              Leave blank to use defaults from SECRETS_TEMPLATE.
            </p>
            {SECRET_FIELDS.map((field) => (
              <FormField key={field.key} label={field.label} htmlFor={field.key}>
                <Input
                  id={field.key}
                  type="text"
                  value={secrets[field.key] ?? ""}
                  onChange={(e) =>
                    setSecrets((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  placeholder={field.placeholder}
                  className="font-mono text-xs"
                />
              </FormField>
            ))}
          </div>
        </div>

        {error && (
          <div className="panel border-critical-dim bg-critical-bg">
            <div className="panel__content">
              <div className="flex items-center gap-2">
                <span className="status-dot status-dot--critical" />
                <span className="text-xs text-critical">{error}</span>
              </div>
            </div>
          </div>
        )}

        <Button
          type="submit"
          disabled={!selectedBranch || submitting}
          variant="primary"
          isLoading={submitting}
          className="w-full py-3 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Provisioning..." : "Create Environment"}
        </Button>
      </form>
    </div>
  );
}
