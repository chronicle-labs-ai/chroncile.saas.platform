"use client";

import { memo, useContext } from "react";
import type { NodeProps } from "@xyflow/react";
import type { GeneratorNodeData } from "../types";
import { BaseNode } from "./BaseNode";
import { SimulationContext } from "../SimulationContext";
import { PROVIDER_CATALOG, RATE_PRESETS } from "../constants";

function GeneratorNodeInner({ id, data, selected }: NodeProps & { data: GeneratorNodeData }) {
  const { nodeActivity } = useContext(SimulationContext);
  const activity = nodeActivity[id];
  const { config } = data;

  // Find matching rate preset label or fall back to raw display
  const ratePreset = RATE_PRESETS.find((r) => r.ms === config.intervalMs);
  const rateDisplay = ratePreset
    ? ratePreset.label
    : config.intervalMs >= 1000
    ? `${(config.intervalMs / 1000).toFixed(1)}s`
    : `${config.intervalMs}ms`;

  return (
    <BaseNode
      nodeType="generator"
      label={data.label}
      selected={selected}
      hasInput={false}
      hasOutput={true}
      activity={activity}
    >
      <div className="space-y-1.5">
        {/* Source provider chips */}
        {config.sourceTypes && config.sourceTypes.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {config.sourceTypes.map((src) => {
              const p = PROVIDER_CATALOG[src];
              if (!p) return null;
              return (
                <span
                  key={src}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono text-[9px]"
                  style={{
                    borderColor: `${p.color}40`,
                    background: `${p.color}15`,
                    color: p.color,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: p.color }}
                  />
                  {p.label}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="font-mono text-[9px] text-tertiary">
            All providers
          </div>
        )}

        {/* Generation params */}
        <div className="flex items-center gap-1.5">
          <svg
            className="w-3 h-3 text-caution shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
            />
          </svg>
          <span className="font-mono text-[10px] text-secondary">
            {config.count} events @ {rateDisplay}
          </span>
        </div>

        {/* Variation level */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-tertiary">Variation</span>
          <div className="flex-1 h-1 bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${config.variationLevel * 100}%`,
                background: "#ffb800",
              }}
            />
          </div>
          <span className="font-mono text-[10px] text-caution tabular-nums">
            {Math.round(config.variationLevel * 100)}%
          </span>
        </div>

        {/* Live generation status */}
        {activity && activity.active && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-caution animate-pulse" />
            <span className="font-mono text-[9px] text-caution tabular-nums">
              Generating ({activity.total} emitted)
            </span>
          </div>
        )}
      </div>
    </BaseNode>
  );
}

export const GeneratorNode = memo(GeneratorNodeInner);
