"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import {
  Badge,
  Button,
  FormField,
  Input,
  NativeSelect,
  OptionTile,
  Panel,
  PanelContent,
  PanelHeader,
} from "ui";
import { apiErrorMessage, fetcher } from "@/frontend/shared/fetcher";
import { createEphemeralEnvironment } from "../api";
import { SECRET_FIELDS, TEMPLATE_MODE_LABEL, TTL_OPTIONS } from "../constants";
import { nonEmptySecrets } from "../mappers";
import type { Branch, DbTemplateSummary } from "../types";

export function NewEnvironmentPage() {
  const router = useRouter();
  const {
    data: branches,
    error: branchesError,
    isLoading: branchesLoading,
    mutate: retryBranches,
  } = useSWR<Branch[]>("/api/branches", fetcher);
  const {
    data: templates,
    error: templatesError,
    mutate: retryTemplates,
  } = useSWR<DbTemplateSummary[]>("/api/db-templates", fetcher);

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
      await createEphemeralEnvironment({
        branch: selectedBranch,
        ttlHours,
        secrets: nonEmptySecrets(secrets),
        dbTemplateId,
      });

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-s-6">
        <Button
          onClick={() => router.push("/dashboard")}
          variant="ghost"
          size="sm"
        >
          Back to Dashboard
        </Button>
      </div>

      <div className="mb-s-6">
        <h1 className="font-sans text-xl font-semibold text-ink-hi">
          New Ephemeral Environment
        </h1>
        <p className="mt-1 text-xs text-ink-dim">
          Spin up an isolated environment for any git branch.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-s-6">
        <Panel>
          <PanelHeader title="Git Branch" />
          <PanelContent>
            <FormField label="Branch" htmlFor="env-branch">
              <NativeSelect
                id="env-branch"
                required
                value={selectedBranch}
                onChange={(event) => setSelectedBranch(event.target.value)}
                disabled={branchesLoading || Boolean(branchesError)}
              >
                <option value="">
                  {branchesLoading
                    ? "Loading branches..."
                    : branchesError
                      ? "Branches unavailable"
                      : "Select a branch"}
                </option>
                {(branches ?? []).map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}
                    {branch.isDefault ? " (default)" : ""} ·{" "}
                    {branch.sha.slice(0, 7)}
                  </option>
                ))}
              </NativeSelect>
              {branchesError ? (
                <div className="mt-s-2 flex items-center justify-between gap-s-3">
                  <p className="text-xs text-event-red">
                    {apiErrorMessage(branchesError, "Unable to load branches")}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void retryBranches()}
                  >
                    Retry
                  </Button>
                </div>
              ) : null}
            </FormField>
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader title="Time to Live" />
          <PanelContent className="flex flex-wrap gap-s-2">
            {TTL_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                type="button"
                size="sm"
                variant={ttlHours === opt.value ? "primary" : "secondary"}
                onClick={() => setTtlHours(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader
            title="Database"
            actions={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard/templates")}
              >
                Manage Templates
              </Button>
            }
          />
          <PanelContent className="space-y-s-3">
            <OptionTile
              label="Fresh empty database"
              meta="New Fly Postgres cluster with only migrations applied"
              isSelected={!dbTemplateId}
              onClick={() => setDbTemplateId(null)}
            />

            {(templates ?? []).map((template) => (
              <OptionTile
                key={template.id}
                label={template.name}
                meta={template.description ?? "Database template"}
                rightTag={<Badge>{TEMPLATE_MODE_LABEL[template.mode]}</Badge>}
                isSelected={dbTemplateId === template.id}
                onClick={() => setDbTemplateId(template.id)}
              />
            ))}

            {templatesError ? (
              <div className="flex items-center justify-between gap-s-3">
                <p className="text-xs text-event-red">
                  {apiErrorMessage(templatesError, "Unable to load templates")}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void retryTemplates()}
                >
                  Retry
                </Button>
              </div>
            ) : (templates ?? []).length === 0 ? (
              <p className="text-xs text-ink-dim">
                No templates created yet. Use DB Templates to add one.
              </p>
            ) : null}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader
            title="Secrets"
            actions={
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-dim">
                Optional overrides
              </span>
            }
          />
          <PanelContent className="space-y-s-4">
            <p className="text-xs text-ink-dim">
              Leave blank to use defaults from SECRETS_TEMPLATE.
            </p>
            {SECRET_FIELDS.map((field) => (
              <FormField
                key={field.key}
                label={field.label}
                htmlFor={field.key}
              >
                <Input
                  id={field.key}
                  type="text"
                  value={secrets[field.key] ?? ""}
                  onChange={(event) =>
                    setSecrets((prev) => ({
                      ...prev,
                      [field.key]: event.target.value,
                    }))
                  }
                  placeholder={field.placeholder}
                  className="font-mono text-xs"
                />
              </FormField>
            ))}
          </PanelContent>
        </Panel>

        {error ? (
          <Panel>
            <PanelContent>
              <p className="text-xs text-event-red">{error}</p>
            </PanelContent>
          </Panel>
        ) : null}

        <Button
          type="submit"
          disabled={!selectedBranch || submitting || Boolean(branchesError)}
          variant="primary"
          isLoading={submitting}
          className="w-full"
        >
          {submitting ? "Provisioning..." : "Create Environment"}
        </Button>
      </form>
    </div>
  );
}
