"use client";

import * as React from "react";
import { Database, Plus } from "lucide-react";

import { Button } from "../primitives/button";
import { EmptyState } from "../primitives/empty-state";

/*
 * DatasetEmpty — zero-state for the dataset manager. Two variants:
 *
 *   variant="empty"     → no datasets exist yet (post-onboarding)
 *   variant="filtered"  → datasets exist but the active filters/search
 *                         hide them all
 *   variant="detail"    → a specific dataset has zero traces yet
 *
 * Wraps the shared `<EmptyState>` primitive — same pattern as
 * `ConnectionEmpty`.
 */

export interface DatasetEmptyProps {
  variant?: "empty" | "filtered" | "detail";
  onCreate?: () => void;
  onClearFilters?: () => void;
  className?: string;
}

export function DatasetEmpty({
  variant = "empty",
  onCreate,
  onClearFilters,
  className,
}: DatasetEmptyProps) {
  if (variant === "filtered") {
    return (
      <EmptyState
        icon={<Database strokeWidth={1.5} />}
        title="No datasets match"
        description="Try removing a filter or clearing the search."
        actions={
          onClearFilters ? (
            <Button
              variant="secondary"
              size="sm"
              onPress={onClearFilters}
            >
              Clear filters
            </Button>
          ) : undefined
        }
        size="md"
        className={className}
      />
    );
  }

  if (variant === "detail") {
    return (
      <EmptyState
        icon={<Database strokeWidth={1.5} />}
        title="No traces in this dataset yet"
        description="Open the Timeline view and add traces from the inspector. They show up here automatically."
        size="md"
        className={className}
      />
    );
  }

  return (
    <EmptyState
      icon={<Database strokeWidth={1.5} />}
      title="No datasets yet"
      description="Create a dataset to start grouping traces for evals, training, replay, or review."
      actions={
        onCreate ? (
          <Button
            variant="primary"
            size="sm"
            onPress={onCreate}
            leadingIcon={<Plus className="size-3.5" strokeWidth={1.75} />}
          >
            New dataset
          </Button>
        ) : undefined
      }
      size="lg"
      className={className}
    />
  );
}
