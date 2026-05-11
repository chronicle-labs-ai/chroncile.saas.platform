"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Badge,
  Button,
  Cell,
  Column,
  ConfirmModal,
  CopyButton,
  FormField,
  Input,
  Panel,
  PanelContent,
  PanelHeader,
  Row,
  Table,
  TableBody,
  TableHeader,
} from "ui";
import { apiErrorMessage, fetcher } from "@/frontend/shared/fetcher";
import { createDeveloper, deleteDeveloper } from "../api";
import {
  developerMakeCommand,
  developerNameToTunnelDomain,
} from "../mappers";
import type { Developer } from "../types";

export function DevelopersPage() {
  const {
    data: developers,
    error: developersError,
    isLoading,
    mutate,
  } = useSWR<Developer[]>("/api/developers", fetcher);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tunnelDomain, setTunnelDomain] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Developer | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createDeveloper({ name, email, tunnelDomain });
      setShowForm(false);
      setName("");
      setEmail("");
      setTunnelDomain("");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    await deleteDeveloper(deleteTarget.id);
    await mutate();
    setDeletingId(null);
    setDeleteTarget(null);
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (
      !tunnelDomain ||
      tunnelDomain === developerNameToTunnelDomain(name)
    ) {
      setTunnelDomain(developerNameToTunnelDomain(value));
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-s-6">
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove developer"
        message={`Remove developer "${deleteTarget?.name ?? "developer"}"? This will delete their Doppler branch configs.`}
        confirmText="Remove"
        variant="danger"
        isLoading={Boolean(deletingId)}
      />

      <div className="flex items-center justify-between gap-s-4">
        <div>
          <h1 className="font-sans text-xl font-semibold text-ink-hi">
            Developers
          </h1>
          <p className="mt-1 text-xs text-ink-dim">
            Manage developer environments, tunnel domains, and Doppler configs.
          </p>
        </div>
        <Button onClick={() => setShowForm((current) => !current)}>
          {showForm ? "Cancel" : "Add Developer"}
        </Button>
      </div>

      {showForm ? (
        <Panel>
          <PanelHeader title="New Developer" />
          <PanelContent>
            <form onSubmit={handleAdd} className="space-y-s-4">
              <div className="grid grid-cols-1 gap-s-4 md:grid-cols-3">
                <FormField label="Name" htmlFor="developer-name">
                  <Input
                    id="developer-name"
                    required
                    value={name}
                    onChange={(event) => handleNameChange(event.target.value)}
                    placeholder="ernesto"
                  />
                </FormField>
                <FormField label="Email" htmlFor="developer-email">
                  <Input
                    id="developer-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="ernesto@chronicle-labs.com"
                  />
                </FormField>
                <FormField label="Tunnel Domain" htmlFor="developer-domain">
                  <Input
                    id="developer-domain"
                    required
                    value={tunnelDomain}
                    onChange={(event) => setTunnelDomain(event.target.value)}
                    placeholder="ernesto.chronicle-labs.com"
                  />
                </FormField>
              </div>

              {error ? <p className="text-xs text-event-red">{error}</p> : null}

              <div className="flex items-center gap-s-3 border-t border-hairline pt-s-3">
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  isLoading={submitting}
                >
                  {submitting ? "Creating..." : "Create Developer"}
                </Button>
                <p className="text-xs text-ink-dim">
                  Creates branch-scoped Doppler configs for this developer.
                </p>
              </div>
            </form>
          </PanelContent>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader
          title="Registered Developers"
          actions={
            <Badge>{developers?.length ?? 0} developers</Badge>
          }
        />
        <PanelContent>
          {developersError ? (
            <div className="space-y-s-3 py-s-8 text-center">
              <p className="text-sm text-ink-dim">
                {apiErrorMessage(developersError, "Unable to load developers")}
              </p>
              <Button size="sm" variant="secondary" onClick={() => void mutate()}>
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <p className="py-s-8 text-center text-sm text-ink-dim">Loading...</p>
          ) : !developers || developers.length === 0 ? (
            <div className="py-s-8 text-center">
              <p className="text-sm text-ink">No developers registered.</p>
              <p className="mt-1 text-xs text-ink-dim">
                Add a developer to create their Doppler configs and tunnel
                domain.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <Row>
                    <Column>Name</Column>
                    <Column>Email</Column>
                    <Column>Tunnel Domain</Column>
                    <Column>Doppler Suffix</Column>
                    <Column>Command</Column>
                    <Column>Actions</Column>
                  </Row>
                </TableHeader>
                <TableBody>
                  {developers.map((dev) => (
                    <Row key={dev.id}>
                      <Cell className="font-mono text-event-teal">
                        {dev.name}
                      </Cell>
                      <Cell>{dev.email ?? "—"}</Cell>
                      <Cell className="font-mono">{dev.tunnelDomain}</Cell>
                      <Cell className="font-mono">{dev.dopplerSuffix}</Cell>
                      <Cell>
                        <CopyButton
                          text={developerMakeCommand(dev)}
                          label={developerMakeCommand(dev)}
                        />
                      </Cell>
                      <Cell>
                        <Button
                          size="sm"
                          variant="critical"
                          disabled={deletingId === dev.id}
                          isLoading={deletingId === dev.id}
                          onClick={() => setDeleteTarget(dev)}
                        >
                          Remove
                        </Button>
                      </Cell>
                    </Row>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </PanelContent>
      </Panel>
    </div>
  );
}
