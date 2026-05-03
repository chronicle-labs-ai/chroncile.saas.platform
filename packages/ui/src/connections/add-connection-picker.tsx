"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";

import { cx } from "../utils/cx";
import { Modal } from "../primitives/modal";
import { Input } from "../primitives/input";
import { StatusDot } from "../primitives/status-dot";
import { CompanyLogo } from "../icons";
import {
  ConnectShared,
  ConnectStripe,
  ConnectSlack,
  ConnectHubSpot,
  ConnectReverseWebhook,
  ConnectWizard,
} from "../connectors";
import {
  SOURCES,
  getSource,
  type Source,
  type SourceCategory,
  type SourceId,
} from "../onboarding/data";
import { type BackfillRunConfig } from "../onboarding/step-connect";
import { type Connection } from "./data";

/*
 * AddConnectionPicker — modal that lists `SOURCES` so the user can
 * pick a new source to wire up. Mirrors the catalog pattern in
 * `onboarding/step-connect.tsx` (search + collapsible categories +
 * 2-col tile grid) but trimmed to a "pick one and dispatch" flow:
 * picking opens the right archetype modal, which on `onDone` reports
 * the new connection back via `onConnected`.
 *
 * Used by `ConnectionsManager` and the empty-state CTA.
 */

export interface AddConnectionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Source ids already wired up — rendered as "Connected" and disabled. */
  connectedIds?: readonly SourceId[];
  /** Override the catalog. Defaults to the full onboarding `SOURCES`. */
  sources?: readonly Source[];
  /**
   * Fired after the picker's archetype modal completes. Construct a
   * `Connection` row from the dispatched source + the optional backfill
   * config. Apps own persistence.
   */
  onConnected?: (
    next: Pick<Connection, "id" | "source" | "name" | "scopes"> & {
      backfill: BackfillRunConfig | null;
    },
  ) => void;
}

const CAT_ORDER: SourceCategory[] = [
  "Support",
  "Commerce",
  "Billing",
  "CRM",
  "Messaging",
  "Email",
  "Analytics",
  "Warehouse",
  "Database",
  "Stream",
  "Product",
  "Docs",
  "Custom",
];

export function AddConnectionPicker({
  isOpen,
  onClose,
  connectedIds = [],
  sources = SOURCES,
  onConnected,
}: AddConnectionPickerProps) {
  const [query, setQuery] = React.useState("");
  /*
   * Open the first two categories by default so first paint shows actual
   * source tiles instead of ~13 collapsed accordion rows. Later rounds of
   * filtering/searching let users open the rest.
   */
  const [openCats, setOpenCats] = React.useState<Set<SourceCategory>>(
    () => new Set(CAT_ORDER.slice(0, 2)),
  );
  const [picking, setPicking] = React.useState<SourceId | null>(null);
  const connected = new Set(connectedIds);

  const filtered = sources.filter(
    (s) =>
      !query ||
      `${s.name} ${s.cat} ${s.blurb}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const groups: Partial<Record<SourceCategory, Source[]>> = {};
  for (const s of filtered) {
    (groups[s.cat] = groups[s.cat] ?? []).push(s);
  }
  const orderedCats = [
    ...CAT_ORDER.filter((c) => groups[c]),
    ...(Object.keys(groups) as SourceCategory[]).filter(
      (c) => !CAT_ORDER.includes(c),
    ),
  ];

  React.useEffect(() => {
    if (!query) return;
    setOpenCats(new Set(orderedCats));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const toggleCat = (c: SourceCategory) => {
    setOpenCats((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  };

  const handleDone = (id: SourceId, bf: BackfillRunConfig | null) => {
    const src = getSource(id);
    if (!src) {
      setPicking(null);
      return;
    }
    onConnected?.({
      id: `conn_${id}_${Date.now().toString(36)}`,
      source: id,
      name: src.name,
      scopes: [],
      backfill: bf,
    });
    setPicking(null);
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen && picking == null}
        onClose={onClose}
        title="Add a connection"
        classNames={{ modal: "max-w-[640px]" }}
      >
        <div className="flex flex-col gap-3">
          <Input
            search
            placeholder={`Search ${sources.length} sources`}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />

          {orderedCats.length === 0 ? (
            <p className="py-6 text-center font-mono text-mono text-ink-dim">
              No sources match &ldquo;{query}&rdquo;.
            </p>
          ) : null}

          <div className="flex max-h-[60vh] flex-col gap-2 overflow-auto">
            {orderedCats.map((cat) => {
              const items = groups[cat] ?? [];
              const isOpen = openCats.has(cat) || !!query;
              return (
                <div key={cat} className="border-t border-divider py-2">
                  <button
                    type="button"
                    onClick={() => toggleCat(cat)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-2 py-[2px] text-left"
                  >
                    <ChevronRight
                      strokeWidth={1.75}
                      className={cx(
                        "size-3.5 shrink-0 text-ink-dim transition-transform duration-fast",
                        isOpen ? "rotate-90" : "rotate-0",
                      )}
                      aria-hidden
                    />
                    <span className="flex-1 font-sans text-[13.5px] text-ink-hi">
                      {cat}
                    </span>
                    <span className="font-mono text-mono-sm tabular-nums text-ink-dim">
                      {items.length}
                    </span>
                  </button>
                  {isOpen ? (
                    <div className="mt-2 grid grid-cols-2 gap-2 pl-5">
                      {items.map((s) => (
                        <SourceTile
                          key={s.id}
                          source={s}
                          alreadyConnected={connected.has(s.id)}
                          onPick={() => setPicking(s.id)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div className="border-t border-divider" />
          </div>
        </div>
      </Modal>

      {picking ? (
        <ConnectArchetype
          source={getSource(picking)!}
          onClose={() => setPicking(null)}
          onDone={handleDone}
        />
      ) : null}
    </>
  );
}

interface SourceTileProps {
  source: Source;
  alreadyConnected: boolean;
  onPick: () => void;
}

function SourceTile({ source, alreadyConnected, onPick }: SourceTileProps) {
  return (
    <button
      type="button"
      onClick={alreadyConnected ? undefined : onPick}
      disabled={alreadyConnected}
      className={cx(
        "flex min-w-0 items-center gap-2 rounded-[2px] border px-3 py-2 text-left transition-colors duration-fast",
        alreadyConnected
          ? "cursor-not-allowed border-divider bg-[rgba(255,255,255,0.012)] opacity-60"
          : "border-divider bg-[rgba(255,255,255,0.012)] hover:border-ember/35 hover:bg-[rgba(216,67,10,0.04)]",
      )}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-hairline bg-surface-02"
        aria-hidden
      >
        <CompanyLogo
          name={source.name}
          size={14}
          radius={3}
          fallbackBackground="var(--c-surface-02)"
          fallbackColor="var(--c-ink-dim)"
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
        <div className="flex items-center gap-2">
          <span className="truncate font-sans text-[13px] text-ink-hi">
            {source.name}
          </span>
          {alreadyConnected ? (
            <span className="inline-flex items-center gap-[6px] font-mono text-mono-sm uppercase tracking-tactical text-event-green">
              <StatusDot variant="green" />
              connected
            </span>
          ) : null}
        </div>
        <span className="truncate font-mono text-mono-sm text-ink-dim">
          {source.blurb}
        </span>
      </div>
    </button>
  );
}

/* ── Archetype dispatcher ─────────────────────────────────── */

interface ConnectArchetypeProps {
  source: Source;
  onClose: () => void;
  onDone: (id: SourceId, bf: BackfillRunConfig | null) => void;
}

/**
 * Mirrors the dispatch table inside `onboarding/step-connect.tsx`.
 * Anything that isn't matched falls back to `ConnectShared`.
 */
function ConnectArchetype({ source, onClose, onDone }: ConnectArchetypeProps) {
  switch (source.id) {
    case "stripe":
      return (
        <ConnectStripe source={source} onClose={onClose} onDone={onDone} />
      );
    case "slack":
      return <ConnectSlack source={source} onClose={onClose} onDone={onDone} />;
    case "hubspot":
      return (
        <ConnectHubSpot source={source} onClose={onClose} onDone={onDone} />
      );
    case "salesforce":
      return (
        <ConnectWizard source={source} onClose={onClose} onDone={onDone} />
      );
    case "webhooks":
    case "http":
      return (
        <ConnectReverseWebhook
          source={source}
          onClose={onClose}
          onDone={onDone}
        />
      );
    default:
      return (
        <ConnectShared source={source} onClose={onClose} onDone={onDone} />
      );
  }
}
