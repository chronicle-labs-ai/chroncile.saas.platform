"use client";

import * as React from "react";
import { Plug, Plus } from "lucide-react";

import { Button } from "../primitives/button";
import { EmptyState } from "../primitives/empty-state";

/*
 * ConnectionEmpty — zero-state for the dashboard connections page.
 * Two flavors:
 *
 *   variant="empty"     → no connections at all (post-onboarding)
 *   variant="filtered"  → there are connections, but the active
 *                         filters/search hide them all
 *
 * Wraps the shared `<EmptyState>` primitive.
 */

export interface ConnectionEmptyProps {
  variant?: "empty" | "filtered";
  onAdd?: () => void;
  onClearFilters?: () => void;
  className?: string;
}

export function ConnectionEmpty({
  variant = "empty",
  onAdd,
  onClearFilters,
  className,
}: ConnectionEmptyProps) {
  if (variant === "filtered") {
    return (
      <EmptyState
        icon={<Plug strokeWidth={1.5} />}
        title="No connections match"
        description="Try removing a filter or clearing the search."
        actions={
          onClearFilters ? (
            <Button variant="secondary" size="sm" onPress={onClearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
        size="md"
        className={className}
      />
    );
  }

  return (
    <EmptyState
      icon={<Plug strokeWidth={1.5} />}
      title="No connections yet"
      description="Wire up your first source to start streaming events into Chronicle."
      actions={
        onAdd ? (
          <Button
            variant="primary"
            size="sm"
            onPress={onAdd}
            leadingIcon={<Plus className="size-3.5" strokeWidth={1.75} />}
          >
            Add your first connection
          </Button>
        ) : undefined
      }
      size="lg"
      className={className}
    />
  );
}
