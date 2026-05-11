/*
 * `chronicle` backtests provider — stub. Wire to
 * `/api/platform/backtests/*` on `chronicle-backend` when those
 * routes exist. Until then, every getter rejects with a 501 so the
 * env flip is loud.
 */

import { ProviderError } from "../types";
import type { BacktestsProvider } from "./types";

const NOT_IMPLEMENTED = (op: string) =>
  new ProviderError(
    501,
    `Backtests chronicle provider not implemented (op=${op}). The Rust backend does not expose backtests yet; flip NEXT_PUBLIC_DATA_BACKTESTS=mock for now.`,
  );

export const chronicleBacktestsProvider: BacktestsProvider = {
  listRuns: () => Promise.reject(NOT_IMPLEMENTED("listRuns")),
  getAvailability: () => Promise.reject(NOT_IMPLEMENTED("getAvailability")),
  getInitialScene: () => Promise.reject(NOT_IMPLEMENTED("getInitialScene")),
  subscribe: () => ({ unsubscribe: () => undefined }),
};
