/*
 * `chronicle` environments provider — stub. Wire to
 * `/api/platform/environments/*` on `chronicle-backend` when those
 * routes exist. Until then, every getter rejects with a 501.
 */

import { ProviderError } from "../types";
import type { EnvironmentsProvider } from "./types";

const NOT_IMPLEMENTED = (op: string) =>
  new ProviderError(
    501,
    `Environments chronicle provider not implemented (op=${op}). The Rust backend does not expose environments yet; flip NEXT_PUBLIC_DATA_ENVIRONMENTS=mock for now.`,
  );

export const chronicleEnvironmentsProvider: EnvironmentsProvider = {
  list: () => Promise.reject(NOT_IMPLEMENTED("list")),
  subscribe: () => ({ unsubscribe: () => undefined }),
};
