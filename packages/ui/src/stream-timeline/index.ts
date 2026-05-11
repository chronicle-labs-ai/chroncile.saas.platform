/*
 * Stream Timeline — event-stream timeline viewer with topic-tree
 * organization, drag/zoom time axis, playhead, and a sibling
 * streams-panel for capture controls.
 *
 * Companion to the trace-based `TimelineLane` in `product/`. Where
 * `TimelineLane` shows traces composed of spans, this module shows
 * the *event firehose* — many independent sources sharing one time
 * axis, no traces.
 */

/* ── Top-level surfaces ─────────────────────────────────────── */
export { StreamTimelineViewer } from "./stream-timeline-viewer";
export type { StreamTimelineViewerProps } from "./stream-timeline-viewer";

export { StreamEventDetail } from "./stream-event-detail";
export type { StreamEventDetailProps } from "./stream-event-detail";

export { StreamsPanel } from "./streams-panel";
export type { StreamsPanelProps } from "./streams-panel";

/* ── Sub-components (exposed for advanced composition) ──────── */
export { StreamTimelineToolbar } from "./stream-timeline-toolbar";
export type {
  StreamTimelineGroupBy,
  StreamTimelineToolbarProps,
} from "./stream-timeline-toolbar";

export { StreamTimelineAxis } from "./stream-timeline-axis";
export type { StreamTimelineAxisProps } from "./stream-timeline-axis";

export { StreamTimelineRow } from "./stream-timeline-row";
export type {
  StreamTimelineRowMark,
  StreamTimelineRowProps,
} from "./stream-timeline-row";

export { StreamTimelineConnectors } from "./stream-timeline-connectors";
export type {
  StreamTimelineConnectorsEdge,
  StreamTimelineConnectorsProps,
} from "./stream-timeline-connectors";

export { StreamTimelineFilterBar } from "./stream-timeline-filter-bar";
export type { StreamTimelineFilterBarProps } from "./stream-timeline-filter-bar";

export { defaultStreamTimelineColumns } from "./filter-columns";
export type { DefaultStreamTimelineColumnsOptions } from "./filter-columns";

export { DatasetPicker } from "./dataset-picker";
export type { DatasetPickerProps } from "./dataset-picker";

/* ── Pure helpers ───────────────────────────────────────────── */
export { useTimeView } from "./use-time-view";
export type { TimeViewState, UseTimeViewReturn } from "./use-time-view";

export {
  buildTopicTree,
  getVisibleNodes,
  topicPathDisplay,
  topicPathFromEvent,
  topicPathLeaf,
} from "./topic-tree";
export type { TopicPath, TopicTreeNode } from "./topic-tree";

export {
  pathColor,
  sourceColor,
  sourceTintedBackground,
} from "./source-color";

export {
  buildTraceContext,
  buildTraceEdges,
  groupByTrace,
  resolveEffectiveTraceId,
  resolveTraceId,
} from "./trace";
export type {
  TraceContext,
  TraceEdge,
  TraceEdgeKind,
  TraceGroup,
} from "./trace";

export {
  DEFAULT_LABEL_WIDTH,
  DEFAULT_ROW_HEIGHT,
  HEADER_HEIGHT,
  INDENT_SIZE,
  MAX_HALF_WIDTH_MS,
  MIN_HALF_WIDTH_MS,
  formatTickLabel,
  getTickIntervalMs,
  getTickIntervalSeconds,
} from "./tick-format";

/* ── Types ──────────────────────────────────────────────────── */
export type {
  AddTraceToDatasetHandler,
  AddTraceToDatasetPayload,
  Dataset,
  DatasetMembershipsResolver,
  DatasetPurpose,
  DatasetSplit,
  RecordingState,
  RecordingStream,
  StreamId,
  StreamPlaybackState,
  StreamPlayheadEvent,
  StreamSelectionEvent,
  StreamTimeRangeEvent,
  StreamTimelineEvent,
  TraceDatasetMembership,
  TraceKeyFn,
} from "./types";
export {
  REC_IDLE,
  REC_SELECTING,
  recPendingSave,
  recRecording,
} from "./types";

/* ── Mock data for stories + bring-up ───────────────────────── */
export {
  STREAM_TIMELINE_MOCK_ANCHOR_MS,
  datasetsSeed,
  recordingStreamsSeed,
  streamTimelineDenseSeed,
  streamTimelineEmptySeed,
  streamTimelineSeed,
  streamTimelineSparseSeed,
  streamTimelineTracesSeed,
  TRACE_SCENARIOS,
} from "./data";
