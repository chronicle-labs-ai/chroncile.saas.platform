"use client";

import * as React from "react";
import { Bot } from "lucide-react";

import { Button } from "../primitives/button";
import { EmptyState } from "../primitives/empty-state";

/*
 * AgentEmpty — zero-state for the agents manager. Three variants:
 *
 *   variant="empty"     → no agents registered yet
 *   variant="filtered"  → agents exist but the active filters/search
 *                         hide them all
 *   variant="detail"    → an agent has zero versions or zero runs
 *
 * Pattern mirrors `DatasetEmpty`. The "register" CTA is intentionally
 * read-only / link-out — agent registration happens server-side by
 * publishing a manifest, not from the dashboard.
 */

export interface AgentEmptyProps {
  variant?: "empty" | "filtered" | "detail";
  onClearFilters?: () => void;
  onLearnMore?: () => void;
  detailMessage?: React.ReactNode;
  className?: string;
}

export function AgentEmpty({
  variant = "empty",
  onClearFilters,
  onLearnMore,
  detailMessage,
  className,
}: AgentEmptyProps) {
  if (variant === "filtered") {
    return (
      <EmptyState
        icon={<Bot strokeWidth={1.5} />}
        title="No agents match"
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
        icon={<Bot strokeWidth={1.5} />}
        title="No runs recorded yet"
        description={
          detailMessage ??
          "Once your agent runs against this version, the registry will start recording manifests, run records, and provenance hashes here."
        }
        size="md"
        className={className}
      />
    );
  }

  return (
    <EmptyState
      icon={<Bot strokeWidth={1.5} />}
      title="No agents registered yet"
      description="Wrap an agent with the artifactory SDK and publish your first manifest. Each name@version becomes an immutable artifact, and every run is recorded against it."
      actions={
        onLearnMore ? (
          <Button
            variant="secondary"
            size="sm"
            onPress={onLearnMore}
          >
            Read the SDK guide
          </Button>
        ) : undefined
      }
      size="lg"
      className={className}
    />
  );
}
