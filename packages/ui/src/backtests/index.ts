/*
 * Backtests — visual surfaces for the agent backtesting flow:
 *
 *   Stage 1 · Configure  — Jobs picker → recipe + inline editors
 *   Stage 2 · Running    — live progress + per-candidate rows
 *   Stage 3 · Results    — verdict + metrics table + divergences
 *
 * Renders under `data-chrome="product"` (Linear density) — Storybook
 * stories opt into product chrome via `<ProductChromeFrame>` because
 * the global default is brand chrome.
 */

/* ── Top-level surface ─────────────────────────────────────── */
export { BacktestsManager } from "./backtests-manager";
export type {
  BacktestsManagerProps,
} from "./backtests-manager";

export { BacktestNav } from "./backtest-nav";
export type { BacktestNavProps } from "./backtest-nav";

/* ── List view (manager landing) ───────────────────────────── */
export { BacktestsList } from "./list/backtests-list";
export type { BacktestsListProps } from "./list/backtests-list";

export { NewBacktestMenu } from "./list/new-backtest-menu";
export type { NewBacktestMenuProps } from "./list/new-backtest-menu";

/* ── Configure surfaces ───────────────────────────────────── */
export { BacktestConfigure } from "./configure/backtest-configure";
export type { BacktestConfigureProps } from "./configure/backtest-configure";

export { BacktestJobsPicker } from "./configure/backtest-jobs-picker";
export type { BacktestJobsPickerProps } from "./configure/backtest-jobs-picker";

export { BacktestRecipe as BacktestRecipeView } from "./configure/backtest-recipe";
export type { BacktestRecipeProps as BacktestRecipeViewProps } from "./configure/backtest-recipe";

export { BacktestRecipeStrip } from "./configure/backtest-recipe-strip";
export type { BacktestRecipeStripProps } from "./configure/backtest-recipe-strip";

export { BacktestRecipePill } from "./configure/backtest-recipe-pill";
export type { BacktestRecipePillProps } from "./configure/backtest-recipe-pill";

export { BacktestSummaryStrip } from "./configure/backtest-summary-strip";
export type { BacktestSummaryStripProps } from "./configure/backtest-summary-strip";

export { BacktestStepper } from "./configure/backtest-stepper";
export type { BacktestStepperProps, BacktestStepStatus } from "./configure/backtest-stepper";

export { StepDataset } from "./configure/steps/step-dataset";
export type { StepDatasetProps } from "./configure/steps/step-dataset";

export { StepEnrich } from "./configure/steps/step-enrich";
export type { StepEnrichProps } from "./configure/steps/step-enrich";

export { StepEnvironment } from "./configure/steps/step-environment";
export type { StepEnvironmentProps } from "./configure/steps/step-environment";

export { StepVersions } from "./configure/steps/step-versions";
export type { StepVersionsProps } from "./configure/steps/step-versions";

export { BacktestLaunchDock } from "./configure/backtest-launch-dock";
export type { BacktestLaunchDockProps } from "./configure/backtest-launch-dock";

export { BacktestAgentsEditor } from "./configure/backtest-agents-editor";
export type { BacktestAgentsEditorProps } from "./configure/backtest-agents-editor";

export { BacktestDataBuilder } from "./configure/backtest-data-builder";
export type { BacktestDataBuilderProps } from "./configure/backtest-data-builder";

export { BacktestGraderBuilder } from "./configure/backtest-grader-builder";
export type { BacktestGraderBuilderProps } from "./configure/backtest-grader-builder";

export { BacktestQuickCheckDrawer } from "./configure/backtest-quick-check-drawer";
export type { BacktestQuickCheckDrawerProps } from "./configure/backtest-quick-check-drawer";

/* ── Running surfaces ──────────────────────────────────────── */
export { BacktestRunning } from "./running/backtest-running";
export type { BacktestRunningProps } from "./running/backtest-running";

/* ── Results surfaces ──────────────────────────────────────── */
export { BacktestResults } from "./results/backtest-results";
export type { BacktestResultsProps } from "./results/backtest-results";

/* ── Mock seeds + types for stories + bring-up ─────────────── */
export {
  BACKTEST_CANDIDATES,
  BACKTEST_DATASETS,
  BACKTEST_LIBRARY_GRADERS,
  BACKTEST_METRICS,
  BACKTEST_DIVERGENCES,
  BACKTEST_JOB_PRESETS,
  BACKTEST_RECENT_RUNS,
  BACKTEST_CLUSTER_OPTIONS,
  BACKTEST_SCENARIO_MOVES,
  BACKTEST_SCENARIO_BUCKETS,
  BACKTEST_DISCOVERY_PROPOSALS,
  BACKTEST_ENVIRONMENTS_SEED,
  BACKTEST_RUNS_SEED,
  backtestSparkline,
  buildLiveFeed,
  buildProposedGraders,
  bucketMeta,
  cloneRecipe,
  findCandidate,
  findEnvironmentRef,
  hydrateRecipeFromRun,
  isAcceptedScenario,
  isDatasetStepDone,
  isEnrichStepDone,
  isEnvironmentStepDone,
  isVersionsStepDone,
  isRecipeLaunchable,
  recipeAgentCount,
  recipeCaseCount,
  recipeEnrichmentCount,
} from "./data";

export type {
  BacktestRecentRun,
  BacktestClusterOption,
  BacktestScenarioMove,
  BacktestScenarioBucketMeta,
} from "./data";

export { BACKTEST_PIPELINE_STEPS } from "./types";

export type {
  BacktestStage,
  BacktestRunStatus,
  BacktestConfigurePhase,
  BacktestPipelineStep,
  BacktestAgent,
  BacktestAgentRole,
  BacktestDataset,
  BacktestEnvironmentRef,
  BacktestGrader,
  BacktestGraderKind,
  BacktestGraderWeight,
  BacktestGraderSource,
  BacktestProposedGrader,
  BacktestGraderPreviewRow,
  BacktestData,
  BacktestDataKind,
  BacktestDataSource,
  BacktestDataScenario,
  BacktestScenarioBucket,
  BacktestRecipe,
  BacktestRunSummary,
  BacktestJobPreset,
  BacktestJobIcon,
  BacktestJobMode,
  BacktestJobId,
  BacktestLiveCase,
  BacktestLiveCaseStatus,
  BacktestCandidateProgress,
  BacktestDivergence,
  BacktestDivergenceDelta,
  BacktestDivergenceSeverity,
  BacktestDivergenceSide,
  BacktestOutcome,
  BacktestMetric,
  BacktestQuickCheckCellState,
  BacktestQuickCheckState,
} from "./types";
