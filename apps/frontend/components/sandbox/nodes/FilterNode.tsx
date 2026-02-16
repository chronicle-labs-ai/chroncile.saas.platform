"use client";

import { memo, useContext } from "react";
import type { NodeProps } from "@xyflow/react";
import type { FilterNodeData } from "../types";
import { BaseNode } from "./BaseNode";
import { SimulationContext } from "../SimulationContext";

function FilterNodeInner({ id, data, selected }: NodeProps & { data: FilterNodeData }) {
  const { nodeActivity } = useContext(SimulationContext);
  const activity = nodeActivity[id];
  const { config } = data;
  const ruleCount = config.rules.length;

  return (
    <BaseNode
      nodeType="filter"
      label={data.label}
      selected={selected}
      hasInput={true}
      hasOutput={true}
      activity={activity}
    >
      <div className="space-y-1.5">
        {ruleCount === 0 ? (
          <span className="font-mono text-[10px] text-tertiary">
            No rules configured
          </span>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <svg
                className="w-3 h-3 text-nominal shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"
                />
              </svg>
              <span className="font-mono text-[10px] text-secondary">
                {ruleCount} rule{ruleCount !== 1 ? "s" : ""}
              </span>
            </div>
            {/* Show first 2 rules */}
            {config.rules.slice(0, 2).map((rule) => (
              <div
                key={rule.id}
                className="font-mono text-[9px] text-tertiary truncate"
              >
                {rule.field} {rule.operator.replace("_", " ")} &quot;{rule.value}&quot;
              </div>
            ))}
            {ruleCount > 2 && (
              <span className="font-mono text-[9px] text-disabled">
                +{ruleCount - 2} more
              </span>
            )}
          </>
        )}

        {/* Live pass/reject counters */}
        {activity && activity.total > 0 && (
          <div className="flex items-center gap-3 pt-1 border-t border-border-dim">
            <span className="font-mono text-[9px] text-nominal tabular-nums">
              {activity.passed} passed
            </span>
            <span className="font-mono text-[9px] text-critical tabular-nums">
              {activity.rejected} rejected
            </span>
          </div>
        )}
      </div>
    </BaseNode>
  );
}

export const FilterNode = memo(FilterNodeInner);
