import type { ReactNode } from "react";

export type ColumnType = "option" | "multiOption" | "text" | "number";

export type OptionTone =
  | "neutral"
  | "ember"
  | "teal"
  | "amber"
  | "green"
  | "orange"
  | "pink"
  | "violet"
  | "red";

export interface ColumnOption {
  value: string;
  label: string;
  icon?: ReactNode;
  tone?: OptionTone;
}

export interface ColumnConfig<TRow> {
  id: string;
  label: string;
  type: ColumnType;
  accessor: (row: TRow) => unknown;
  /**
   * Options for `option` and `multiOption` columns. Falls back to the
   * distinct set of accessor values if omitted.
   */
  options?: ColumnOption[];
  icon?: ReactNode;
  /** Placeholder for text / number editors. */
  placeholder?: string;
}

export type FilterOperator =
  | "is"
  | "isNot"
  | "isAnyOf"
  | "isNoneOf"
  | "contains"
  | "doesNotContain"
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "between";

export interface FilterState {
  id: string;
  columnId: string;
  operator: FilterOperator;
  value: unknown;
}

export interface FilterActions {
  /** Add a blank filter by column id. The row will no-op match until a value is set. */
  addFilter: (columnId: string) => void;
  /** Add a filter that was fully configured out-of-band (e.g. by the selector's two-stage flow). */
  addConfiguredFilter: (filter: Omit<FilterState, "id">) => void;
  removeFilter: (id: string) => void;
  updateOperator: (id: string, operator: FilterOperator) => void;
  updateValue: (id: string, value: unknown) => void;
  clearAll: () => void;
}
