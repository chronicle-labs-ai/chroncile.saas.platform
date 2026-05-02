"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import { type ConnectorCheck, StateError, StateReauth, StateTesting } from "../connectors";
import { getSource } from "../onboarding/data";
import { ConnectionRow } from "./connection-row";
import { ConnectionCard } from "./connection-card";
import { ConnectionEmpty } from "./connection-empty";
import {
  ConnectionsToolbar,
  type ConnectionsView,
} from "./connections-toolbar";
import { ConnectionDetailDrawer } from "./connection-detail-drawer";
import { type ConnectionDetailTab } from "./connection-detail-body";
import { AddConnectionPicker } from "./add-connection-picker";
import {
  connectionBackfillsSeed,
  connectionDeliveriesSeed,
  connectionEventSubsSeed,
  connectionsSeed,
  type Connection,
  type ConnectionBackfillRecord,
  type ConnectionDelivery,
  type ConnectionEventTypeSub,
  type ConnectionHealth,
} from "./data";
import { formatStableDateTime } from "./time";

/*
 * ConnectionsManager — page-level dashboard surface for managing
 * existing connections. Composes the toolbar, list/grid view, the
 * empty state, the detail drawer, and the add-connection picker;
 * delegates per-action edge states to the existing connector
 * modals (`StateError`, `StateReauth`, `StateTesting`).
 *
 * Mostly uncontrolled (state lives inside) but every callback is
 * also surfaced so apps can persist mutations to the backend.
 */

export interface ConnectionsManagerProps {
  /** Initial connection rows. Defaults to the seed for stories. */
  connections?: readonly Connection[];
  /** Per-connection backfill history. */
  backfillsByConnection?: Readonly<
    Record<string, readonly ConnectionBackfillRecord[]>
  >;
  /** Per-connection recent deliveries. */
  deliveriesByConnection?: Readonly<
    Record<string, readonly ConnectionDelivery[]>
  >;
  /** Per-connection event-type subscriptions. */
  eventSubsByConnection?: Readonly<
    Record<string, readonly ConnectionEventTypeSub[]>
  >;
  /** Initial view. Defaults to list. */
  initialView?: ConnectionsView;
  /** Hide the right-side header CTA. The toolbar still has its own. */
  hideHeaderAdd?: boolean;
  /** Optional workspace label rendered in the breadcrumb. */
  workspace?: string;

  /* mutation hooks — let apps persist outside the local store */
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onReauth?: (id: string) => void;
  onTest?: (id: string) => void;
  onDisconnect?: (id: string) => void;
  onRotateSecret?: (id: string) => void;
  onRunBackfill?: (id: string) => void;
  onAdd?: (next: Connection) => void;
  onChange?: (next: readonly Connection[]) => void;
  className?: string;
}

type EdgeKind = "reauth" | "error" | "testing";

interface EdgeState {
  kind: EdgeKind;
  id: string;
  /** Drives the StateTesting checks list. */
  checks?: readonly ConnectorCheck[];
}

const TESTING_CHECKS: readonly ConnectorCheck[] = [
  { id: "auth", label: "Auth", status: "pending" },
  { id: "scopes", label: "Scopes", status: "pending" },
  { id: "ping", label: "First event", status: "pending" },
];

export function ConnectionsManager({
  connections: initialConnections = connectionsSeed,
  backfillsByConnection = connectionBackfillsSeed,
  deliveriesByConnection = connectionDeliveriesSeed,
  eventSubsByConnection = connectionEventSubsSeed,
  initialView = "list",
  hideHeaderAdd,
  workspace = "Chronicle",
  onPause,
  onResume,
  onReauth,
  onTest,
  onDisconnect,
  onRotateSecret,
  onRunBackfill,
  onAdd,
  onChange,
  className,
}: ConnectionsManagerProps) {
  const [list, setList] = React.useState<Connection[]>(() => [
    ...initialConnections,
  ]);
  const [eventSubs, setEventSubs] = React.useState<
    Record<string, ConnectionEventTypeSub[]>
  >(() =>
    Object.fromEntries(
      Object.entries(eventSubsByConnection).map(([k, v]) => [k, [...v]]),
    ),
  );

  const [query, setQuery] = React.useState("");
  const [filters, setFilters] = React.useState<ConnectionHealth[]>([]);
  const [view, setView] = React.useState<ConnectionsView>(initialView);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [drawerTab, setDrawerTab] =
    React.useState<ConnectionDetailTab>("overview");
  const [addOpen, setAddOpen] = React.useState(false);
  const [edge, setEdge] = React.useState<EdgeState | null>(null);

  const propagate = React.useCallback(
    (next: Connection[]) => {
      setList(next);
      onChange?.(next);
    },
    [onChange],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((c) => {
      if (filters.length > 0 && !filters.includes(c.health)) return false;
      if (!q) return true;
      const src = getSource(c.source);
      const haystack = `${c.name} ${c.id} ${c.source} ${src?.cat ?? ""} ${src?.auth ?? ""}`;
      return haystack.toLowerCase().includes(q);
    });
  }, [list, query, filters]);

  const selected = React.useMemo(
    () => (selectedId ? list.find((c) => c.id === selectedId) ?? null : null),
    [selectedId, list],
  );

  const toggleHealth = (h: ConnectionHealth) => {
    setFilters((cur) =>
      cur.includes(h) ? cur.filter((x) => x !== h) : [...cur, h],
    );
  };

  const updateConn = (id: string, patch: Partial<Connection>) => {
    propagate(list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const handlePause = (id: string) => {
    updateConn(id, { health: "paused" });
    onPause?.(id);
  };
  const handleResume = (id: string) => {
    updateConn(id, { health: "live" });
    onResume?.(id);
  };
  const handleReauth = (id: string) => {
    setEdge({ kind: "reauth", id });
    onReauth?.(id);
  };
  const handleTest = (id: string) => {
    setEdge({ kind: "testing", id, checks: TESTING_CHECKS });
    onTest?.(id);
  };
  const handleDisconnect = (id: string) => {
    propagate(list.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(null);
    onDisconnect?.(id);
  };

  const handleOpenError = (id: string) => {
    setEdge({ kind: "error", id });
  };

  const handleRotateSecret = (id: string) => {
    onRotateSecret?.(id);
  };
  const handleRunBackfill = (id: string) => {
    onRunBackfill?.(id);
  };

  const handleConnected = ({
    id,
    source,
    name,
    scopes,
  }: {
    id: string;
    source: Connection["source"];
    name: string;
    scopes: string[];
    backfill: unknown;
  }) => {
    const next: Connection = {
      id,
      source,
      name,
      scopes,
      health: "live",
      connectedAt: new Date().toISOString(),
      lastEventAt: new Date().toISOString(),
      eventsLast24h: 0,
      spark: Array.from({ length: 24 }, () => 0),
    };
    propagate([next, ...list]);
    onAdd?.(next);
  };

  const showEmpty = list.length === 0;
  const showFilteredEmpty = !showEmpty && filtered.length === 0;

  const connectedSourceIds = React.useMemo(
    () => list.map((c) => c.source),
    [list],
  );

  const detailEvents = selected ? eventSubs[selected.id] ?? [] : [];

  const handleToggleScope = (scope: string, next: boolean) => {
    if (!selected) return;
    updateConn(selected.id, {
      scopes: next
        ? Array.from(new Set([...selected.scopes, scope]))
        : selected.scopes.filter((s) => s !== scope),
    });
  };

  const handleToggleEvent = (eventId: string, next: boolean) => {
    if (!selected) return;
    setEventSubs((prev) => ({
      ...prev,
      [selected.id]: (prev[selected.id] ?? []).map((e) =>
        e.id === eventId ? { ...e, enabled: next } : e,
      ),
    }));
  };

  return (
    <div
      className={cx(
        "flex min-h-[calc(100svh-var(--header-height)-2rem)] flex-col gap-5 bg-black p-4 text-ink",
        className,
      )}
    >
      <Header
        workspace={workspace}
        count={list.length}
        liveCount={list.filter((c) => c.health === "live").length}
        hideAdd={hideHeaderAdd}
        onAdd={() => setAddOpen(true)}
      />

      {showEmpty ? (
        <ConnectionEmpty onAdd={() => setAddOpen(true)} />
      ) : (
        <>
          <ConnectionsToolbar
            query={query}
            onQueryChange={setQuery}
            view={view}
            onViewChange={setView}
            selectedHealth={filters}
            onHealthToggle={toggleHealth}
            totalCount={list.length}
            onAdd={() => setAddOpen(true)}
          />

          {showFilteredEmpty ? (
            <ConnectionEmpty
              variant="filtered"
              onClearFilters={() => {
                setFilters([]);
                setQuery("");
              }}
            />
          ) : view === "list" ? (
            <div className="flex flex-col gap-2">
              {filtered.map((c) => (
                <ConnectionRow
                  key={c.id}
                  connection={c}
                  isActive={selectedId === c.id}
                  onOpen={(id) => {
                    setSelectedId(id);
                    setDrawerTab(c.health === "error" ? "activity" : "overview");
                  }}
                  onPause={handlePause}
                  onResume={handleResume}
                  onReauth={
                    c.health === "error"
                      ? () => handleOpenError(c.id)
                      : handleReauth
                  }
                  onTest={handleTest}
                  onSettings={(id) => {
                    setSelectedId(id);
                    setDrawerTab("scopes");
                  }}
                  onDisconnect={handleDisconnect}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((c) => (
                <ConnectionCard
                  key={c.id}
                  connection={c}
                  isActive={selectedId === c.id}
                  onOpen={(id) => {
                    setSelectedId(id);
                    setDrawerTab(c.health === "error" ? "activity" : "overview");
                  }}
                  onPause={handlePause}
                  onResume={handleResume}
                  onReauth={
                    c.health === "error"
                      ? () => handleOpenError(c.id)
                      : handleReauth
                  }
                  onTest={handleTest}
                  onSettings={(id) => {
                    setSelectedId(id);
                    setDrawerTab("scopes");
                  }}
                  onDisconnect={handleDisconnect}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Detail drawer */}
      {selected ? (
        <ConnectionDetailDrawer
          isOpen
          onClose={() => setSelectedId(null)}
          connection={selected}
          tab={drawerTab}
          onTabChange={setDrawerTab}
          backfills={backfillsByConnection[selected.id] ?? []}
          deliveries={deliveriesByConnection[selected.id] ?? []}
          events={detailEvents}
          onToggleScope={handleToggleScope}
          onToggleEvent={handleToggleEvent}
          onPause={() => handlePause(selected.id)}
          onResume={() => handleResume(selected.id)}
          onReauth={() =>
            selected.health === "error"
              ? handleOpenError(selected.id)
              : handleReauth(selected.id)
          }
          onTest={() => handleTest(selected.id)}
          onDisconnect={() => handleDisconnect(selected.id)}
          onRotateSecret={() => handleRotateSecret(selected.id)}
          onRunBackfill={() => handleRunBackfill(selected.id)}
        />
      ) : null}

      {/* Add picker */}
      <AddConnectionPicker
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        connectedIds={connectedSourceIds}
        onConnected={handleConnected}
      />

      {/* Edge-state modals */}
      {edge && edge.kind === "reauth" ? (
        <EdgeReauth
          id={edge.id}
          list={list}
          onClose={() => setEdge(null)}
          onConfirm={() => {
            updateConn(edge.id, { health: "live", expiresAt: undefined });
            setEdge(null);
          }}
        />
      ) : null}
      {edge && edge.kind === "error" ? (
        <EdgeError
          id={edge.id}
          list={list}
          onClose={() => setEdge(null)}
          onRetry={() => {
            updateConn(edge.id, { health: "live", errorKind: undefined });
            setEdge(null);
          }}
        />
      ) : null}
      {edge && edge.kind === "testing" ? (
        <EdgeTesting
          id={edge.id}
          list={list}
          checks={edge.checks ?? TESTING_CHECKS}
          onClose={() => setEdge(null)}
          onAdvance={(checks) => setEdge({ ...edge, checks })}
        />
      ) : null}
    </div>
  );
}

/* ── Header ──────────────────────────────────────────────── */

function Header({
  workspace,
  count,
  liveCount,
  hideAdd,
  onAdd,
}: {
  workspace: string;
  count: number;
  liveCount: number;
  hideAdd?: boolean;
  onAdd: () => void;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-divider pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
          <span>{workspace}</span>
          <span>/</span>
          <span className="text-ember">Connections</span>
        </div>
        <h1 className="font-display text-[28px] font-normal leading-none tracking-[-0.04em] text-ink-hi md:text-[34px]">
          Connections.
        </h1>
        <p className="mt-2 max-w-2xl text-[12.5px] leading-5 text-ink-dim">
          {count === 0
            ? "Authorize a source to start streaming events into Chronicle."
            : `${liveCount} of ${count} sources live · stream + backfill, per-source.`}
        </p>
      </div>
      {hideAdd ? null : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 rounded-[2px] border border-ember/35 bg-[rgba(216,67,10,0.06)] px-3 py-1.5 font-mono text-mono uppercase tracking-tactical text-ember transition-colors duration-fast hover:bg-[rgba(216,67,10,0.12)]"
          >
            + Add connection
          </button>
        </div>
      )}
    </header>
  );
}

/* ── Edge-state modal wrappers ───────────────────────────── */

function EdgeReauth({
  id,
  list,
  onClose,
  onConfirm,
}: {
  id: string;
  list: readonly Connection[];
  onClose: () => void;
  onConfirm: () => void;
}) {
  const conn = list.find((c) => c.id === id);
  const src = conn ? getSource(conn.source) : undefined;
  if (!src || !conn) {
    onClose();
    return null;
  }
  return (
    <StateReauth
      isOpen
      onClose={onClose}
      source={src}
      expiredAt={
        conn.expiresAt ? formatStableDateTime(conn.expiresAt) : "earlier today"
      }
      onReauth={onConfirm}
    />
  );
}

function EdgeError({
  id,
  list,
  onClose,
  onRetry,
}: {
  id: string;
  list: readonly Connection[];
  onClose: () => void;
  onRetry: () => void;
}) {
  const conn = list.find((c) => c.id === id);
  const src = conn ? getSource(conn.source) : undefined;
  if (!src || !conn) {
    onClose();
    return null;
  }
  return (
    <StateError
      isOpen
      onClose={onClose}
      source={src}
      kind={conn.errorKind ?? "unknown"}
      lastSeen={formatStableDateTime(conn.lastEventAt)}
      payload={conn.errorPayload}
      onRetry={onRetry}
    />
  );
}

function EdgeTesting({
  id,
  list,
  checks,
  onClose,
  onAdvance,
}: {
  id: string;
  list: readonly Connection[];
  checks: readonly ConnectorCheck[];
  onClose: () => void;
  onAdvance: (next: readonly ConnectorCheck[]) => void;
}) {
  const conn = list.find((c) => c.id === id);
  const src = conn ? getSource(conn.source) : undefined;

  React.useEffect(() => {
    const pendingIdx = checks.findIndex((c) => c.status === "pending");
    if (pendingIdx === -1) return;
    const t = window.setTimeout(() => {
      const next = checks.map((c, i) =>
        i === pendingIdx ? { ...c, status: "ok" as const } : c,
      );
      onAdvance(next);
    }, 800);
    return () => window.clearTimeout(t);
  }, [checks, onAdvance]);

  if (!src || !conn) {
    onClose();
    return null;
  }
  return (
    <StateTesting isOpen onClose={onClose} source={src} checks={checks} />
  );
}
