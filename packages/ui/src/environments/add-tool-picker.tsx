"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";

import { CompanyLogo } from "../icons";
import { Chip } from "../primitives/chip";
import { Input } from "../primitives/input";
import { Modal } from "../primitives/modal";
import { StatusDot } from "../primitives/status-dot";
import { cx } from "../utils/cx";

import { ENVIRONMENT_TOOL_CATALOG } from "./data";
import type {
  EnvironmentTool,
  EnvironmentToolCategory,
  EnvironmentToolKind,
  EnvironmentToolTemplate,
} from "./types";

/*
 * AddToolPicker — modal that lists `ENVIRONMENT_TOOL_CATALOG` so the
 * user can attach a tool runtime to the current sandbox.
 *
 * Visual rhythm mirrors `connections/add-connection-picker.tsx`:
 * search + kind filter chips + collapsible categories + 2-col tile
 * grid. The picker is read-only logic — it never mutates state itself,
 * just dispatches `onPick(template)` and lets the parent persist.
 */

const CAT_ORDER: EnvironmentToolCategory[] = [
  "Billing",
  "Messaging",
  "CRM",
  "Database",
  "Filesystem",
  "Identity",
  "Storage",
  "Compute",
  "Custom",
];

const KIND_FILTERS: readonly { id: EnvironmentToolKind; label: string }[] = [
  { id: "mcp", label: "MCP" },
  { id: "cli", label: "CLI" },
  { id: "api", label: "API" },
  { id: "database", label: "Database" },
  { id: "filesystem", label: "Filesystem" },
];

export interface AddToolPickerProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Templates already attached to the current sandbox. Tiles for these
   * are dimmed with an "attached" badge but remain pickable so users
   * can spin up multiple instances of the same runtime.
   */
  attachedTemplateIds?: readonly string[];
  /**
   * Existing tool rows on the sandbox. Used to detect attached state
   * via `(source, kind)` pairs when the original template id isn't
   * stored on the tool.
   */
  attachedTools?: readonly EnvironmentTool[];
  /** Override the catalog. Defaults to the full `ENVIRONMENT_TOOL_CATALOG`. */
  templates?: readonly EnvironmentToolTemplate[];
  /** Fired when the user picks a tile. */
  onPick: (template: EnvironmentToolTemplate) => void;
}

export function AddToolPicker({
  isOpen,
  onClose,
  attachedTemplateIds = [],
  attachedTools = [],
  templates = ENVIRONMENT_TOOL_CATALOG,
  onPick,
}: AddToolPickerProps) {
  const [query, setQuery] = React.useState("");
  const [kindFilter, setKindFilter] = React.useState<Set<EnvironmentToolKind>>(
    () => new Set()
  );
  const [openCats, setOpenCats] = React.useState<Set<EnvironmentToolCategory>>(
    () => new Set(CAT_ORDER.slice(0, 3))
  );

  React.useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setKindFilter(new Set());
    }
  }, [isOpen]);

  const attachedSet = React.useMemo(
    () => new Set(attachedTemplateIds),
    [attachedTemplateIds]
  );
  const attachedSourceKindSet = React.useMemo(
    () => new Set(attachedTools.map((tool) => `${tool.source}:${tool.kind}`)),
    [attachedTools]
  );

  const isTemplateAttached = React.useCallback(
    (template: EnvironmentToolTemplate) =>
      attachedSet.has(template.id) ||
      attachedSourceKindSet.has(`${template.source}:${template.kind}`),
    [attachedSet, attachedSourceKindSet]
  );

  const kindCounts = React.useMemo(() => {
    const out: Record<EnvironmentToolKind, number> = {
      mcp: 0,
      cli: 0,
      api: 0,
      database: 0,
      filesystem: 0,
    };
    for (const t of templates) out[t.kind] = (out[t.kind] ?? 0) + 1;
    return out;
  }, [templates]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t) => {
      if (kindFilter.size > 0 && !kindFilter.has(t.kind)) return false;
      if (!q) return true;
      return [t.name, t.source, t.kind, t.category, t.description, ...t.capabilities]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [templates, query, kindFilter]);

  const groups = React.useMemo(() => {
    const out: Partial<Record<EnvironmentToolCategory, EnvironmentToolTemplate[]>> =
      {};
    for (const t of filtered) {
      (out[t.category] = out[t.category] ?? []).push(t);
    }
    return out;
  }, [filtered]);

  const orderedCats = React.useMemo(() => {
    const inOrder = CAT_ORDER.filter((c) => groups[c]);
    const rest = (Object.keys(groups) as EnvironmentToolCategory[]).filter(
      (c) => !CAT_ORDER.includes(c)
    );
    return [...inOrder, ...rest];
  }, [groups]);

  React.useEffect(() => {
    if (!query && kindFilter.size === 0) return;
    setOpenCats(new Set(orderedCats));
  }, [query, kindFilter, orderedCats]);

  const toggleCat = (c: EnvironmentToolCategory) => {
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const toggleKind = (kind: EnvironmentToolKind) => {
    setKindFilter((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const handlePick = (template: EnvironmentToolTemplate) => {
    onPick(template);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add a tool"
      classNames={{ modal: "max-w-[640px]" }}
    >
      <div className="flex flex-col gap-3">
        <Input
          search
          placeholder={`Search ${templates.length} tool runtimes`}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
            Kind
          </span>
          {KIND_FILTERS.map((k) => {
            const active = kindFilter.has(k.id);
            return (
              <Chip
                key={k.id}
                active={active}
                onClick={() => toggleKind(k.id)}
                count={kindCounts[k.id] ?? 0}
                aria-pressed={active}
              >
                {k.label}
              </Chip>
            );
          })}
          {kindFilter.size > 0 ? (
            <button
              type="button"
              onClick={() => setKindFilter(new Set())}
              className="ml-1 font-mono text-mono-sm text-ember hover:underline"
            >
              Clear
            </button>
          ) : null}
        </div>

        {orderedCats.length === 0 ? (
          <p className="py-6 text-center font-mono text-mono-sm text-ink-dim">
            No tools match{query ? ` "${query}"` : ""}
            {kindFilter.size > 0
              ? ` in ${[...kindFilter].join(", ")}`
              : ""}
            .
          </p>
        ) : null}

        <div className="flex max-h-[60vh] flex-col gap-2 overflow-auto">
          {orderedCats.map((cat) => {
            const items = groups[cat] ?? [];
            const open = openCats.has(cat) || Boolean(query);
            return (
              <div key={cat} className="border-t border-divider py-2">
                <button
                  type="button"
                  onClick={() => toggleCat(cat)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-2 py-[2px] text-left"
                >
                  <ChevronRight
                    strokeWidth={1.75}
                    className={cx(
                      "size-3.5 shrink-0 text-ink-dim transition-transform duration-fast",
                      open ? "rotate-90" : "rotate-0"
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
                {open ? (
                  <div className="mt-2 grid grid-cols-2 gap-2 pl-5">
                    {items.map((t) => (
                      <ToolTile
                        key={t.id}
                        template={t}
                        attached={isTemplateAttached(t)}
                        onPick={() => handlePick(t)}
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
  );
}

const KIND_LABEL: Record<EnvironmentToolKind, string> = {
  mcp: "MCP server",
  cli: "CLI",
  api: "API shim",
  database: "Database",
  filesystem: "Filesystem",
};

interface ToolTileProps {
  template: EnvironmentToolTemplate;
  attached: boolean;
  onPick: () => void;
}

function ToolTile({ template, attached, onPick }: ToolTileProps) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`Add ${template.name}${attached ? " (already attached)" : ""}`}
      className={cx(
        "flex min-w-0 items-center gap-2 rounded-[2px] border px-3 py-2 text-left outline-none transition-colors duration-fast",
        "focus-visible:ring-1 focus-visible:ring-ember focus-visible:ring-offset-1 focus-visible:ring-offset-page",
        attached
          ? "border-divider bg-wash-micro hover:border-event-green/35 hover:bg-[rgba(74,222,128,0.04)]"
          : "border-divider bg-wash-micro hover:border-ember/35 hover:bg-row-active"
      )}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-hairline bg-surface-02"
        aria-hidden
      >
        <CompanyLogo
          name={template.source}
          size={14}
          radius={3}
          fallbackBackground="var(--c-surface-02)"
          fallbackColor="var(--c-ink-dim)"
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
        <div className="flex items-center gap-2">
          <span className="truncate font-sans text-[13px] text-ink-hi">
            {template.name}
          </span>
          <span className="rounded-full bg-l-wash-3 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.06em] text-l-ink-dim">
            {KIND_LABEL[template.kind]}
          </span>
          {attached ? (
            <span className="inline-flex items-center gap-[6px] font-mono text-mono-sm uppercase tracking-tactical text-event-green">
              <StatusDot variant="green" />
              attached
            </span>
          ) : null}
        </div>
        <span className="truncate font-mono text-mono-sm text-ink-dim">
          {template.description}
        </span>
      </div>
    </button>
  );
}
