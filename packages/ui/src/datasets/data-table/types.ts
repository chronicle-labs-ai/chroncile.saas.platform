/*
 * data-table/types — shared types for the dataset table surface.
 *
 * Modeled after tablecn (`sadmann7/tablecn`) but trimmed to what
 * the dataset detail page actually uses: a faceted-filter `Option`
 * shape, a `FilterVariant` discriminator for the per-column filter
 * UX, and a TanStack `ColumnMeta` augmentation that lets column
 * defs carry their own label / placeholder / faceted options.
 *
 * Pulled in to `packages/ui/src/datasets/` rather than into the
 * top-level primitives folder because it is dataset-surface-specific
 * — the wider design system stays decoupled from `@tanstack/react-table`.
 */

import type { RowData } from "@tanstack/react-table";

export interface Option {
  label: string;
  value: string;
  /** Optional faceted count rendered after the label (e.g. "warn (12)"). */
  count?: number;
  /** Optional leading mark (small dot, source logo, etc.) shown beside the label. */
  icon?: React.FC<React.SVGProps<SVGSVGElement>> | React.ComponentType<{ className?: string }>;
}

/**
 * What kind of filter UI a column should render. Currently we only
 * surface `multiSelect` (faceted filter chips) — `text`, `range`,
 * `date`, `boolean` are kept in the type so we can grow into them
 * without churning column defs.
 */
export type FilterVariant =
  | "text"
  | "number"
  | "range"
  | "date"
  | "dateRange"
  | "boolean"
  | "select"
  | "multiSelect";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Human-readable label for the column header / view options menu. */
    label?: string;
    /** Faceted filter placeholder. */
    placeholder?: string;
    /** Filter variant — drives which filter component the canvas mounts. */
    variant?: FilterVariant;
    /** Static option list for `select` / `multiSelect` filters. */
    options?: Option[];
    /** Numeric `[min, max]` for `range` filters. */
    range?: [number, number];
    /** Optional unit suffix ("ms", "events", …) for numeric headers. */
    unit?: string;
  }
}
