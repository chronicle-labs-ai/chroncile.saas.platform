"use client";

import { useState, useCallback, useMemo } from "react";
import type {
  SandboxNode,
  SandboxNodeData,
  EventSourceNodeData,
  FilterNodeData,
  OutputNodeData,
  GeneratorNodeData,
  FilterRule,
} from "../types";
import type { OutputType, FileFormat } from "../types";
import {
  NODE_COLORS,
  PROVIDER_CATALOG,
  PROVIDER_IDS,
  ACTOR_TYPES,
  DATE_RANGE_PRESETS,
  OUTPUT_TYPES,
  OUTPUT_TEMPLATE_PRESETS,
  OUTPUT_FIELDS,
  RATE_PRESETS,
  buildStreamUrl,
  buildFileUrl,
  buildConsoleUrl,
} from "../constants";

/* ------------------------------------------------------------------ */
/*  Drawer shell                                                       */
/* ------------------------------------------------------------------ */

interface NodeConfigDrawerProps {
  node: SandboxNode;
  onClose: () => void;
  onUpdate: (data: SandboxNodeData) => void;
  sandboxId: string;
  tenantId: string;
}

export function NodeConfigDrawer({
  node,
  onClose,
  onUpdate,
  sandboxId,
  tenantId,
}: NodeConfigDrawerProps) {
  const data = node.data as SandboxNodeData;
  const colors = NODE_COLORS[data.nodeType];

  return (
    <div
      className="w-80 shrink-0 bg-surface border-l border-border-dim flex flex-col overflow-hidden"
      style={{ animation: "slideInRight 150ms ease-out" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{
          background: colors.bg,
          borderBottom: `1px solid ${colors.dim}`,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: colors.accent,
              boxShadow: `0 0 6px ${colors.accent}`,
            }}
          />
          <span
            className="font-mono text-[10px] font-medium tracking-wider uppercase"
            style={{ color: colors.accent }}
          >
            {colors.label} Config
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-tertiary hover:text-primary transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Label edit */}
      <div className="px-4 py-3 border-b border-border-dim">
        <label className={labelCls}>Label</label>
        <input
          type="text"
          value={data.label}
          onChange={(e) => onUpdate({ ...data, label: e.target.value })}
          className={inputCls}
        />
      </div>

      {/* Type-specific config */}
      <div className="flex-1 overflow-y-auto">
        {data.nodeType === "event-source" && (
          <EventSourceForm data={data} onUpdate={onUpdate} />
        )}
        {data.nodeType === "filter" && (
          <FilterForm data={data} onUpdate={onUpdate} />
        )}
        {data.nodeType === "output" && (
          <OutputForm data={data} onUpdate={onUpdate} nodeId={node.id} sandboxId={sandboxId} tenantId={tenantId} />
        )}
        {data.nodeType === "generator" && (
          <GeneratorForm data={data} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared styles                                                      */
/* ------------------------------------------------------------------ */

const inputCls =
  "w-full px-2.5 py-1.5 bg-base border border-border-default rounded text-xs text-primary font-mono focus:outline-none focus:border-data transition-colors";
const labelCls =
  "block text-[10px] font-medium tracking-wider text-tertiary uppercase mb-1.5";
const sectionCls = "px-4 py-3 border-b border-border-dim space-y-3";
const pillActiveCls =
  "px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-all border cursor-pointer";

/* ------------------------------------------------------------------ */
/*  Reusable: Provider multi-select grid                               */
/* ------------------------------------------------------------------ */

function ProviderGrid({
  selected,
  onChange,
  accent,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
  accent?: string;
}) {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  };

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {PROVIDER_IDS.map((id) => {
        const p = PROVIDER_CATALOG[id];
        const active = selected.includes(id);
        return (
          <button
            key={id}
            onClick={() => toggle(id)}
            className={`flex items-center gap-2 px-2.5 py-2 rounded border text-left transition-all ${
              active
                ? "bg-base border-border-bright"
                : "bg-transparent border-border-dim hover:border-border-default opacity-50 hover:opacity-80"
            }`}
          >
            <div
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{
                background: active ? p.color : "transparent",
                border: `1.5px solid ${p.color}`,
                boxShadow: active ? `0 0 6px ${p.color}40` : "none",
              }}
            />
            <span
              className="font-mono text-[10px] truncate"
              style={{ color: active ? (accent ?? p.color) : undefined }}
            >
              {p.label}
            </span>
            {active && (
              <svg
                className="w-3 h-3 ml-auto shrink-0"
                fill="none"
                stroke={accent ?? p.color}
                viewBox="0 0 24 24"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable: Grouped event type checkboxes                            */
/* ------------------------------------------------------------------ */

function EventTypeSelector({
  selectedProviders,
  selectedTypes,
  onChange,
  accent,
}: {
  selectedProviders: string[];
  selectedTypes: string[];
  onChange: (v: string[]) => void;
  accent?: string;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const providers = selectedProviders.length > 0 ? selectedProviders : PROVIDER_IDS;

  const toggleType = (t: string) => {
    onChange(
      selectedTypes.includes(t)
        ? selectedTypes.filter((s) => s !== t)
        : [...selectedTypes, t]
    );
  };

  const toggleAll = (providerId: string) => {
    const types = PROVIDER_CATALOG[providerId].eventTypes;
    const allSelected = types.every((t) => selectedTypes.includes(t));
    if (allSelected) {
      onChange(selectedTypes.filter((t) => !types.includes(t)));
    } else {
      const newTypes = [...selectedTypes];
      for (const t of types) {
        if (!newTypes.includes(t)) newTypes.push(t);
      }
      onChange(newTypes);
    }
  };

  if (providers.length === 0) {
    return (
      <p className="text-[10px] text-tertiary italic">
        Select sources above to see event types
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {providers.map((id) => {
        const p = PROVIDER_CATALOG[id];
        if (!p) return null;
        const isCollapsed = collapsed[id];
        const allSelected = p.eventTypes.every((t) =>
          selectedTypes.includes(t)
        );
        const someSelected = p.eventTypes.some((t) =>
          selectedTypes.includes(t)
        );
        const count = p.eventTypes.filter((t) =>
          selectedTypes.includes(t)
        ).length;

        return (
          <div
            key={id}
            className="border border-border-dim rounded overflow-hidden"
          >
            {/* Provider header */}
            <button
              onClick={() =>
                setCollapsed((prev) => ({ ...prev, [id]: !isCollapsed }))
              }
              className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-hover transition-colors"
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: p.color }}
              />
              <span className="font-mono text-[10px] text-secondary flex-1 text-left">
                {p.label}
              </span>
              {someSelected && (
                <span
                  className="font-mono text-[9px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: `${p.color}20`,
                    color: p.color,
                  }}
                >
                  {count}/{p.eventTypes.length}
                </span>
              )}
              <svg
                className={`w-3 h-3 text-tertiary transition-transform ${
                  isCollapsed ? "" : "rotate-180"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Event types list */}
            {!isCollapsed && (
              <div className="border-t border-border-dim px-2.5 py-1.5 space-y-0.5">
                {/* Select all toggle */}
                <button
                  onClick={() => toggleAll(id)}
                  className="flex items-center gap-2 w-full py-0.5 text-left"
                >
                  <div
                    className={`w-3 h-3 rounded-sm border transition-all flex items-center justify-center ${
                      allSelected
                        ? "border-transparent"
                        : someSelected
                        ? "border-border-bright"
                        : "border-border-default"
                    }`}
                    style={{
                      background: allSelected
                        ? p.color
                        : someSelected
                        ? `${p.color}40`
                        : "transparent",
                    }}
                  >
                    {(allSelected || someSelected) && (
                      <svg
                        className="w-2 h-2"
                        fill="none"
                        stroke="white"
                        viewBox="0 0 24 24"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d={allSelected ? "M5 13l4 4L19 7" : "M5 12h14"}
                        />
                      </svg>
                    )}
                  </div>
                  <span className="font-mono text-[9px] text-tertiary uppercase tracking-wider">
                    Select all
                  </span>
                </button>

                {p.eventTypes.map((et) => {
                  const active = selectedTypes.includes(et);
                  return (
                    <button
                      key={et}
                      onClick={() => toggleType(et)}
                      className="flex items-center gap-2 w-full py-0.5 text-left group"
                    >
                      <div
                        className={`w-3 h-3 rounded-sm border transition-all flex items-center justify-center ${
                          active
                            ? "border-transparent"
                            : "border-border-default group-hover:border-border-bright"
                        }`}
                        style={{
                          background: active ? (accent ?? p.color) : "transparent",
                        }}
                      >
                        {active && (
                          <svg
                            className="w-2 h-2"
                            fill="none"
                            stroke="white"
                            viewBox="0 0 24 24"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      <span
                        className={`font-mono text-[10px] ${
                          active
                            ? "text-primary"
                            : "text-tertiary group-hover:text-secondary"
                        }`}
                      >
                        {et}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable: Actor type toggle buttons                                */
/* ------------------------------------------------------------------ */

function ActorTypeToggle({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (val: string) => {
    onChange(
      selected.includes(val)
        ? selected.filter((s) => s !== val)
        : [...selected, val]
    );
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {ACTOR_TYPES.map((at) => {
        const active = selected.includes(at.value);
        return (
          <button
            key={at.value}
            onClick={() => toggle(at.value)}
            className={`${pillActiveCls} ${
              active
                ? "bg-nominal-bg text-nominal border-nominal-dim"
                : "bg-base text-tertiary border-border-dim hover:border-border-default"
            }`}
          >
            {at.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable: Searchable event type dropdown for filter value          */
/* ------------------------------------------------------------------ */

function EventTypeDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const allTypes = useMemo(() => {
    const types: { provider: string; type: string; color: string }[] = [];
    for (const [id, p] of Object.entries(PROVIDER_CATALOG)) {
      for (const et of p.eventTypes) {
        types.push({ provider: id, type: et, color: p.color });
      }
    }
    return types;
  }, []);

  const filtered = search
    ? allTypes.filter(
        (t) =>
          t.type.toLowerCase().includes(search.toLowerCase()) ||
          t.provider.toLowerCase().includes(search.toLowerCase())
      )
    : allTypes;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`${inputCls} text-left flex items-center justify-between`}
      >
        <span className={value ? "text-primary" : "text-tertiary"}>
          {value || "Select event type..."}
        </span>
        <svg
          className={`w-3 h-3 text-tertiary transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface border border-border-default rounded shadow-lg max-h-48 overflow-hidden flex flex-col">
          <div className="p-1.5 border-b border-border-dim">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search event types..."
              className={inputCls}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map((t) => (
              <button
                key={`${t.provider}:${t.type}`}
                onClick={() => {
                  onChange(t.type);
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-hover transition-colors ${
                  value === t.type ? "bg-hover" : ""
                }`}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: t.color }}
                />
                <span className="font-mono text-[10px] text-primary truncate">
                  {t.type}
                </span>
                <span className="font-mono text-[9px] text-tertiary ml-auto shrink-0">
                  {PROVIDER_CATALOG[t.provider].label}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-[10px] text-tertiary px-2.5 py-2 italic">
                No matching event types
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable: Provider pills for filter source value                   */
/* ------------------------------------------------------------------ */

function ProviderPills({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {PROVIDER_IDS.map((id) => {
        const p = PROVIDER_CATALOG[id];
        const active = selected.includes(id);
        return (
          <button
            key={id}
            onClick={() => toggle(id)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-left transition-all ${
              active
                ? "border-border-bright bg-base"
                : "border-border-dim bg-transparent opacity-50 hover:opacity-80"
            }`}
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                background: active ? p.color : "transparent",
                border: `1.5px solid ${p.color}`,
              }}
            />
            <span className="font-mono text-[10px]" style={{ color: active ? p.color : undefined }}>
              {p.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/*  EVENT SOURCE FORM                                                  */
/* ================================================================== */

function EventSourceForm({
  data,
  onUpdate,
}: {
  data: EventSourceNodeData;
  onUpdate: (d: SandboxNodeData) => void;
}) {
  const { config } = data;
  const [datePreset, setDatePreset] = useState<string | null>(null);

  const updateConfig = useCallback(
    (patch: Partial<typeof config>) => {
      onUpdate({ ...data, config: { ...config, ...patch } });
    },
    [data, config, onUpdate]
  );

  const applyPreset = (preset: (typeof DATE_RANGE_PRESETS)[number]) => {
    if (preset.ms === 0) {
      setDatePreset("Custom");
      return;
    }
    setDatePreset(preset.label);
    const end = new Date();
    const start = new Date(end.getTime() - preset.ms);
    updateConfig({
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  };

  return (
    <>
      {/* Date range with presets */}
      <div className={sectionCls}>
        <label className={labelCls}>Date Range</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {DATE_RANGE_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className={`${pillActiveCls} ${
                datePreset === p.label
                  ? "bg-data-bg text-data border-data-dim"
                  : "bg-base text-tertiary border-border-dim hover:border-border-default"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {(datePreset === "Custom" || (!datePreset && (config.dateRange.start || config.dateRange.end))) && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[9px] text-tertiary mb-1 block">From</span>
              <input
                type="date"
                value={
                  config.dateRange.start
                    ? config.dateRange.start.slice(0, 10)
                    : ""
                }
                onChange={(e) =>
                  updateConfig({
                    dateRange: {
                      ...config.dateRange,
                      start: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : "",
                    },
                  })
                }
                className={inputCls}
              />
            </div>
            <div>
              <span className="text-[9px] text-tertiary mb-1 block">To</span>
              <input
                type="date"
                value={
                  config.dateRange.end
                    ? config.dateRange.end.slice(0, 10)
                    : ""
                }
                onChange={(e) =>
                  updateConfig({
                    dateRange: {
                      ...config.dateRange,
                      end: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : "",
                    },
                  })
                }
                className={inputCls}
              />
            </div>
          </div>
        )}
      </div>

      {/* Source filter — provider grid */}
      <div className={sectionCls}>
        <label className={labelCls}>Source Filter</label>
        <ProviderGrid
          selected={config.sourceFilter}
          onChange={(v) => updateConfig({ sourceFilter: v })}
          accent="#00d4ff"
        />
      </div>

      {/* Event type filter — grouped checkboxes */}
      <div className={sectionCls}>
        <label className={labelCls}>Event Type Filter</label>
        <EventTypeSelector
          selectedProviders={config.sourceFilter}
          selectedTypes={config.eventTypeFilter}
          onChange={(v) => updateConfig({ eventTypeFilter: v })}
          accent="#00d4ff"
        />
      </div>
    </>
  );
}

/* ================================================================== */
/*  FILTER FORM                                                        */
/* ================================================================== */

function FilterForm({
  data,
  onUpdate,
}: {
  data: FilterNodeData;
  onUpdate: (d: SandboxNodeData) => void;
}) {
  const { config } = data;

  const addRule = useCallback(() => {
    const rule: FilterRule = {
      id: `rule_${Date.now()}`,
      field: "source",
      operator: "equals",
      value: "",
    };
    onUpdate({ ...data, config: { rules: [...config.rules, rule] } });
  }, [data, config, onUpdate]);

  const updateRule = useCallback(
    (ruleId: string, patch: Partial<FilterRule>) => {
      onUpdate({
        ...data,
        config: {
          rules: config.rules.map((r) =>
            r.id === ruleId ? { ...r, ...patch } : r
          ),
        },
      });
    },
    [data, config, onUpdate]
  );

  const removeRule = useCallback(
    (ruleId: string) => {
      onUpdate({
        ...data,
        config: { rules: config.rules.filter((r) => r.id !== ruleId) },
      });
    },
    [data, config, onUpdate]
  );

  return (
    <>
      <div className={sectionCls}>
        <div className="flex items-center justify-between">
          <label className={labelCls}>Rules</label>
          <button
            onClick={addRule}
            className="text-[10px] text-data hover:text-primary font-mono uppercase tracking-wider transition-colors"
          >
            + Add
          </button>
        </div>

        {config.rules.length === 0 ? (
          <p className="text-[10px] text-tertiary">
            No rules. Events pass through unfiltered.
          </p>
        ) : (
          <div className="space-y-2">
            {config.rules.map((rule, idx) => (
              <div key={rule.id}>
                {/* AND/OR separator between rules */}
                {idx > 0 && (
                  <div className="flex items-center justify-center py-1">
                    <span className="font-mono text-[9px] text-nominal uppercase tracking-widest px-2 py-0.5 bg-nominal-bg border border-nominal-dim rounded">
                      AND
                    </span>
                  </div>
                )}

                <div className="space-y-1.5 p-2 bg-base rounded border border-border-dim">
                  <div className="flex items-center justify-between">
                    <select
                      value={rule.field}
                      onChange={(e) =>
                        updateRule(rule.id, {
                          field: e.target.value as FilterRule["field"],
                          value: "", // reset value when field changes
                        })
                      }
                      className={inputCls}
                    >
                      <option value="source">Source</option>
                      <option value="event_type">Event Type</option>
                      <option value="actor_type">Actor Type</option>
                      <option value="custom">Custom Field</option>
                    </select>
                    <button
                      onClick={() => removeRule(rule.id)}
                      className="ml-2 text-tertiary hover:text-critical transition-colors shrink-0"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  <select
                    value={rule.operator}
                    onChange={(e) =>
                      updateRule(rule.id, {
                        operator: e.target.value as FilterRule["operator"],
                      })
                    }
                    className={inputCls}
                  >
                    <option value="equals">Equals</option>
                    <option value="not_equals">Not Equals</option>
                    <option value="contains">Contains</option>
                    <option value="not_contains">Not Contains</option>
                  </select>

                  {/* Context-aware value input */}
                  <FilterRuleValueInput rule={rule} onUpdate={updateRule} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Context-aware filter rule value input                               */
/* ------------------------------------------------------------------ */

function FilterRuleValueInput({
  rule,
  onUpdate,
}: {
  rule: FilterRule;
  onUpdate: (id: string, patch: Partial<FilterRule>) => void;
}) {
  // Parse multi-value string (comma separated) into array for multi-select fields
  const multiValues = rule.value ? rule.value.split(",").filter(Boolean) : [];

  switch (rule.field) {
    case "source":
      return (
        <div>
          <span className="text-[9px] text-tertiary mb-1 block">
            Select providers
          </span>
          <ProviderPills
            selected={multiValues}
            onChange={(v) => onUpdate(rule.id, { value: v.join(",") })}
          />
        </div>
      );

    case "event_type":
      return (
        <EventTypeDropdown
          value={rule.value}
          onChange={(v) => onUpdate(rule.id, { value: v })}
        />
      );

    case "actor_type":
      return (
        <div>
          <span className="text-[9px] text-tertiary mb-1 block">
            Select actor types
          </span>
          <ActorTypeToggle
            selected={multiValues}
            onChange={(v) => onUpdate(rule.id, { value: v.join(",") })}
          />
        </div>
      );

    case "custom":
      return (
        <div className="space-y-1.5">
          <input
            type="text"
            value={rule.value.split("::")[0] || ""}
            onChange={(e) => {
              const parts = rule.value.split("::");
              onUpdate(rule.id, {
                value: `${e.target.value}::${parts[1] || ""}`,
              });
            }}
            placeholder="Field path (e.g. payload.status)"
            className={inputCls}
          />
          <input
            type="text"
            value={rule.value.split("::")[1] || ""}
            onChange={(e) => {
              const parts = rule.value.split("::");
              onUpdate(rule.id, {
                value: `${parts[0] || ""}::${e.target.value}`,
              });
            }}
            placeholder="Value"
            className={inputCls}
          />
        </div>
      );

    default:
      return null;
  }
}

/* ================================================================== */
/*  OUTPUT FORM                                                        */
/* ================================================================== */

/** SVG icons for output types */
function OutputTypeIcon({ type, className }: { type: string; className?: string }) {
  const cls = className ?? "w-4 h-4";
  switch (type) {
    case "sse":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      );
    case "webhook":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
      );
    case "file":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      );
    case "console":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
        </svg>
      );
    default:
      return null;
  }
}

function OutputForm({
  data,
  onUpdate,
  nodeId,
  sandboxId,
  tenantId,
}: {
  data: OutputNodeData;
  onUpdate: (d: SandboxNodeData) => void;
  nodeId: string;
  sandboxId: string;
  tenantId: string;
}) {
  const { config } = data;
  const [templatePreset, setTemplatePreset] = useState<string>(
    config.transformTemplate === "{{ payload }}"
      ? "full"
      : config.transformTemplate ===
        '{ "event_id": "{{ event_id }}", "source": "{{ source }}", "event_type": "{{ event_type }}", "occurred_at": "{{ occurred_at }}" }'
      ? "minimal"
      : "custom"
  );
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [copied, setCopied] = useState(false);

  const updateConfig = useCallback(
    (patch: Partial<typeof config>) => {
      onUpdate({ ...data, config: { ...config, ...patch } });
    },
    [data, config, onUpdate]
  );

  // Build the canonical URL for this output
  const canonicalUrl = useMemo(() => {
    switch (config.outputType) {
      case "sse":
        return buildStreamUrl(tenantId, sandboxId, nodeId);
      case "file":
        return buildFileUrl(tenantId, sandboxId, nodeId, config.fileFormat);
      case "console":
        return buildConsoleUrl(tenantId, sandboxId, nodeId);
      case "webhook":
        return config.webhookUrl || "";
      default:
        return "";
    }
  }, [config.outputType, config.fileFormat, config.webhookUrl, tenantId, sandboxId, nodeId]);

  const handleCopy = useCallback(() => {
    if (canonicalUrl) {
      navigator.clipboard.writeText(canonicalUrl).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [canonicalUrl]);

  const handleTest = useCallback(() => {
    setTestStatus("testing");
    setTimeout(() => {
      setTestStatus(config.webhookUrl ? "success" : "error");
      setTimeout(() => setTestStatus("idle"), 3000);
    }, 1500);
  }, [config.webhookUrl]);

  return (
    <>
      {/* Output type selector */}
      <div className={sectionCls}>
        <label className={labelCls}>Output Type</label>
        <div className="space-y-1.5">
          {OUTPUT_TYPES.map((ot) => {
            const active = config.outputType === ot.value;
            return (
              <button
                key={ot.value}
                onClick={() => updateConfig({ outputType: ot.value as OutputType })}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded border text-left transition-all ${
                  active
                    ? "bg-critical-bg border-critical-dim"
                    : "bg-base border-border-dim hover:border-border-default"
                }`}
              >
                <span className={active ? "text-critical" : "text-tertiary"}>
                  <OutputTypeIcon type={ot.value} className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`font-mono text-[10px] font-medium uppercase tracking-wider ${active ? "text-critical" : "text-secondary"}`}>
                    {ot.label}
                  </div>
                  <div className="font-mono text-[9px] text-tertiary truncate">
                    {ot.description}
                  </div>
                </div>
                {active && (
                  <div className="w-2 h-2 rounded-full bg-critical shrink-0" style={{ boxShadow: "0 0 6px #ff3b3b" }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Canonical stream URL (for sse, file, console) */}
      {config.outputType !== "webhook" && (
        <div className={sectionCls}>
          <label className={labelCls}>
            {config.outputType === "sse" ? "Stream Endpoint" : config.outputType === "file" ? "Export URL" : "Log Endpoint"}
          </label>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 px-2.5 py-1.5 bg-base border border-border-default rounded font-mono text-[10px] text-data truncate select-all">
              {canonicalUrl}
            </div>
            <button
              onClick={handleCopy}
              className={`shrink-0 px-2 py-1.5 rounded border font-mono text-[10px] uppercase tracking-wider transition-all ${
                copied
                  ? "bg-nominal-bg text-nominal border-nominal-dim"
                  : "bg-base text-tertiary border-border-dim hover:border-border-default"
              }`}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="font-mono text-[9px] text-tertiary mt-1">
            Auto-generated endpoint for this output node
          </p>
        </div>
      )}

      {/* Webhook URL (only for webhook type) */}
      {config.outputType === "webhook" && (
        <div className={sectionCls}>
          <label className={labelCls}>Relay Target URL</label>
          <div className="flex gap-1.5">
            <input
              type="url"
              value={config.webhookUrl}
              onChange={(e) =>
                updateConfig({ webhookUrl: e.target.value })
              }
              placeholder="https://your-service.com/webhook"
              className={`${inputCls} flex-1`}
            />
            <button
              onClick={handleTest}
              disabled={testStatus === "testing"}
              className={`shrink-0 px-2.5 py-1.5 rounded font-mono text-[10px] uppercase tracking-wider border transition-all ${
                testStatus === "success"
                  ? "bg-nominal-bg text-nominal border-nominal-dim"
                  : testStatus === "error"
                  ? "bg-critical-bg text-critical border-critical-dim"
                  : testStatus === "testing"
                  ? "bg-caution-bg text-caution border-caution-dim animate-pulse"
                  : "bg-base text-tertiary border-border-dim hover:border-border-default"
              }`}
            >
              {testStatus === "testing"
                ? "..."
                : testStatus === "success"
                ? "OK"
                : testStatus === "error"
                ? "FAIL"
                : "Test"}
            </button>
          </div>
        </div>
      )}

      {/* File format (only for file type) */}
      {config.outputType === "file" && (
        <div className={sectionCls}>
          <label className={labelCls}>File Format</label>
          <div className="flex gap-2">
            {(["jsonl", "csv"] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => updateConfig({ fileFormat: fmt as FileFormat })}
                className={`${pillActiveCls} ${
                  config.fileFormat === fmt
                    ? "bg-critical-bg text-critical border-critical-dim"
                    : "bg-base text-tertiary border-border-dim hover:border-border-default"
                }`}
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Include fields */}
      <div className={sectionCls}>
        <label className={labelCls}>Include Fields</label>
        <div className="space-y-1">
          {OUTPUT_FIELDS.map((f) => {
            const included = config.includedFields?.includes(f.key) ?? true;
            return (
              <button
                key={f.key}
                onClick={() => {
                  const current = config.includedFields ?? OUTPUT_FIELDS.map((x) => x.key);
                  const next = included
                    ? current.filter((k) => k !== f.key)
                    : [...current, f.key];
                  updateConfig({ includedFields: next });
                }}
                className="flex items-center gap-2 py-0.5 w-full text-left group"
              >
                <div
                  className={`w-3 h-3 rounded-sm border transition-all flex items-center justify-center ${
                    included
                      ? "bg-critical border-transparent"
                      : "border-border-default group-hover:border-border-bright"
                  }`}
                >
                  {included && (
                    <svg
                      className="w-2 h-2"
                      fill="none"
                      stroke="white"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <span className="font-mono text-[10px] text-secondary group-hover:text-primary transition-colors">
                  {f.label}
                </span>
                <span className="font-mono text-[9px] text-tertiary ml-auto">
                  {f.key}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Transform template with presets */}
      <div className={sectionCls}>
        <label className={labelCls}>Transform Template</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {OUTPUT_TEMPLATE_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => {
                setTemplatePreset(p.value);
                if (p.template) {
                  updateConfig({ transformTemplate: p.template });
                }
              }}
              className={`${pillActiveCls} ${
                templatePreset === p.value
                  ? "bg-critical-bg text-critical border-critical-dim"
                  : "bg-base text-tertiary border-border-dim hover:border-border-default"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {templatePreset === "custom" && (
          <textarea
            value={config.transformTemplate}
            onChange={(e) =>
              updateConfig({ transformTemplate: e.target.value })
            }
            rows={4}
            className={`${inputCls} resize-none`}
            placeholder="&#123;&#123; payload &#125;&#125;"
          />
        )}
      </div>
    </>
  );
}

/* ================================================================== */
/*  GENERATOR FORM                                                     */
/* ================================================================== */

function GeneratorForm({
  data,
  onUpdate,
}: {
  data: GeneratorNodeData;
  onUpdate: (d: SandboxNodeData) => void;
}) {
  const { config } = data;

  const updateConfig = useCallback(
    (patch: Partial<typeof config>) => {
      onUpdate({ ...data, config: { ...config, ...patch } });
    },
    [data, config, onUpdate]
  );

  return (
    <>
      {/* Source types — provider grid */}
      <div className={sectionCls}>
        <label className={labelCls}>Source Types</label>
        <ProviderGrid
          selected={config.sourceTypes}
          onChange={(v) => updateConfig({ sourceTypes: v })}
          accent="#ffb800"
        />
      </div>

      {/* Event types — grouped checkboxes */}
      <div className={sectionCls}>
        <label className={labelCls}>Event Types</label>
        <EventTypeSelector
          selectedProviders={config.sourceTypes}
          selectedTypes={config.eventTypes}
          onChange={(v) => updateConfig({ eventTypes: v })}
          accent="#ffb800"
        />
      </div>

      {/* Event count */}
      <div className={sectionCls}>
        <label className={labelCls}>Event Count</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={1000}
            value={config.count}
            onChange={(e) =>
              updateConfig({ count: parseInt(e.target.value) })
            }
            className="flex-1 accent-caution"
          />
          <span className="font-mono text-xs text-caution tabular-nums w-12 text-right">
            {config.count}
          </span>
        </div>
      </div>

      {/* Generation rate — preset toggle bar */}
      <div className={sectionCls}>
        <label className={labelCls}>Generation Rate</label>
        <div className="flex flex-wrap gap-1.5">
          {RATE_PRESETS.map((rp) => (
            <button
              key={rp.ms}
              onClick={() => updateConfig({ intervalMs: rp.ms })}
              className={`${pillActiveCls} ${
                config.intervalMs === rp.ms
                  ? "bg-caution-bg text-caution border-caution-dim"
                  : "bg-base text-tertiary border-border-dim hover:border-border-default"
              }`}
            >
              {rp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Variation level */}
      <div className={sectionCls}>
        <label className={labelCls}>Variation Level</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(config.variationLevel * 100)}
            onChange={(e) =>
              updateConfig({
                variationLevel: parseInt(e.target.value) / 100,
              })
            }
            className="flex-1 accent-caution"
          />
          <span className="font-mono text-xs text-caution tabular-nums w-12 text-right">
            {Math.round(config.variationLevel * 100)}%
          </span>
        </div>
        <p className="font-mono text-[9px] text-tertiary">
          Controls randomness in generated events
        </p>
      </div>
    </>
  );
}
