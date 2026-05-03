"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { ConfirmModal } from "../primitives/modal";
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
  CONNECTION_HEALTH_FILTERS,
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
 *
 * Mutation contracts: `onPause` / `onResume` / `onDisconnect` /
 * `onTest` / `onReauth` / `onRotateSecret` / `onRunBackfill` may
 * return a `Promise`. The manager wraps each call in a pending
 * state, swaps the action button to a spinner, and emits a sonner
 * toast on success or failure. Consumers that rely on synchronous
 * updates (stories, Storybook) can keep returning `void` — the
 * pending state still flips, just instantly.
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
  /**
   * Show a redundant "Add" CTA in the page header. Defaults to
   * `false` — the toolbar already has its own primary, and the empty
   * state has its own dedicated CTA. Two stacked primaries on the
   * same surface violates Emil's single-CTA-per-context rule.
   */
  showHeaderAdd?: boolean;
  /**
   * Backwards-compat alias for the inverse of `showHeaderAdd`. The
   * old default rendered both CTAs; flip this if any existing
   * consumer overrides the header.
   * @deprecated Use `showHeaderAdd` instead.
   */
  hideHeaderAdd?: boolean;
  /** Optional workspace label rendered in the breadcrumb. */
  workspace?: string;
  /**
   * Builder for the canonical detail-page URL. Wired so cmd-click
   * on a row opens the page in a new tab and the drawer's "View
   * full details" link is accurate. Defaults to
   * `/dashboard/connections/{id}`.
   */
  detailHrefBuilder?: (id: string) => string;

  /* mutation hooks — let apps persist outside the local store */
  onPause?: (id: string) => void | Promise<void>;
  onResume?: (id: string) => void | Promise<void>;
  onReauth?: (id: string) => void | Promise<void>;
  onTest?: (id: string) => void | Promise<void>;
  onDisconnect?: (id: string) => void | Promise<void>;
  onRotateSecret?: (id: string) => void | Promise<void>;
  onRunBackfill?: (id: string) => void | Promise<void>;
  onAdd?: (next: Connection) => void;
  onChange?: (next: readonly Connection[]) => void;
  /** Optional callback for the Activity tab's "Open full activity log" link. */
  onOpenActivityLog?: (id: string) => void;
  /**
   * Live updates from a server-side SSE stream. When provided, the
   * manager subscribes via the consumer-supplied function and merges
   * each incoming patch into the matching connection row by id.
   * Returning a cleanup is the conventional shape — the manager calls
   * it on unmount or when the dep changes.
   *
   * Example wire-up in `apps/frontend`:
   *
   *   subscribeUpdates={(onPatch) =>
   *     subscribeEventsManagerSSE("connections", (msg) => {
   *       onPatch({ id: msg.id, lastEventAt: msg.ts, eventsLast24h: msg.count })
   *     })
   *   }
   */
  subscribeUpdates?: (
    onPatch: (patch: Partial<Connection> & { id: string }) => void,
  ) => () => void;
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

const DEFAULT_DETAIL_HREF = (id: string) => `/dashboard/connections/${id}`;

export function ConnectionsManager({
  connections: initialConnections = connectionsSeed,
  backfillsByConnection = connectionBackfillsSeed,
  deliveriesByConnection = connectionDeliveriesSeed,
  eventSubsByConnection = connectionEventSubsSeed,
  initialView = "list",
  showHeaderAdd,
  hideHeaderAdd,
  workspace = "Chronicle",
  detailHrefBuilder = DEFAULT_DETAIL_HREF,
  onPause,
  onResume,
  onReauth,
  onTest,
  onDisconnect,
  onRotateSecret,
  onRunBackfill,
  onAdd,
  onChange,
  onOpenActivityLog,
  subscribeUpdates,
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
  /*
   * Disconnect is destructive (events buffer upstream until reconnect).
   * We always route through `ConfirmModal` instead of triggering on the
   * first click — Emil rule: destructive actions require confirmation.
   */
  const [confirmDisconnect, setConfirmDisconnect] = React.useState<
    string | null
  >(null);

  const propagate = React.useCallback(
    (next: Connection[]) => {
      setList(next);
      onChange?.(next);
    },
    [onChange],
  );

  /*
   * Per-id × action pending bookkeeping. Lets the action menu, the
   * row's button, and the drawer all reflect the same in-flight
   * mutation without a separate Reducer. `kind` lets us distinguish
   * "pause in flight" from "test in flight" so we don't over-disable.
   */
  type PendingKind =
    | "pause"
    | "resume"
    | "reauth"
    | "test"
    | "disconnect"
    | "rotate"
    | "backfill";
  const [pending, setPending] = React.useState<Record<string, PendingKind[]>>(
    {},
  );

  const isPending = React.useCallback(
    (id: string, kind?: PendingKind) =>
      pending[id]?.some((k) => !kind || k === kind) ?? false,
    [pending],
  );

  const startPending = React.useCallback(
    (id: string, kind: PendingKind) => {
      setPending((prev) => {
        const cur = prev[id] ?? [];
        if (cur.includes(kind)) return prev;
        return { ...prev, [id]: [...cur, kind] };
      });
    },
    [],
  );
  const endPending = React.useCallback((id: string, kind: PendingKind) => {
    setPending((prev) => {
      const cur = prev[id] ?? [];
      const next = cur.filter((k) => k !== kind);
      if (next.length === 0) {
        const { [id]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  }, []);

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

  const healthCounts = React.useMemo(() => {
    const out: Partial<Record<ConnectionHealth, number>> = {};
    for (const h of CONNECTION_HEALTH_FILTERS) out[h] = 0;
    for (const c of list) {
      out[c.health] = (out[c.health] ?? 0) + 1;
    }
    return out;
  }, [list]);

  const selected = React.useMemo(
    () => (selectedId ? list.find((c) => c.id === selectedId) ?? null : null),
    [selectedId, list],
  );

  const toggleHealth = (h: ConnectionHealth) => {
    setFilters((cur) =>
      cur.includes(h) ? cur.filter((x) => x !== h) : [...cur, h],
    );
  };

  const updateConn = React.useCallback(
    (id: string, patch: Partial<Connection>) => {
      setList((prev) => {
        const next = prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
        onChange?.(next);
        return next;
      });
    },
    [onChange],
  );

  /*
   * Subscribe to live updates if the host wired it up. Each patch is
   * merged into the matching row; rows that don't exist locally are
   * ignored (the SSE feed may be wider than the visible filter).
   */
  React.useEffect(() => {
    if (!subscribeUpdates) return;
    const unsub = subscribeUpdates((patch) => {
      if (!patch?.id) return;
      const { id, ...rest } = patch;
      updateConn(id, rest);
    });
    return unsub;
  }, [subscribeUpdates, updateConn]);

  /*
   * Generic optimistic-runner. Applies the optimistic patch, calls
   * `cb`, awaits the result if it's a promise, and on rejection
   * rolls the patch back and shows an error toast. Each mutation
   * passes its own `kind` so multiple concurrent mutations on the
   * same id don't trample each other's pending flags.
   */
  const runMutation = React.useCallback(
    async <T,>(opts: {
      id: string;
      kind: PendingKind;
      optimistic?: Partial<Connection>;
      rollback?: Partial<Connection>;
      successTitle?: string;
      errorTitle: string;
      cb?: (id: string) => T | Promise<T>;
    }): Promise<{ ok: boolean; error?: unknown }> => {
      const { id, kind, optimistic, rollback, successTitle, errorTitle, cb } =
        opts;
      startPending(id, kind);
      if (optimistic) updateConn(id, optimistic);
      try {
        await Promise.resolve(cb?.(id));
        if (successTitle) toast.success(successTitle);
        return { ok: true };
      } catch (error) {
        if (rollback) updateConn(id, rollback);
        toast.error(errorTitle, {
          description:
            error instanceof Error
              ? error.message
              : "The action didn't complete. Try again.",
        });
        return { ok: false, error };
      } finally {
        endPending(id, kind);
      }
    },
    [endPending, startPending, updateConn],
  );

  const handlePause = React.useCallback(
    (id: string) => {
      const conn = list.find((c) => c.id === id);
      void runMutation({
        id,
        kind: "pause",
        optimistic: { health: "paused" },
        rollback: conn ? { health: conn.health } : undefined,
        successTitle: `${conn?.name ?? "Connection"} paused`,
        errorTitle: "Couldn't pause connection",
        cb: onPause,
      });
    },
    [list, onPause, runMutation],
  );
  const handleResume = React.useCallback(
    (id: string) => {
      const conn = list.find((c) => c.id === id);
      void runMutation({
        id,
        kind: "resume",
        optimistic: { health: "live" },
        rollback: conn ? { health: conn.health } : undefined,
        successTitle: `${conn?.name ?? "Connection"} resumed`,
        errorTitle: "Couldn't resume connection",
        cb: onResume,
      });
    },
    [list, onResume, runMutation],
  );
  const handleReauth = React.useCallback(
    (id: string) => {
      setEdge({ kind: "reauth", id });
      onReauth?.(id);
    },
    [onReauth],
  );
  const handleTest = React.useCallback(
    (id: string) => {
      setEdge({ kind: "testing", id, checks: TESTING_CHECKS });
      updateConn(id, { lastTestStatus: "pending" });
      onTest?.(id);
    },
    [onTest, updateConn],
  );
  const requestDisconnect = (id: string) => {
    setConfirmDisconnect(id);
  };
  const handleDisconnect = React.useCallback(
    (id: string) => {
      const conn = list.find((c) => c.id === id);
      void runMutation({
        id,
        kind: "disconnect",
        successTitle: `${conn?.name ?? "Connection"} disconnected`,
        errorTitle: "Couldn't disconnect",
        cb: async (innerId) => {
          await Promise.resolve(onDisconnect?.(innerId));
          // Remove the row only after the mutation resolves so a
          // failed call doesn't surprise users with disappearing
          // rows that pop back. The error-path rollback handles
          // any optimistic patch we'd attached.
          setList((prev) => prev.filter((c) => c.id !== innerId));
          if (selectedId === innerId) setSelectedId(null);
        },
      });
    },
    [list, onDisconnect, runMutation, selectedId],
  );
  const confirmConn = confirmDisconnect
    ? list.find((c) => c.id === confirmDisconnect) ?? null
    : null;

  const handleOpenError = (id: string) => {
    setEdge({ kind: "error", id });
  };

  const handleRotateSecret = React.useCallback(
    (id: string) => {
      const conn = list.find((c) => c.id === id);
      void runMutation({
        id,
        kind: "rotate",
        successTitle: `Secret rotated for ${conn?.name ?? "connection"}`,
        errorTitle: "Couldn't rotate secret",
        cb: onRotateSecret,
      });
    },
    [list, onRotateSecret, runMutation],
  );
  const handleRunBackfill = React.useCallback(
    (id: string) => {
      const conn = list.find((c) => c.id === id);
      void runMutation({
        id,
        kind: "backfill",
        successTitle: `Backfill started for ${conn?.name ?? "connection"}`,
        errorTitle: "Couldn't start backfill",
        cb: onRunBackfill,
      });
    },
    [list, onRunBackfill, runMutation],
  );

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
    toast.success(`${name} connected`, {
      description: "Streaming live and historical events into Chronicle.",
    });
  };

  const showEmpty = list.length === 0;
  const showFilteredEmpty = !showEmpty && filtered.length === 0;
  const totalHidden = list.length - filtered.length;

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

  const handleOpenExisting = React.useCallback(
    (sourceId: Connection["source"]) => {
      const match = list.find((c) => c.source === sourceId);
      if (!match) return;
      setSelectedId(match.id);
      setDrawerTab(match.health === "error" ? "activity" : "overview");
    },
    [list],
  );

  const headerAddVisible =
    showHeaderAdd ?? (hideHeaderAdd === undefined ? false : !hideHeaderAdd);

  const buildDetailHref = React.useCallback(
    (id: string) => detailHrefBuilder(id),
    [detailHrefBuilder],
  );

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
        showAdd={headerAddVisible}
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
            healthCounts={healthCounts}
            onAdd={() => setAddOpen(true)}
          />

          {showFilteredEmpty ? (
            <ConnectionEmpty
              variant="filtered"
              totalHidden={totalHidden}
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
                  href={buildDetailHref(c.id)}
                  isActive={selectedId === c.id}
                  onOpen={(id) => {
                    setSelectedId(id);
                    setDrawerTab(c.health === "error" ? "activity" : "overview");
                  }}
                  onPause={isPending(c.id, "pause") ? undefined : handlePause}
                  onResume={
                    isPending(c.id, "resume") ? undefined : handleResume
                  }
                  onReauth={
                    c.health === "error"
                      ? () => handleOpenError(c.id)
                      : handleReauth
                  }
                  onTest={isPending(c.id, "test") ? undefined : handleTest}
                  onSettings={(id) => {
                    setSelectedId(id);
                    setDrawerTab("scopes");
                  }}
                  onDisconnect={requestDisconnect}
                  onOpenInNewTab={(id) => {
                    if (typeof window !== "undefined") {
                      window.open(buildDetailHref(id), "_blank", "noopener");
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((c) => (
                <ConnectionCard
                  key={c.id}
                  connection={c}
                  href={buildDetailHref(c.id)}
                  isActive={selectedId === c.id}
                  onOpen={(id) => {
                    setSelectedId(id);
                    setDrawerTab(c.health === "error" ? "activity" : "overview");
                  }}
                  onPause={isPending(c.id, "pause") ? undefined : handlePause}
                  onResume={
                    isPending(c.id, "resume") ? undefined : handleResume
                  }
                  onReauth={
                    c.health === "error"
                      ? () => handleOpenError(c.id)
                      : handleReauth
                  }
                  onTest={isPending(c.id, "test") ? undefined : handleTest}
                  onSettings={(id) => {
                    setSelectedId(id);
                    setDrawerTab("scopes");
                  }}
                  onDisconnect={requestDisconnect}
                  onOpenInNewTab={(id) => {
                    if (typeof window !== "undefined") {
                      window.open(buildDetailHref(id), "_blank", "noopener");
                    }
                  }}
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
          detailHref={buildDetailHref(selected.id)}
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
          onDisconnect={() => requestDisconnect(selected.id)}
          onRotateSecret={() => handleRotateSecret(selected.id)}
          onRunBackfill={() => handleRunBackfill(selected.id)}
          onOpenActivityLog={
            onOpenActivityLog
              ? () => onOpenActivityLog(selected.id)
              : undefined
          }
        />
      ) : null}

      {/* Destructive confirm */}
      <ConfirmModal
        isOpen={!!confirmConn}
        onClose={() => setConfirmDisconnect(null)}
        onConfirm={() => {
          if (confirmConn) handleDisconnect(confirmConn.id);
          setConfirmDisconnect(null);
        }}
        title={
          confirmConn
            ? `Disconnect ${confirmConn.name}?`
            : "Disconnect connection?"
        }
        message={
          confirmConn
            ? `New events from ${getSource(confirmConn.source)?.name ?? confirmConn.name} will buffer upstream until you reconnect. Existing scopes (${confirmConn.scopes.length}) will be revoked. You'll need to re-authorize from scratch to reconnect.`
            : ""
        }
        confirmText="Disconnect"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Add picker */}
      <AddConnectionPicker
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        connectedIds={connectedSourceIds}
        onConnected={handleConnected}
        onOpenExisting={(sourceId) => {
          handleOpenExisting(sourceId);
        }}
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
            const conn = list.find((c) => c.id === edge.id);
            toast.success(`Re-authorized ${conn?.name ?? "connection"}`);
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
            const conn = list.find((c) => c.id === edge.id);
            toast.success(`Recovered ${conn?.name ?? "connection"}`);
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
          onComplete={(allOk) => {
            updateConn(edge.id, {
              lastTestedAt: new Date().toISOString(),
              lastTestStatus: allOk ? "ok" : "fail",
            });
          }}
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
  showAdd,
  onAdd,
}: {
  workspace: string;
  count: number;
  liveCount: number;
  showAdd?: boolean;
  onAdd: () => void;
}) {
  const subline =
    count === 0
      ? "Authorize a source to start streaming events into Chronicle."
      : `${count} ${count === 1 ? "source" : "sources"} connected · ${liveCount} streaming live`;
  return (
    <header className="flex flex-col gap-3 border-b border-divider pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
          <span>{workspace}</span>
          <span aria-hidden>/</span>
          <span className="text-ember">Connections</span>
        </div>
        <h1 className="font-display text-[28px] font-normal leading-none tracking-[-0.04em] text-ink-hi md:text-[34px]">
          Connections.
        </h1>
        <p className="mt-2 max-w-2xl font-mono text-mono-sm tabular-nums text-ink-dim">
          {subline}
        </p>
      </div>
      {showAdd ? (
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onPress={onAdd}
            leadingIcon={<Plus className="size-3.5" strokeWidth={1.75} />}
          >
            Add connection
          </Button>
        </div>
      ) : null}
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
        conn.expiresAt
          ? formatStableDateTime(conn.expiresAt)
          : "an earlier session"
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
  onComplete,
}: {
  id: string;
  list: readonly Connection[];
  checks: readonly ConnectorCheck[];
  onClose: () => void;
  onAdvance: (next: readonly ConnectorCheck[]) => void;
  onComplete: (allOk: boolean) => void;
}) {
  const conn = list.find((c) => c.id === id);
  const src = conn ? getSource(conn.source) : undefined;

  React.useEffect(() => {
    const pendingIdx = checks.findIndex((c) => c.status === "pending");
    if (pendingIdx === -1) {
      const allOk = checks.every((c) => c.status === "ok");
      onComplete(allOk);
      return;
    }
    const t = window.setTimeout(() => {
      const next = checks.map((c, i) =>
        i === pendingIdx ? { ...c, status: "ok" as const } : c,
      );
      onAdvance(next);
    }, 800);
    return () => window.clearTimeout(t);
  }, [checks, onAdvance, onComplete]);

  if (!src || !conn) {
    onClose();
    return null;
  }
  return (
    <StateTesting isOpen onClose={onClose} source={src} checks={checks} />
  );
}
