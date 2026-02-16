"use client";

import { memo, useContext } from "react";
import type { NodeProps } from "@xyflow/react";
import type { OutputNodeData } from "../types";
import { BaseNode } from "./BaseNode";
import { SimulationContext } from "../SimulationContext";
import { OUTPUT_TYPES } from "../constants";

const TYPE_ICONS: Record<string, JSX.Element> = {
  sse: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  webhook: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  ),
  file: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  console: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
};

function OutputNodeInner({ id, data, selected }: NodeProps & { data: OutputNodeData }) {
  const { nodeActivity } = useContext(SimulationContext);
  const activity = nodeActivity[id];
  const { config } = data;

  const outputTypeInfo = OUTPUT_TYPES.find((t) => t.value === config.outputType) ?? OUTPUT_TYPES[0];

  return (
    <BaseNode
      nodeType="output"
      label={data.label}
      selected={selected}
      hasInput={true}
      hasOutput={false}
      activity={activity}
    >
      <div className="space-y-1.5">
        {/* Output type badge */}
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded font-mono text-[9px] font-medium uppercase"
            style={{
              background: "#1a0a0a",
              color: "#ff3b3b",
              border: "1px solid #661717",
            }}
          >
            {TYPE_ICONS[config.outputType] ?? TYPE_ICONS.sse}
            {outputTypeInfo.label}
          </span>
          {config.outputType === "file" && (
            <span className="font-mono text-[9px] text-tertiary uppercase">
              {config.fileFormat}
            </span>
          )}
        </div>

        {/* Canonical URL preview or webhook target */}
        {config.outputType === "webhook" ? (
          config.webhookUrl ? (
            <div className="flex items-center gap-1.5">
              <span className="text-critical shrink-0">
                {TYPE_ICONS.webhook}
              </span>
              <span className="font-mono text-[10px] text-secondary truncate">
                {config.webhookUrl}
              </span>
            </div>
          ) : (
            <span className="font-mono text-[10px] text-tertiary">
              No relay target set
            </span>
          )
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] text-data truncate opacity-70">
              canonical.stream/.../{id}/{config.outputType === "file" ? `export.${config.fileFormat}` : config.outputType === "console" ? "log" : "sse"}
            </span>
          </div>
        )}

        {/* Live received count */}
        {activity && activity.active && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-critical animate-pulse" />
            <span className="font-mono text-[9px] text-critical tabular-nums">
              Receiving events
            </span>
          </div>
        )}
      </div>
    </BaseNode>
  );
}

export const OutputNode = memo(OutputNodeInner);
