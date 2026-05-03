/*
 * Datasets — visual surfaces for inspecting and curating datasets of
 * traces, observing cluster structure, and adding/removing traces.
 *
 * Builds on the existing stream-timeline event + dataset primitives:
 *
 *   - Dataset CRUD (Create / Edit / Delete) at the manager level.
 *   - Per-dataset detail page rendered as a unified canvas with a
 *     lens picker (List / Cluster / Graph / Timeline / Coverage),
 *     a filter rail, and a Display popover.
 *   - Trace detail drawer that embeds `StreamTimelineViewer` for the
 *     selected trace, plus a Remove-from-dataset confirm flow.
 *
 * Renders under the unified Linear-density chrome. The earlier brand
 * vs product chrome split has been retired.
 */

/* ── Top-level surfaces ─────────────────────────────────────── */
export { DatasetsManager } from "./datasets-manager";
export type {
  DatasetsManagerProps,
  ManagerDetailHelpers,
} from "./datasets-manager";

export {
  DatasetDetailPage,
  DATASET_DETAIL_LENSES,
  DATASET_DETAIL_TABS,
  DATASET_DISPLAY_PROPERTIES,
} from "./dataset-detail-page";
export type {
  DatasetDetailPageProps,
  DatasetDetailLens,
  DatasetDetailTab,
  DatasetDensity,
  DatasetDisplayProperty,
  DatasetGroupBy,
  DatasetOrdering,
} from "./dataset-detail-page";

export { defaultDatasetTraceColumns } from "./dataset-trace-columns";

export { DatasetCoverageLens } from "./dataset-coverage-lens";
export type {
  DatasetCoverageLensProps,
  CoverageBucketSelection,
} from "./dataset-coverage-lens";

export {
  ClusterPicker,
  SplitPicker,
  StatusPicker,
  ClearSelectionButton,
} from "./dataset-trace-pickers";
export type {
  ClusterPickerProps,
  SplitPickerProps,
  StatusPickerProps,
} from "./dataset-trace-pickers";

/* ── Keyboard layer + palette + sheet ─────────────────────── */

export {
  DATASET_CANVAS_SHORTCUTS,
  DATASET_CANVAS_SHORTCUTS_BY_ID,
  DATASET_CANVAS_GROUPS,
  parseChord,
  chordMatches,
  chordToKeys,
} from "./dataset-canvas-keymap";
export type {
  DatasetCanvasShortcut,
  DatasetCanvasShortcutGroup,
  ParsedChord,
} from "./dataset-canvas-keymap";

export {
  useDatasetCanvasKeyboard,
  isEditableTarget,
} from "./dataset-canvas-keyboard";
export type {
  DatasetCanvasShortcutId,
  DatasetCanvasHandlers,
  UseDatasetCanvasKeyboardOptions,
} from "./dataset-canvas-keyboard";

export { DatasetShortcutSheet } from "./dataset-shortcut-sheet";
export type { DatasetShortcutSheetProps } from "./dataset-shortcut-sheet";

export { DatasetCommandPalette } from "./dataset-command-palette";
export type {
  DatasetCommandPaletteProps,
  DatasetCommandPaletteCommand,
} from "./dataset-command-palette";

/* ── Saved views + eval runs + compare ────────────────────── */

export { DatasetCanvasRail } from "./dataset-canvas-rail";
export type { DatasetCanvasRailProps } from "./dataset-canvas-rail";

export { DatasetTraceCompareDrawer } from "./dataset-trace-compare";
export type { DatasetTraceCompareDrawerProps } from "./dataset-trace-compare";

/* ── Linear-density filter rail ─────────────────────────── */

export { DatasetFilterRail } from "./dataset-filter-rail";
export type { DatasetFilterRailProps } from "./dataset-filter-rail";

export { DatasetTraceDetailDrawer } from "./dataset-trace-detail-drawer";
export type { DatasetTraceDetailDrawerProps } from "./dataset-trace-detail-drawer";

/* ── Manager-level pieces ──────────────────────────────────── */
export { DatasetsToolbar, DATASET_PURPOSE_FILTERS } from "./datasets-toolbar";
export type {
  DatasetsToolbarProps,
  DatasetsView,
} from "./datasets-toolbar";

export { DatasetCard } from "./dataset-card";
export type { DatasetCardProps } from "./dataset-card";

export { DatasetRow } from "./dataset-row";
export type { DatasetRowProps } from "./dataset-row";

export { DatasetEmpty } from "./dataset-empty";
export type { DatasetEmptyProps } from "./dataset-empty";

export { DatasetActionsMenu } from "./dataset-actions-menu";
export type { DatasetActionsMenuProps } from "./dataset-actions-menu";

/* ── CRUD dialogs ──────────────────────────────────────────── */
export { DatasetCreateDialog } from "./dataset-create-dialog";
export type { DatasetCreateDialogProps } from "./dataset-create-dialog";

export { DatasetEditDialog } from "./dataset-edit-dialog";
export type { DatasetEditDialogProps } from "./dataset-edit-dialog";

export { DatasetDeleteConfirm } from "./dataset-delete-confirm";
export type { DatasetDeleteConfirmProps } from "./dataset-delete-confirm";

export {
  DatasetForm,
  DATASET_FORM_EMPTY,
  isFormValid as isDatasetFormValid,
  parseTagsInput as parseDatasetTagsInput,
} from "./dataset-form";
export type {
  DatasetFormProps,
  DatasetFormValues,
} from "./dataset-form";

/* ── Detail-level pieces ───────────────────────────────────── */
export { DatasetMetricsStrip } from "./dataset-metrics-strip";
export type { DatasetMetricsStripProps } from "./dataset-metrics-strip";

export { DatasetSplitChip } from "./dataset-split-chip";
export type { DatasetSplitChipProps } from "./dataset-split-chip";

export { DatasetClusterCard } from "./dataset-cluster-card";
export type { DatasetClusterCardProps } from "./dataset-cluster-card";

export {
  TraceSummaryRow,
  buildClusterIndex,
  formatTraceDuration,
} from "./trace-summary-row";
export type { TraceSummaryRowProps } from "./trace-summary-row";

/* ── Graph view ────────────────────────────────────────────── */
export { DatasetGraphView } from "./dataset-graph-view";
export type { DatasetGraphViewProps } from "./dataset-graph-view";

export {
  buildGraphLayout,
  findNearestNode,
  nodeAt,
} from "./graph-layout";
export type {
  ClusterCentroid,
  GraphEdge,
  GraphLayout,
  GraphLayoutOptions,
  GraphNode,
} from "./graph-layout";

export { useGraphSimulation } from "./use-graph-simulation";
export type {
  UseGraphSimulationOptions,
  UseGraphSimulationReturn,
} from "./use-graph-simulation";

/* ── Purpose meta + cluster colors ─────────────────────────── */
export { DATASET_PURPOSE_META } from "./purpose-meta";
export type { PurposeMeta } from "./purpose-meta";

export {
  CLUSTER_COLOR_TOKENS,
  clusterColor,
  clusterColorAlpha,
  clusterColorHex,
  clusterFill,
  clusterStroke,
} from "./cluster-color";

/* ── Types ──────────────────────────────────────────────────
 *
 * `Dataset`, `DatasetPurpose`, `DatasetSplit`, and
 * `StreamTimelineEvent` are intentionally NOT re-exported here —
 * they're already exported from `./stream-timeline` and re-exporting
 * them at the top-level barrel would create an ambiguous-export
 * error. Import them from `ui` (or `ui/stream-timeline`) directly.
 */
export type {
  CreateDatasetHandler,
  CreateDatasetPayload,
  CreateSavedViewHandler,
  CreateSavedViewPayload,
  DatasetCluster,
  DatasetEvalRun,
  DatasetEvalRunStatus,
  DatasetSavedView,
  DatasetSimilarityEdge,
  DatasetSnapshot,
  DeleteDatasetHandler,
  DeleteDatasetPayload,
  DeleteSavedViewHandler,
  DeleteSavedViewPayload,
  RemoveTraceFromDatasetHandler,
  RemoveTraceFromDatasetPayload,
  TraceStatus,
  TraceSummary,
  UpdateDatasetHandler,
  UpdateDatasetPayload,
  UpdateSavedViewHandler,
  UpdateSavedViewPayload,
  UpdateTracesHandler,
  UpdateTracesPayload,
} from "./types";

/* ── Mock seeds for stories + bring-up ─────────────────────── */
export {
  DATASETS_MOCK_ANCHOR_MS,
  datasetsManagerSeed,
  datasetSnapshotsById,
  denseSyntheticSnapshot,
  emptyDatasetSnapshot,
  evalDatasetSnapshot,
  replayDatasetSnapshot,
  reviewDatasetSnapshot,
  trainingDatasetSnapshot,
} from "./data";
