"use client";

/*
 * useDataTableFilters — library-agnostic filter state for Chronicle data
 * tables. Returns the filter list, mutation actions, and a pure
 * `predicate(row)` that consumers can pass to `Array.prototype.filter` or
 * a server-side query builder.
 *
 * Controlled mode: pass `filters` + `onFiltersChange`.
 * Uncontrolled mode: pass `initialFilters` (or nothing).
 */

import * as React from "react";

import { defaultOperatorFor, defaultValueFor } from "./operators";
import type {
  ColumnConfig,
  ColumnType,
  FilterActions,
  FilterOperator,
  FilterState,
} from "./types";

let idCounter = 0;
function makeFilterId(): string {
  idCounter += 1;
  return `flt_${idCounter.toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export interface UseDataTableFiltersOptions<TRow> {
  columns: ColumnConfig<TRow>[];
  initialFilters?: FilterState[];
  /** Controlled state. Pass with `onFiltersChange`. */
  filters?: FilterState[];
  onFiltersChange?: (next: FilterState[]) => void;
}

export interface UseDataTableFiltersResult<TRow> {
  filters: FilterState[];
  actions: FilterActions;
  predicate: (row: TRow) => boolean;
  columnById: Map<string, ColumnConfig<TRow>>;
}

export function useDataTableFilters<TRow>(
  options: UseDataTableFiltersOptions<TRow>,
): UseDataTableFiltersResult<TRow> {
  const {
    columns,
    initialFilters,
    filters: controlled,
    onFiltersChange,
  } = options;

  const [internal, setInternal] = React.useState<FilterState[]>(
    initialFilters ?? [],
  );
  const isControlled = controlled != null;
  const filters = isControlled ? controlled : internal;

  const controlledRef = React.useRef(controlled);
  controlledRef.current = controlled;
  const onChangeRef = React.useRef(onFiltersChange);
  onChangeRef.current = onFiltersChange;

  const update = React.useCallback(
    (updater: (prev: FilterState[]) => FilterState[]) => {
      if (controlledRef.current != null) {
        onChangeRef.current?.(updater(controlledRef.current));
      } else {
        setInternal(updater);
      }
    },
    [],
  );

  const columnById = React.useMemo(() => {
    const m = new Map<string, ColumnConfig<TRow>>();
    for (const c of columns) m.set(c.id, c);
    return m;
  }, [columns]);

  const actions = React.useMemo<FilterActions>(
    () => ({
      addFilter: (columnId) => {
        const col = columnById.get(columnId);
        if (!col) return;
        const operator = defaultOperatorFor(col.type);
        update((prev) => [
          ...prev,
          {
            id: makeFilterId(),
            columnId,
            operator,
            value: defaultValueFor(col.type, operator),
          },
        ]);
      },
      addConfiguredFilter: (filter) => {
        if (!columnById.has(filter.columnId)) return;
        update((prev) => [
          ...prev,
          { id: makeFilterId(), ...filter },
        ]);
      },
      removeFilter: (id) =>
        update((prev) => prev.filter((f) => f.id !== id)),
      updateOperator: (id, operator) =>
        update((prev) =>
          prev.map((f) => {
            if (f.id !== id) return f;
            const col = columnById.get(f.columnId);
            if (!col) return { ...f, operator };
            return {
              ...f,
              operator,
              value: coerceValueForOperator(
                col.type,
                f.operator,
                operator,
                f.value,
              ),
            };
          }),
        ),
      updateValue: (id, value) =>
        update((prev) =>
          prev.map((f) => (f.id === id ? { ...f, value } : f)),
        ),
      clearAll: () => update(() => []),
    }),
    [columnById, update],
  );

  const predicate = React.useCallback(
    (row: TRow): boolean => {
      for (const f of filters) {
        const col = columnById.get(f.columnId);
        if (!col) continue;
        if (!evaluate(col, f, row)) return false;
      }
      return true;
    },
    [filters, columnById],
  );

  return { filters, actions, predicate, columnById };
}

// -- pure evaluation helpers (exported for tests) ---------------------------

export function coerceValueForOperator(
  type: ColumnType,
  prev: FilterOperator,
  next: FilterOperator,
  value: unknown,
): unknown {
  if (type === "multiOption") return Array.isArray(value) ? value : [];
  if (type === "number") {
    if (next === "between") {
      if (Array.isArray(value)) return value;
      return [value, undefined];
    }
    if (prev === "between") {
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return value;
}

export function evaluateFilter<TRow>(
  col: ColumnConfig<TRow>,
  f: FilterState,
  row: TRow,
): boolean {
  return evaluate(col, f, row);
}

function evaluate<TRow>(
  col: ColumnConfig<TRow>,
  f: FilterState,
  row: TRow,
): boolean {
  const raw = col.accessor(row);
  switch (col.type) {
    case "option":
      return evalOption(raw, f.operator, f.value as string | undefined);
    case "multiOption":
      return evalMultiOption(
        raw,
        f.operator,
        Array.isArray(f.value) ? (f.value as string[]) : [],
      );
    case "text":
      return evalText(raw, f.operator, f.value as string | undefined);
    case "number":
      return evalNumber(raw, f.operator, f.value);
    default:
      return true;
  }
}

function evalOption(
  raw: unknown,
  op: FilterOperator,
  target: string | undefined,
): boolean {
  if (target == null || target === "") return true;
  const value = raw == null ? "" : String(raw);
  const eq = value === target;
  return op === "isNot" ? !eq : eq;
}

function evalMultiOption(
  raw: unknown,
  op: FilterOperator,
  targets: string[],
): boolean {
  if (!targets.length) return true;
  const items = Array.isArray(raw) ? raw.map(String) : [String(raw ?? "")];
  const hasAny = items.some((v) => targets.includes(v));
  return op === "isNoneOf" ? !hasAny : hasAny;
}

function evalText(
  raw: unknown,
  op: FilterOperator,
  target: string | undefined,
): boolean {
  const q = (target ?? "").trim().toLowerCase();
  if (!q) return true;
  const value = raw == null ? "" : String(raw).toLowerCase();
  const includes = value.includes(q);
  switch (op) {
    case "contains":
      return includes;
    case "doesNotContain":
      return !includes;
    case "is":
      return value === q;
    case "isNot":
      return value !== q;
    default:
      return true;
  }
}

function evalNumber(
  raw: unknown,
  op: FilterOperator,
  target: unknown,
): boolean {
  const value = Number(raw);
  if (Number.isNaN(value)) return target == null;

  if (op === "between") {
    const [lo, hi] = Array.isArray(target)
      ? (target as [unknown, unknown])
      : [undefined, undefined];
    const loN = toFiniteOrUndef(lo);
    const hiN = toFiniteOrUndef(hi);
    if (loN == null && hiN == null) return true;
    if (loN != null && value < loN) return false;
    if (hiN != null && value > hiN) return false;
    return true;
  }

  const t = toFiniteOrUndef(target);
  if (t == null) return true;
  switch (op) {
    case "eq":
      return value === t;
    case "neq":
      return value !== t;
    case "gt":
      return value > t;
    case "lt":
      return value < t;
    case "gte":
      return value >= t;
    case "lte":
      return value <= t;
    default:
      return true;
  }
}

function toFiniteOrUndef(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
