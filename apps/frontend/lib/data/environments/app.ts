/*
 * `app` environments provider — stub. The host app does not yet
 * proxy `/api/environments`; flipping
 * `NEXT_PUBLIC_DATA_ENVIRONMENTS=app` surfaces a clear
 * `ProviderError(501)` rather than silently returning empty data.
 *
 * Note: sandbox lifecycle / exec / stats already proxy through
 * `/api/sandbox/*` directly from the page — this provider only
 * concerns the catalog of environments shown on the manager list.
 */

import { ProviderError } from "../types";
import type { EnvironmentsProvider } from "./types";

const NOT_IMPLEMENTED = (op: string) =>
  new ProviderError(
    501,
    `Environments app provider not implemented (op=${op}). Flip NEXT_PUBLIC_DATA_ENVIRONMENTS=mock or chronicle.`,
  );

export const appEnvironmentsProvider: EnvironmentsProvider = {
  list: () => Promise.reject(NOT_IMPLEMENTED("list")),
  subscribe: () => ({ unsubscribe: () => undefined }),
};
