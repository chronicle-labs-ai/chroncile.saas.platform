"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Badge,
  Button,
  Cell,
  Column,
  ConfirmModal,
  FormField,
  Input,
  Modal,
  NativeSelect,
  OptionTile,
  Panel,
  PanelContent,
  PanelHeader,
  Row,
  SkeletonBlock,
  Table,
  TableBody,
  TableHeader,
} from "ui";
import { apiErrorMessage, fetcher } from "@/frontend/shared/fetcher";
import type { EnvironmentRecord } from "@/frontend/shared/types";
import { createDbTemplate, deleteDbTemplate } from "../api";
import { MODE_LABELS, MODE_OPTIONS, MODE_TONE } from "../constants";
import {
  seedOptionLabel,
  templateLastUsedLabel,
  templateSeedLabel,
  templateSourceLabel,
} from "../mappers";
import type { DbTemplate, SeedFile } from "../types";

export function TemplatesPage() {
  const {
    data: templates,
    error: templatesError,
    isLoading,
    mutate,
  } = useSWR<DbTemplate[]>("/api/db-templates", fetcher);
  const { data: envs, error: envsError, mutate: retryEnvs } = useSWR<EnvironmentRecord[]>(
    "/api/environments",
    fetcher
  );
  const {
    data: availableSeeds,
    error: seedsError,
    mutate: retrySeeds,
  } = useSWR<SeedFile[]>("/api/seeds", fetcher);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DbTemplate | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<DbTemplate["mode"]>("FLY_DB");
  const [flyDbName, setFlyDbName] = useState("");
  const [sourceEnvId, setSourceEnvId] = useState("");
  const [seedSqlUrl, setSeedSqlUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetCreateForm = () => {
    setName("");
    setDescription("");
    setMode("FLY_DB");
    setFlyDbName("");
    setSourceEnvId("");
    setSeedSqlUrl("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createDbTemplate({
        name,
        description,
        mode,
        flyDbName,
        sourceEnvId,
        seedSqlUrl,
      });
      await mutate();
      resetCreateForm();
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDbTemplate(deleteTarget.id);
    await mutate();
    setDeleteTarget(null);
  };

  return (
    <>
      <Modal
        isOpen={showCreate}
        onClose={() => {
          resetCreateForm();
          setShowCreate(false);
        }}
        title="New DB Template"
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-db-template"
              isLoading={loading}
            >
              Create Template
            </Button>
          </>
        }
      >
        <form id="create-db-template" onSubmit={handleSubmit} className="space-y-s-4">
          <FormField label="Template Name" htmlFor="db-template-name">
            <Input
              id="db-template-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="demo-users"
            />
          </FormField>

          <FormField label="Description" htmlFor="db-template-description">
            <Input
              id="db-template-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Pre-seeded with demo users and sample runs"
            />
          </FormField>

          <div className="space-y-s-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-dim">
              Database Source
            </span>
            {MODE_OPTIONS.map((option) => (
              <OptionTile
                key={option.value}
                label={option.label}
                meta={option.description}
                isSelected={mode === option.value}
                onClick={() => setMode(option.value)}
              />
            ))}
          </div>

          {mode === "FLY_DB" ? (
            <FormField label="Fly Postgres App" htmlFor="fly-db-name">
              <NativeSelect
                id="fly-db-name"
                required
                value={flyDbName}
                onChange={(event) => setFlyDbName(event.target.value)}
                disabled={Boolean(envsError)}
              >
                <option value="">
                  {envsError ? "Environments unavailable" : "Select a Postgres app..."}
                </option>
                {(envs ?? [])
                  .filter((env) => env.flyDbName)
                  .map((env) => (
                    <option key={env.flyDbName} value={env.flyDbName!}>
                      {env.flyDbName} — {env.name}
                    </option>
                  ))}
              </NativeSelect>
              {envsError ? (
                <div className="mt-s-2 flex items-center justify-between gap-s-3">
                  <p className="text-xs text-event-red">
                    {apiErrorMessage(envsError, "Unable to load environments")}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void retryEnvs()}
                  >
                    Retry
                  </Button>
                </div>
              ) : null}
            </FormField>
          ) : null}

          {mode === "ENVIRONMENT" ? (
            <FormField label="Source Environment" htmlFor="source-environment-id">
              <NativeSelect
                id="source-environment-id"
                required
                value={sourceEnvId}
                onChange={(event) => setSourceEnvId(event.target.value)}
                disabled={Boolean(envsError)}
              >
                <option value="">
                  {envsError ? "Environments unavailable" : "Select environment..."}
                </option>
                {(envs ?? [])
                  .filter((env) => env.flyDbName)
                  .map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.name} — {env.flyDbName}
                    </option>
                  ))}
              </NativeSelect>
              {envsError ? (
                <div className="mt-s-2 flex items-center justify-between gap-s-3">
                  <p className="text-xs text-event-red">
                    {apiErrorMessage(envsError, "Unable to load environments")}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void retryEnvs()}
                  >
                    Retry
                  </Button>
                </div>
              ) : null}
            </FormField>
          ) : null}

          <FormField label="Seed SQL" htmlFor="seed-sql-url">
            <NativeSelect
              id="seed-sql-url"
              value={seedSqlUrl}
              onChange={(event) => setSeedSqlUrl(event.target.value)}
              disabled={Boolean(seedsError)}
            >
              <option value="">
                {seedsError ? "Seed files unavailable" : "No seed data"}
              </option>
              {(availableSeeds ?? []).map((seed) => (
                <option key={seed.name} value={seed.url}>
                  {seedOptionLabel(seed)}
                </option>
              ))}
            </NativeSelect>
            {seedsError ? (
              <div className="mt-s-2 flex items-center justify-between gap-s-3">
                <p className="text-xs text-event-red">
                  {apiErrorMessage(seedsError, "Unable to load seed files")}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void retrySeeds()}
                >
                  Retry
                </Button>
              </div>
            ) : null}
          </FormField>

          {error ? <p className="text-xs text-event-red">{error}</p> : null}
        </form>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete DB template"
        message={`Delete template "${deleteTarget?.name ?? "template"}"?`}
        confirmText="Delete"
        variant="danger"
      />

      <div className="mx-auto flex max-w-4xl flex-col gap-s-6">
        <div className="flex items-start justify-between gap-s-4">
          <div>
            <h1 className="font-sans text-xl font-semibold text-ink-hi">
              Database Templates
            </h1>
            <p className="mt-1 text-xs text-ink-dim">
              Pre-configured databases for ephemeral environments.
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>New Template</Button>
        </div>

        <Panel>
          <PanelHeader
            title="Templates"
            actions={<Badge>{templates?.length ?? 0}</Badge>}
          />
          <PanelContent>
            {templatesError ? (
              <div className="space-y-s-3 py-s-8 text-center">
                <p className="text-sm text-ink-dim">
                  {apiErrorMessage(
                    templatesError,
                    "Unable to load database templates"
                  )}
                </p>
                <Button size="sm" variant="secondary" onClick={() => void mutate()}>
                  Retry
                </Button>
              </div>
            ) : isLoading ? (
              <div className="space-y-s-3">
                <SkeletonBlock className="h-10 w-full" />
                <SkeletonBlock className="h-10 w-full" />
              </div>
            ) : (templates?.length ?? 0) === 0 ? (
              <div className="py-s-8 text-center">
                <p className="mb-s-3 text-sm text-ink-dim">No templates yet.</p>
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  Create your first template
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <Row>
                    <Column>Name</Column>
                    <Column>Mode</Column>
                    <Column>Source</Column>
                    <Column>Seed SQL</Column>
                    <Column>Last Used</Column>
                    <Column>Actions</Column>
                  </Row>
                </TableHeader>
                <TableBody>
                  {templates!.map((template) => (
                    <Row key={template.id}>
                      <Cell>
                        <span className="font-medium text-ink-hi">
                          {template.name}
                        </span>
                        {template.description ? (
                          <p className="mt-0.5 text-[10px] text-ink-dim">
                            {template.description}
                          </p>
                        ) : null}
                      </Cell>
                      <Cell>
                        <Badge variant={MODE_TONE[template.mode]}>
                          {MODE_LABELS[template.mode]}
                        </Badge>
                      </Cell>
                      <Cell className="font-mono">
                        {templateSourceLabel(template)}
                      </Cell>
                      <Cell>{templateSeedLabel(template)}</Cell>
                      <Cell className="font-mono">
                        {templateLastUsedLabel(template)}
                      </Cell>
                      <Cell>
                        <Button
                          size="sm"
                          variant="critical"
                          onClick={() => setDeleteTarget(template)}
                        >
                          Delete
                        </Button>
                      </Cell>
                    </Row>
                  ))}
                </TableBody>
              </Table>
            )}
          </PanelContent>
        </Panel>
      </div>
    </>
  );
}
