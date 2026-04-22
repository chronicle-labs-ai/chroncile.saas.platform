"use client";

import { useState } from "react";
import type { MigrationStatus, MigrationEntry } from "@/lib/local-db";
import { ActionButton, type ActionState } from "./shared";

export function MigrationsPanel({
  migrations,
  pgReady,
  onRefresh,
}: {
  migrations: MigrationStatus | null;
  pgReady: boolean;
  onRefresh: () => void;
}) {
  const [migrateState, setMigrateState] = useState<ActionState>("idle");
  const [result, setResult] = useState<string | null>(null);

  const runMigrate = async () => {
    setMigrateState("loading");
    setResult(null);
    try {
      const res = await fetch("/api/local-db/migrate", { method: "POST" });
      const data = await res.json();
      setMigrateState(data.success ? "success" : "error");
      if (data.success) {
        setResult(`Migrated: ${data.versionBefore} → ${data.versionAfter}`);
      } else {
        const failed = data.results?.filter((r: { success: boolean }) => !r.success);
        setResult(`Failed: ${failed?.map((r: { target: string }) => r.target).join(", ")}`);
      }
    } catch {
      setMigrateState("error");
      setResult("Migration request failed");
    }
    onRefresh();
    setTimeout(() => setMigrateState("idle"), 3000);
  };

  if (!pgReady) {
    return (
      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Migrations</span>
        </div>
        <div className="panel__content text-center py-6">
          <p className="text-sm text-secondary">Start Postgres to view migration status</p>
        </div>
      </div>
    );
  }

  const applied = migrations?.sqlx.applied ?? [];
  const pending = migrations?.sqlx.pending ?? [];

  return (
    <div className="panel">
      <div className="panel__header">
        <div className="flex items-center gap-2">
          <span className="panel__title">Migrations</span>
          <span className="badge badge--data font-mono">
            {migrations?.overallVersion === "none"
              ? "no migrations"
              : `v${migrations?.overallVersion}`}
          </span>
          {pending.length > 0 && (
            <span className="badge badge--caution font-mono">
              {pending.length} pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <span className={`text-xs font-mono ${migrateState === "error" ? "text-critical" : "text-nominal"}`}>
              {result}
            </span>
          )}
          <ActionButton
            onClick={runMigrate}
            state={migrateState}
            label="Run Migrations"
            loadingLabel="Running..."
            className="btn btn--primary btn--sm"
          />
        </div>
      </div>
      <div className="panel__content">
        {applied.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-dim">
                  <th className="text-left py-2 pr-4 label">Version</th>
                  <th className="text-left py-2 pr-4 label">Description</th>
                  <th className="text-left py-2 label">Applied</th>
                </tr>
              </thead>
              <tbody>
                {applied.map((m: MigrationEntry) => (
                  <tr key={m.version} className="border-b border-border-dim last:border-0">
                    <td className="py-2 pr-4 font-mono text-data">{m.version}</td>
                    <td className="py-2 pr-4 font-mono text-primary">{m.description}</td>
                    <td className="py-2 font-mono text-tertiary">
                      {new Date(m.appliedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-secondary py-2">No migrations applied yet</p>
        )}

        {pending.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border-dim">
            <span className="label block mb-2">Pending</span>
            <div className="space-y-1">
              {pending.map((name: string) => (
                <div key={name} className="font-mono text-xs text-caution">{name}</div>
              ))}
            </div>
          </div>
        )}

        {migrations?.prisma && migrations.prisma.status !== "no-table" && (
          <div className="mt-3 pt-3 border-t border-border-dim">
            <div className="flex items-center gap-2">
              <span className="label">Prisma</span>
              <span className="font-mono text-xs text-secondary">
                {migrations.prisma.applied.length} migration(s) applied
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
