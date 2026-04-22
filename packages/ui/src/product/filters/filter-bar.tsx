"use client";

import * as React from "react";

import { Button } from "../../primitives/button";
import { tv } from "../../utils/tv";

import { FilterPill } from "./filter-pill";
import { FilterSelector } from "./filter-selector";
import type { ColumnConfig, FilterActions, FilterState } from "./types";

const styles = tv({
  slots: {
    root: "flex flex-wrap items-center gap-s-2",
    trailing: "ml-auto flex items-center gap-s-2",
  },
});

export interface FilterBarProps<TRow> {
  columns: ColumnConfig<TRow>[];
  filters: FilterState[];
  actions: FilterActions;
  /** Hide the "Clear all" affordance. Defaults to shown when any filter exists. */
  showClearAll?: boolean;
  /** Slot rendered after the trailing Clear button (e.g. view switcher). */
  trailing?: React.ReactNode;
  className?: string;
}

export function FilterBar<TRow>({
  columns,
  filters,
  actions,
  showClearAll = true,
  trailing,
  className,
}: FilterBarProps<TRow>) {
  const columnById = React.useMemo(
    () => new Map(columns.map((c) => [c.id, c] as const)),
    [columns],
  );
  const slots = styles({});

  return (
    <div className={slots.root({ className })} role="toolbar" aria-label="Filters">
      {filters.map((f) => {
        const col = columnById.get(f.columnId);
        if (!col) return null;
        return (
          <FilterPill
            key={f.id}
            column={col}
            filter={f}
            onOperatorChange={(op) => actions.updateOperator(f.id, op)}
            onValueChange={(v) => actions.updateValue(f.id, v)}
            onRemove={() => actions.removeFilter(f.id)}
          />
        );
      })}
      <FilterSelector columns={columns} onAdd={actions.addConfiguredFilter} />
      {(showClearAll && filters.length > 0) || trailing ? (
        <div className={slots.trailing()}>
          {showClearAll && filters.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onPress={() => actions.clearAll()}
            >
              Clear all
            </Button>
          ) : null}
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
