import type { ColumnType, FilterOperator } from "./types";

export interface OperatorMeta {
  key: FilterOperator;
  /** Long label shown in the operator menu. */
  label: string;
  /** Short glyph shown inline on the filter pill. */
  pillLabel: string;
  /** Informs the value editor what shape to render. */
  arity: "single" | "multi" | "range" | "text";
}

export const OPERATORS: Record<FilterOperator, OperatorMeta> = {
  is: { key: "is", label: "is", pillLabel: "is", arity: "single" },
  isNot: {
    key: "isNot",
    label: "is not",
    pillLabel: "is not",
    arity: "single",
  },
  isAnyOf: {
    key: "isAnyOf",
    label: "is any of",
    pillLabel: "is any of",
    arity: "multi",
  },
  isNoneOf: {
    key: "isNoneOf",
    label: "is none of",
    pillLabel: "is none of",
    arity: "multi",
  },
  contains: {
    key: "contains",
    label: "contains",
    pillLabel: "contains",
    arity: "text",
  },
  doesNotContain: {
    key: "doesNotContain",
    label: "does not contain",
    pillLabel: "does not contain",
    arity: "text",
  },
  eq: { key: "eq", label: "equals", pillLabel: "=", arity: "single" },
  neq: {
    key: "neq",
    label: "does not equal",
    pillLabel: "\u2260",
    arity: "single",
  },
  gt: { key: "gt", label: "greater than", pillLabel: ">", arity: "single" },
  lt: { key: "lt", label: "less than", pillLabel: "<", arity: "single" },
  gte: {
    key: "gte",
    label: "greater than or equal",
    pillLabel: "\u2265",
    arity: "single",
  },
  lte: {
    key: "lte",
    label: "less than or equal",
    pillLabel: "\u2264",
    arity: "single",
  },
  between: {
    key: "between",
    label: "between",
    pillLabel: "between",
    arity: "range",
  },
};

export const OPERATORS_BY_TYPE: Record<ColumnType, FilterOperator[]> = {
  option: ["is", "isNot"],
  multiOption: ["isAnyOf", "isNoneOf"],
  text: ["contains", "doesNotContain", "is", "isNot"],
  number: ["eq", "neq", "gt", "lt", "gte", "lte", "between"],
};

export function defaultOperatorFor(type: ColumnType): FilterOperator {
  return OPERATORS_BY_TYPE[type][0];
}

export function defaultValueFor(
  type: ColumnType,
  operator: FilterOperator
): unknown {
  if (type === "multiOption") return [] as string[];
  if (type === "number" && operator === "between") {
    return [undefined, undefined] as [number | undefined, number | undefined];
  }
  return undefined;
}
