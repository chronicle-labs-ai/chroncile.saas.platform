"use client";

import * as React from "react";
import { Layers } from "lucide-react";

import { cx } from "../utils/cx";
import {
  Avatar,
  AvatarFallback,
  deriveInitials,
} from "../primitives/avatar";
import { RAIL_HANDLE_CLASSNAME, useRailResize } from "../layout/use-rail-resize";

import { AgentCompanyMark } from "./agent-company-mark";
import { FRAMEWORK_META } from "./framework-meta";
import type { AgentFramework, AgentSummary } from "./types";

/*
 * AgentsFacetRail — right-edge filter rail for the Linear-style
 * agents manager. Mirrors `DatasetFacetRail` in shape and gesture so
 * both surfaces feel like the same product.
 *
 * Three pill-tabs: Frameworks · Owners · Categories. Each tab shows
 * a compact list of facets with counts; clicking one toggles the
 * corresponding filter on the parent.
 *
 * Resize uses the shared `useRailResize` hook; the rail is hidden
 * below `xl` so the manager stays usable on narrower screens.
 */

type FacetTab = "framework" | "owners" | "categories";

export interface AgentsFacetRailProps {
  agents: readonly AgentSummary[];
  selectedFrameworks: readonly AgentFramework[];
  onFrameworkToggle: (framework: AgentFramework) => void;
  selectedOwners: readonly string[];
  onOwnerToggle: (owner: string) => void;
  selectedCategories: readonly string[];
  onCategoryToggle: (category: string) => void;
  width: number;
  onWidthChange: (next: number) => void;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
}

export function AgentsFacetRail({
  agents,
  selectedFrameworks,
  onFrameworkToggle,
  selectedOwners,
  onOwnerToggle,
  selectedCategories,
  onCategoryToggle,
  width,
  onWidthChange,
  minWidth = 280,
  maxWidth = 560,
  className,
}: AgentsFacetRailProps) {
  const [tab, setTab] = React.useState<FacetTab>("framework");
  const facets = React.useMemo(() => buildAgentFacets(agents), [agents]);
  const selectedFrameworkSet = React.useMemo(
    () => new Set(selectedFrameworks),
    [selectedFrameworks]
  );
  const selectedOwnerSet = React.useMemo(
    () => new Set(selectedOwners),
    [selectedOwners]
  );
  const selectedCategorySet = React.useMemo(
    () => new Set(selectedCategories),
    [selectedCategories]
  );
  const { dragging, handleProps } = useRailResize({
    width,
    onWidthChange,
    minWidth,
    maxWidth,
  });

  return (
    <aside
      className={cx(
        "relative hidden shrink-0 self-stretch overflow-hidden border-l border-hairline bg-l-surface-bar p-3 xl:flex xl:flex-col",
        dragging
          ? null
          : "transition-[width] duration-200 ease-out motion-reduce:transition-none",
        className
      )}
      style={{ width }}
    >
      <div
        {...handleProps}
        aria-label="Resize facets panel"
        className={RAIL_HANDLE_CLASSNAME}
      />
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-pill border border-l-border-faint bg-l-wash-1 p-1">
        {(
          [
            ["framework", "Frameworks"],
            ["owners", "Owners"],
            ["categories", "Categories"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            data-active={tab === value || undefined}
            onClick={() => setTab(value)}
            className={cx(
              "h-8 rounded-pill px-3 text-[12px] font-medium text-l-ink-dim transition-[background-color,color] duration-fast",
              "hover:bg-l-wash-3 hover:text-l-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40",
              "data-[active=true]:bg-l-wash-5 data-[active=true]:text-l-ink"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "framework" ? (
        <div className="flex flex-col gap-1">
          {facets.frameworks.map(({ framework, count }) => {
            const meta = FRAMEWORK_META[framework];
            return (
              <button
                key={framework}
                type="button"
                data-active={
                  selectedFrameworkSet.has(framework) || undefined
                }
                onClick={() => onFrameworkToggle(framework)}
                className={cx(
                  "flex h-10 items-center gap-2 rounded-md px-2 text-left text-[13px] text-l-ink-lo transition-[background-color,color] duration-fast",
                  "hover:bg-l-wash-3 hover:text-l-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40",
                  "data-[active=true]:bg-l-surface-selected data-[active=true]:text-l-ink"
                )}
              >
                <AgentCompanyMark
                  name={meta.companyName}
                  domain={meta.companyDomain}
                  size="xs"
                  fallbackIcon={meta.Icon}
                  alt={`${meta.label} logo`}
                />
                <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                <span className="font-mono text-[11px] tabular-nums text-l-ink-dim">
                  {count}
                </span>
              </button>
            );
          })}
          {facets.frameworks.length === 0 ? (
            <FacetEmpty label="No frameworks" />
          ) : null}
        </div>
      ) : null}

      {tab === "owners" ? (
        <div className="flex flex-col gap-1">
          {facets.owners.map(({ owner, count }) => (
            <button
              key={owner}
              type="button"
              data-active={selectedOwnerSet.has(owner) || undefined}
              onClick={() => onOwnerToggle(owner)}
              className={cx(
                "flex h-10 items-center gap-2 rounded-md px-2 text-left text-[13px] text-l-ink-lo transition-[background-color,color] duration-fast",
                "hover:bg-l-wash-3 hover:text-l-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40",
                "data-[active=true]:bg-l-surface-selected data-[active=true]:text-l-ink"
              )}
            >
              <Avatar size="xs">
                <AvatarFallback>{deriveInitials(owner)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate">{owner}</span>
              <span className="font-mono text-[11px] tabular-nums text-l-ink-dim">
                {count}
              </span>
            </button>
          ))}
          {facets.owners.length === 0 ? (
            <FacetEmpty label="No owners" />
          ) : null}
        </div>
      ) : null}

      {tab === "categories" ? (
        <div className="flex flex-col gap-1">
          {facets.categories.map(({ category, count }) => (
            <button
              key={category}
              type="button"
              data-active={selectedCategorySet.has(category) || undefined}
              onClick={() => onCategoryToggle(category)}
              className={cx(
                "flex h-10 items-center gap-2 rounded-md px-2 text-left text-[13px] text-l-ink-lo transition-[background-color,color] duration-fast",
                "hover:bg-l-wash-3 hover:text-l-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40",
                "data-[active=true]:bg-l-surface-selected data-[active=true]:text-l-ink"
              )}
            >
              <Layers
                className="size-3.5 text-l-ink-dim"
                strokeWidth={1.75}
              />
              <span className="min-w-0 flex-1 truncate">{category}</span>
              <span className="font-mono text-[11px] tabular-nums text-l-ink-dim">
                {count}
              </span>
            </button>
          ))}
          {facets.categories.length === 0 ? (
            <FacetEmpty label="No categories" />
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

function FacetEmpty({ label }: { label: string }) {
  return (
    <div className="px-2 py-3 font-sans text-[12px] text-l-ink-dim">
      {label}
    </div>
  );
}

interface FrameworkFacet {
  framework: AgentFramework;
  count: number;
}

interface OwnerFacet {
  owner: string;
  count: number;
}

interface CategoryFacet {
  category: string;
  count: number;
}

export function buildAgentFacets(agents: readonly AgentSummary[]): {
  frameworks: readonly FrameworkFacet[];
  owners: readonly OwnerFacet[];
  categories: readonly CategoryFacet[];
} {
  const frameworkCounts = new Map<AgentFramework, number>();
  const ownerCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  for (const agent of agents) {
    frameworkCounts.set(
      agent.framework,
      (frameworkCounts.get(agent.framework) ?? 0) + 1
    );
    if (agent.owner) {
      ownerCounts.set(agent.owner, (ownerCounts.get(agent.owner) ?? 0) + 1);
    }
    if (agent.category) {
      categoryCounts.set(
        agent.category,
        (categoryCounts.get(agent.category) ?? 0) + 1
      );
    }
  }
  return {
    frameworks: Array.from(frameworkCounts, ([framework, count]) => ({
      framework,
      count,
    }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          FRAMEWORK_META[a.framework].label.localeCompare(
            FRAMEWORK_META[b.framework].label
          )
      )
      .slice(0, 8),
    owners: Array.from(ownerCounts, ([owner, count]) => ({ owner, count }))
      .sort((a, b) => b.count - a.count || a.owner.localeCompare(b.owner))
      .slice(0, 8),
    categories: Array.from(categoryCounts, ([category, count]) => ({
      category,
      count,
    }))
      .sort(
        (a, b) => b.count - a.count || a.category.localeCompare(b.category)
      )
      .slice(0, 8),
  };
}
