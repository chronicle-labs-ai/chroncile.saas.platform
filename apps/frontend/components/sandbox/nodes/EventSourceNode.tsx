"use client";

import { memo, useContext } from "react";
import type { NodeProps } from "@xyflow/react";
import type { EventSourceNodeData } from "../types";
import { BaseNode } from "./BaseNode";
import { SimulationContext } from "../SimulationContext";

function EventSourceNodeInner({ id, data, selected }: NodeProps & { data: EventSourceNodeData }) {
  const { nodeActivity } = useContext(SimulationContext);
  const activity = nodeActivity[id];
  const { config } = data;
  const sourceCount = config.sourceFilter.length;
  const typeCount = config.eventTypeFilter.length;

  const hasDateRange = config.dateRange.start && config.dateRange.end;

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <BaseNode
      nodeType="event-source"
      label={data.label}
      selected={selected}
      hasInput={false}
      hasOutput={true}
      activity={activity}
    >
      <div className="space-y-1.5">
        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <svg
            className="w-3 h-3 text-data shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
            />
          </svg>
          <span className="font-mono text-[10px] text-secondary tabular-nums">
            {hasDateRange
              ? `${formatDate(config.dateRange.start)} → ${formatDate(config.dateRange.end)}`
              : "All time"}
          </span>
        </div>

        {/* Filters summary */}
        <div className="flex items-center gap-2">
          {sourceCount > 0 && (
            <span className="badge badge--nominal text-[9px] py-0.5">
              {sourceCount} source{sourceCount !== 1 ? "s" : ""}
            </span>
          )}
          {typeCount > 0 && (
            <span className="badge badge--nominal text-[9px] py-0.5">
              {typeCount} type{typeCount !== 1 ? "s" : ""}
            </span>
          )}
          {sourceCount === 0 && typeCount === 0 && (
            <span className="font-mono text-[10px] text-tertiary">
              No filters
            </span>
          )}
        </div>

        {/* Live activity */}
        {activity && activity.active && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-data animate-pulse" />
            <span className="font-mono text-[9px] text-data tabular-nums">
              Emitting events
            </span>
          </div>
        )}
      </div>
    </BaseNode>
  );
}

export const EventSourceNode = memo(EventSourceNodeInner);
