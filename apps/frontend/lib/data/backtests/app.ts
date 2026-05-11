/*
 * `app` backtests provider — stub. The host app does not yet
 * proxy `/api/backtests/*`; flipping `NEXT_PUBLIC_DATA_BACKTESTS=app`
 * surfaces a clear `ProviderError(501)` rather than silently
 * returning empty data. Fill in when there's a Next.js handler to
 * mediate this domain (e.g. WorkOS-tied tenancy, sandbox lifecycle).
 */

import { ProviderError } from "../types";
import type { BacktestsProvider } from "./types";

const NOT_IMPLEMENTED = (op: string) =>
  new ProviderError(
    501,
    `Backtests app provider not implemented (op=${op}). Flip NEXT_PUBLIC_DATA_BACKTESTS=mock or chronicle.`,
  );

export const appBacktestsProvider: BacktestsProvider = {
  listRuns: () => Promise.reject(NOT_IMPLEMENTED("listRuns")),
  getAvailability: () => Promise.reject(NOT_IMPLEMENTED("getAvailability")),
  getInitialScene: () => Promise.reject(NOT_IMPLEMENTED("getInitialScene")),
  subscribe: () => ({ unsubscribe: () => undefined }),
};
