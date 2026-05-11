/*
 * Public API for `@/lib/data`.
 *
 * Pages should import the provider component + the per-domain hooks
 * they need. Direct provider access is available via
 * `useDataProvider()` for escape-hatch flows (e.g. exports, ad-hoc
 * fetches inside event handlers).
 */

export { DataProviderProvider, useDataProvider } from "./provider";
export type { DataProviderContextValue } from "./provider";

export { getDataConfig, __resetDataConfigCache } from "./config";
export type { DataConfig } from "./config";

export { qk } from "./query-keys";
export { getQueryClient, makeQueryClient } from "./query-client";

export { ProviderError, DATA_MODES, isDataMode } from "./types";
export type { DataMode, Subscription } from "./types";
