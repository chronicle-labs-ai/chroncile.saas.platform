/*
 * use-rail-resize — re-export from `layout/use-rail-resize` for one
 * release so existing dataset-internal imports keep working while
 * other modules (agents, …) consume the shared hook from the layout
 * module directly.
 *
 * @deprecated Import from "../layout/use-rail-resize" instead.
 */

export {
  RAIL_HANDLE_CLASSNAME,
  useRailResize,
} from "../layout/use-rail-resize";
export type {
  UseRailResizeOptions,
  UseRailResizeReturn,
} from "../layout/use-rail-resize";
