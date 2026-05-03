"use client";

import * as React from "react";
import {
  Beaker,
  Check,
  ChevronLeft,
  Database,
  GitBranch,
  Plus,
  Repeat,
  Sparkles,
  Layers as LayersIcon,
} from "lucide-react";

import { cx } from "../utils/cx";
import { Input } from "../primitives/input";
import { NativeSelect } from "../primitives/native-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../primitives/popover";
import { Textarea } from "../primitives/textarea";
import type {
  AddTraceToDatasetHandler,
  AddTraceToDatasetPayload,
  Dataset,
  DatasetPurpose,
  DatasetSplit,
  StreamTimelineEvent,
} from "./types";

export interface DatasetPickerProps {
  /** Renders the trigger as the popover anchor — the picker handles
   *  open/close state internally. */
  trigger: React.ReactNode;
  datasets: readonly Dataset[];
  /** Active event — used to compute fallback labels when no trace
   *  is attached. */
  event: StreamTimelineEvent | null;
  /** All events on the active trace (sorted ascending). When empty
   *  or single, the picker treats it as a trace-of-one. */
  traceEvents?: readonly StreamTimelineEvent[];
  onAddTraceToDataset: AddTraceToDatasetHandler;
  /**
   * Dataset ids the active trace is *already* a member of. Each
   * matching row in the list grows an `Added` check tag and clicks
   * still go through (the user may want to re-add with a different
   * split or note).
   */
  existingMembershipDatasetIds?: ReadonlySet<string>;
  /** Initial open state — defaults to false. */
  defaultOpen?: boolean;
}

interface PurposeMeta {
  label: string;
  Icon: typeof Database;
  /** Class for the small color dot rendered next to the dataset name. */
  dot: string;
  /** Class for the icon's tinted square background. */
  tile: string;
  /** Class for the icon glyph color. */
  ink: string;
}

/**
 * Purpose color tokens. Linear uses small color dots (`9px` pills)
 * next to labels rather than full pill chips for compact rows;
 * we keep the same convention with the `--c-event-*` palette so the
 * picker stays on-brand while reading as a Linear list.
 */
const PURPOSE_META: Record<DatasetPurpose, PurposeMeta> = {
  eval: {
    label: "Eval",
    Icon: Beaker,
    dot: "bg-event-violet",
    tile: "bg-event-violet/12",
    ink: "text-event-violet",
  },
  training: {
    label: "Training",
    Icon: Sparkles,
    dot: "bg-event-amber",
    tile: "bg-event-amber/12",
    ink: "text-event-amber",
  },
  replay: {
    label: "Replay",
    Icon: Repeat,
    dot: "bg-event-teal",
    tile: "bg-event-teal/12",
    ink: "text-event-teal",
  },
  review: {
    label: "Review",
    Icon: LayersIcon,
    dot: "bg-l-ink-dim",
    tile: "bg-l-wash-3",
    ink: "text-l-ink-lo",
  },
};

const PURPOSE_OPTIONS: { value: DatasetPurpose; label: string }[] = [
  { value: "eval", label: "Eval" },
  { value: "training", label: "Training" },
  { value: "replay", label: "Replay" },
  { value: "review", label: "Review" },
];

const SPLIT_OPTIONS: { value: "" | DatasetSplit; label: string }[] = [
  { value: "", label: "No split" },
  { value: "train", label: "Train" },
  { value: "validation", label: "Validation" },
  { value: "test", label: "Test" },
];

/**
 * DatasetPicker — Linear-density popover for adding the active trace
 * (or trace-of-one) to a dataset. Two views:
 *
 *   1. List — searchable list of existing datasets, plus a
 *      `+ Create new` affordance at the bottom.
 *   2. Form — entered when the user picks a dataset (drilldown for
 *      split + notes) or clicks `Create new` (full form).
 *
 * Visual model lifted from Linear's right-rail menus and command-bar
 * popovers — `bg-l-surface-bar` panel, hairline-separated sections,
 * sans 12 px labels, per-row hover wash.
 */
export function DatasetPicker({
  trigger,
  datasets,
  event,
  traceEvents,
  onAddTraceToDataset,
  existingMembershipDatasetIds,
  defaultOpen = false,
}: DatasetPickerProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [query, setQuery] = React.useState("");
  const [selectedDatasetId, setSelectedDatasetId] = React.useState<
    string | null
  >(null);
  const [creatingNew, setCreatingNew] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [newPurpose, setNewPurpose] = React.useState<DatasetPurpose>("eval");
  const [split, setSplit] = React.useState<"" | DatasetSplit>("");
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);

  /* Reset every form state whenever the popover opens. */
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedDatasetId(null);
      setCreatingNew(false);
      setNewName("");
      setNewDescription("");
      setNewPurpose("eval");
      setSplit("");
      setNotes("");
      setPending(false);
    }
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return datasets;
    return datasets.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [datasets, query]);

  /* Every addition is a trace — single-event selections are treated
     as a trace of one. */
  const effectiveTrace = React.useMemo(() => {
    const explicitList =
      traceEvents && traceEvents.length > 0 ? traceEvents : null;
    const list = explicitList ?? (event ? [event] : []);
    const traceId =
      event?.traceId ??
      explicitList?.find((e) => e.traceId)?.traceId ??
      event?.id ??
      "";
    const synthesized =
      !event?.traceId &&
      !explicitList?.some((e) => e.traceId) &&
      list.length <= 1;
    const label =
      event?.traceLabel ??
      explicitList?.find((e) => e.traceLabel)?.traceLabel ??
      (event ? `${event.source}/${event.type}` : "Selection");
    return {
      list,
      eventIds: list.map((e) => e.id),
      traceId,
      synthesized,
      label,
      count: list.length,
    };
  }, [traceEvents, event]);

  const summaryLabel =
    effectiveTrace.count > 1
      ? `Trace · ${effectiveTrace.count}`
      : effectiveTrace.label;

  const selectedDataset = React.useMemo(
    () =>
      selectedDatasetId
        ? datasets.find((d) => d.id === selectedDatasetId) ?? null
        : null,
    [selectedDatasetId, datasets],
  );

  const formActive = creatingNew || selectedDataset !== null;

  const submit = React.useCallback(async () => {
    if (effectiveTrace.count === 0) return;
    if (!selectedDataset && !creatingNew) return;
    if (creatingNew && newName.trim() === "") return;

    const payload: AddTraceToDatasetPayload = {
      traceId: effectiveTrace.traceId,
      traceSynthesized: effectiveTrace.synthesized,
      traceLabel: effectiveTrace.label,
      eventIds: effectiveTrace.eventIds,
      count: effectiveTrace.count,
      datasetId: selectedDataset?.id,
      newDataset: creatingNew
        ? {
            name: newName.trim(),
            description: newDescription.trim() || undefined,
            purpose: newPurpose,
          }
        : undefined,
      split: split === "" ? undefined : split,
      notes: notes.trim() || undefined,
    };

    setPending(true);
    try {
      const maybe = onAddTraceToDataset(payload);
      if (maybe instanceof Promise) await maybe;
      setOpen(false);
    } finally {
      setPending(false);
    }
  }, [
    effectiveTrace,
    selectedDataset,
    creatingNew,
    newName,
    newDescription,
    newPurpose,
    split,
    notes,
    onAddTraceToDataset,
  ]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-[300px] overflow-hidden rounded-md border-hairline bg-l-surface-bar p-0"
      >
        <Header
          formActive={formActive}
          summaryLabel={summaryLabel}
          synthesized={effectiveTrace.synthesized}
          count={effectiveTrace.count}
          onBack={() => {
            setSelectedDatasetId(null);
            setCreatingNew(false);
          }}
        />

        {!formActive ? (
          <DatasetList
            datasets={filtered}
            query={query}
            onQueryChange={setQuery}
            onPickDataset={(d) => setSelectedDatasetId(d.id)}
            onStartCreate={() => setCreatingNew(true)}
            existingMembershipDatasetIds={existingMembershipDatasetIds}
          />
        ) : (
          <DatasetForm
            mode={creatingNew ? "create" : "existing"}
            existingDataset={selectedDataset}
            newName={newName}
            newDescription={newDescription}
            newPurpose={newPurpose}
            split={split}
            notes={notes}
            pending={pending}
            onNewNameChange={setNewName}
            onNewDescriptionChange={setNewDescription}
            onNewPurposeChange={setNewPurpose}
            onSplitChange={setSplit}
            onNotesChange={setNotes}
            onCancel={() => setOpen(false)}
            onSubmit={submit}
            summaryLabel={summaryLabel}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ── Header ──────────────────────────────────────────────── */

function Header({
  formActive,
  summaryLabel,
  synthesized,
  count,
  onBack,
}: {
  formActive: boolean;
  summaryLabel: string;
  synthesized: boolean;
  count: number;
  onBack: () => void;
}) {
  return (
    <header className="flex h-[36px] shrink-0 items-center gap-[6px] border-b border-hairline bg-l-surface px-[10px]">
      {formActive ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="-ml-[2px] inline-flex h-[20px] w-[20px] items-center justify-center rounded-xs text-l-ink-dim transition-colors hover:bg-l-wash-3 hover:text-l-ink"
        >
          <ChevronLeft size={11} strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
      <span className="font-sans text-[12px] font-medium text-l-ink">
        Add to dataset
      </span>
      <span className="ml-auto inline-flex items-center gap-[5px] font-sans text-[11px] text-l-ink-lo">
        <GitBranch size={10} strokeWidth={1.75} aria-hidden />
        <span className="truncate max-w-[120px]">{summaryLabel}</span>
        <span
          className="rounded-xs bg-l-wash-3 px-[4px] py-px font-mono text-[10px] tabular-nums text-l-ink-dim"
          title={`${count} ${count === 1 ? "event" : "events"}`}
        >
          {count}
        </span>
        {synthesized ? (
          <span
            className="rounded-xs bg-l-wash-3 px-[4px] py-px font-sans text-[9.5px] uppercase tracking-tactical text-l-ink-dim"
            title="Trace of one — synthesized from event id"
          >
            solo
          </span>
        ) : null}
      </span>
    </header>
  );
}

/* ── List view ────────────────────────────────────────────── */

function DatasetList({
  datasets,
  query,
  onQueryChange,
  onPickDataset,
  onStartCreate,
  existingMembershipDatasetIds,
}: {
  datasets: readonly Dataset[];
  query: string;
  onQueryChange: (next: string) => void;
  onPickDataset: (dataset: Dataset) => void;
  onStartCreate: () => void;
  existingMembershipDatasetIds?: ReadonlySet<string>;
}) {
  return (
    <div className="flex flex-col">
      <div className="border-b border-hairline px-[8px] py-[8px]">
        <Input
          search
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search datasets…"
          aria-label="Search datasets"
          autoFocus
        />
      </div>
      <ul className="max-h-[260px] overflow-y-auto py-[4px]">
        {datasets.length === 0 ? (
          <li className="px-[12px] py-[10px] font-sans text-[12px] text-l-ink-dim">
            No datasets match.
          </li>
        ) : (
          datasets.map((dataset) => {
            const isMember = existingMembershipDatasetIds?.has(dataset.id);
            return (
              <li key={dataset.id}>
                <button
                  type="button"
                  onClick={() => onPickDataset(dataset)}
                  className="group flex w-full items-center gap-[10px] px-[10px] py-[7px] text-left transition-colors hover:bg-l-wash-3 focus-visible:bg-l-wash-3 focus-visible:outline-none"
                >
                  <DatasetTile purpose={dataset.purpose} />
                  <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
                    <div className="flex items-center gap-[6px]">
                      <span className="truncate font-sans text-[12.5px] font-medium text-l-ink">
                        {dataset.name}
                      </span>
                      {dataset.purpose ? (
                        <PurposePip purpose={dataset.purpose} />
                      ) : null}
                    </div>
                    <span className="truncate font-sans text-[11px] text-l-ink-dim">
                      {dataset.description ? (
                        <>
                          {dataset.description}
                          <span className="mx-[5px]">·</span>
                        </>
                      ) : null}
                      <span className="font-mono tabular-nums">
                        {dataset.traceCount.toLocaleString()}
                      </span>{" "}
                      traces
                    </span>
                  </div>
                  {isMember ? (
                    <span
                      className="inline-flex shrink-0 items-center gap-[4px] rounded-xs bg-event-green/12 px-[6px] py-[2px] font-sans text-[10px] uppercase tracking-tactical text-event-green"
                      title="This trace is already in this dataset"
                    >
                      <Check size={9} strokeWidth={2.25} aria-hidden />
                      Added
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
      <div className="border-t border-hairline">
        <button
          type="button"
          onClick={onStartCreate}
          className="flex w-full items-center gap-[8px] px-[10px] py-[8px] font-sans text-[12px] font-medium text-l-ink-lo transition-colors hover:bg-l-wash-3 hover:text-l-ink focus-visible:bg-l-wash-3 focus-visible:outline-none"
        >
          <span className="inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center text-l-ink-dim">
            <Plus size={11} strokeWidth={1.75} aria-hidden />
          </span>
          Create new dataset
        </button>
      </div>
    </div>
  );
}

/* ── Form view ────────────────────────────────────────────── */

function DatasetForm({
  mode,
  existingDataset,
  newName,
  newDescription,
  newPurpose,
  split,
  notes,
  pending,
  onNewNameChange,
  onNewDescriptionChange,
  onNewPurposeChange,
  onSplitChange,
  onNotesChange,
  onCancel,
  onSubmit,
  summaryLabel,
}: {
  mode: "existing" | "create";
  existingDataset: Dataset | null;
  newName: string;
  newDescription: string;
  newPurpose: DatasetPurpose;
  split: "" | DatasetSplit;
  notes: string;
  pending: boolean;
  onNewNameChange: (v: string) => void;
  onNewDescriptionChange: (v: string) => void;
  onNewPurposeChange: (v: DatasetPurpose) => void;
  onSplitChange: (v: "" | DatasetSplit) => void;
  onNotesChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  summaryLabel: string;
}) {
  const canSubmit = mode === "existing" || newName.trim() !== "";

  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending && canSubmit) onSubmit();
      }}
    >
      <div className="flex flex-col gap-[10px] px-[10px] py-[10px]">
        {mode === "existing" && existingDataset ? (
          <div className="flex items-center gap-[10px] rounded-xs bg-l-wash-3 px-[8px] py-[8px]">
            <DatasetTile purpose={existingDataset.purpose} />
            <div className="flex min-w-0 flex-col gap-[1px]">
              <span className="truncate font-sans text-[12.5px] font-medium text-l-ink">
                {existingDataset.name}
              </span>
              <span className="font-sans text-[11px] text-l-ink-dim">
                Adding {summaryLabel.toLowerCase()}
              </span>
            </div>
          </div>
        ) : (
          <>
            <FormField label="Name">
              <Input
                value={newName}
                onChange={(e) => onNewNameChange(e.target.value)}
                placeholder="e.g. Support · Edge cases"
                autoFocus
                required
              />
            </FormField>
            <FormField label="Description">
              <Textarea
                rows={2}
                value={newDescription}
                onChange={(e) => onNewDescriptionChange(e.target.value)}
                placeholder="Short note on what this dataset is for"
              />
            </FormField>
            <FormField label="Purpose">
              <NativeSelect
                value={newPurpose}
                onChange={(e) =>
                  onNewPurposeChange(e.target.value as DatasetPurpose)
                }
              >
                {PURPOSE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </>
        )}

        <div className="grid grid-cols-2 gap-[8px]">
          <FormField label="Split">
            <NativeSelect
              value={split}
              onChange={(e) =>
                onSplitChange(e.target.value as "" | DatasetSplit)
              }
            >
              {SPLIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Notes">
            <Input
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Optional"
            />
          </FormField>
        </div>
      </div>

      <footer className="flex items-center justify-end gap-[6px] border-t border-hairline bg-l-surface px-[10px] py-[8px]">
        <FooterButton tone="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </FooterButton>
        <FooterButton
          tone="primary"
          type="submit"
          disabled={!canSubmit || pending}
          loading={pending}
        >
          {mode === "create" ? "Create + Add" : "Add"}
        </FooterButton>
      </footer>
    </form>
  );
}

function FormField({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-[4px]">
      <span className="font-sans text-[11.5px] font-medium text-l-ink-dim">
        {label}
      </span>
      {children}
    </label>
  );
}

function FooterButton({
  tone,
  onClick,
  disabled,
  loading,
  type,
  children,
}: {
  tone: "ghost" | "primary";
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  children: React.ReactNode;
}) {
  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex h-[24px] items-center justify-center gap-[6px] rounded-md border px-[10px]",
        "font-sans text-[12px] font-medium leading-none",
        "transition-colors duration-fast",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember focus-visible:ring-offset-1 focus-visible:ring-offset-page",
        "disabled:cursor-not-allowed disabled:opacity-40",
        tone === "primary"
          ? "border-transparent bg-ember text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_1px_rgba(0,0,0,0.35)] hover:bg-ember-hover"
          : "border-transparent text-l-ink-lo hover:bg-l-wash-3 hover:text-l-ink",
      )}
    >
      {loading ? (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          className="h-3 w-3 shrink-0 animate-spin"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            className="opacity-25"
          />
          <path
            d="M4 12a8 8 0 018-8"
            stroke="currentColor"
            strokeWidth="2"
            className="opacity-75"
          />
        </svg>
      ) : null}
      {children}
    </button>
  );
}

/* ── Dataset glyphs ───────────────────────────────────────── */

function DatasetTile({ purpose }: { purpose: DatasetPurpose | undefined }) {
  const meta = purpose ? PURPOSE_META[purpose] : undefined;
  const Icon = meta?.Icon ?? Database;
  return (
    <span
      className={cx(
        "inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-xs",
        meta ? meta.tile : "bg-l-wash-3",
        meta ? meta.ink : "text-l-ink-dim",
      )}
    >
      <Icon size={11} strokeWidth={1.75} aria-hidden />
    </span>
  );
}

function PurposePip({ purpose }: { purpose: DatasetPurpose }) {
  const meta = PURPOSE_META[purpose];
  return (
    <span className="inline-flex shrink-0 items-center gap-[4px] font-sans text-[10.5px] uppercase tracking-tactical text-l-ink-dim">
      <span
        aria-hidden
        className={cx("inline-block h-[6px] w-[6px] rounded-pill", meta.dot)}
      />
      {meta.label}
    </span>
  );
}
