"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { SandboxNodeType } from "../types";
import { NODE_COLORS } from "../constants";
import type { NodeActivity } from "../useSandboxSimulation";

interface BaseNodeProps {
  nodeType: SandboxNodeType;
  label: string;
  selected?: boolean;
  children: React.ReactNode;
  hasInput?: boolean;
  hasOutput?: boolean;
  activity?: NodeActivity;
}

function BaseNodeInner({
  nodeType,
  label,
  selected,
  children,
  hasInput = true,
  hasOutput = true,
  activity,
}: BaseNodeProps) {
  const colors = NODE_COLORS[nodeType];
  const isActive = activity?.active ?? false;

  return (
    <div
      className="relative transition-all duration-fast"
      style={{
        background: "#0f1215",
        border: `1px solid ${
          isActive ? colors.accent : selected ? colors.accent : "#252a30"
        }`,
        borderRadius: 6,
        minWidth: 220,
        maxWidth: 280,
        boxShadow: isActive
          ? `0 0 20px ${colors.accent}44, 0 0 6px ${colors.accent}33`
          : selected
          ? `0 0 16px ${colors.accent}33, 0 0 4px ${colors.accent}22`
          : "none",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          background: colors.bg,
          borderBottom: `1px solid ${colors.dim}`,
          borderRadius: "5px 5px 0 0",
        }}
      >
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: colors.accent,
            boxShadow: isActive
              ? `0 0 10px ${colors.accent}, 0 0 4px ${colors.accent}`
              : `0 0 6px ${colors.accent}`,
            animation: isActive ? "pulse 0.8s ease-in-out infinite" : "none",
          }}
        />
        <span
          className="font-mono text-[10px] font-medium tracking-wider uppercase"
          style={{ color: colors.accent }}
        >
          {colors.label}
        </span>

        {/* Activity counter */}
        {activity && activity.total > 0 && (
          <span
            className="ml-auto font-mono text-[9px] tabular-nums px-1.5 py-0.5 rounded"
            style={{
              background: `${colors.accent}15`,
              color: colors.accent,
              border: `1px solid ${colors.accent}30`,
            }}
          >
            {activity.total}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2.5">{children}</div>

      {/* Title + throughput */}
      <div
        className="px-3 py-1.5 flex items-center gap-2"
        style={{ borderTop: "1px solid #1a1d21" }}
      >
        <span className="text-xs font-medium text-primary truncate flex-1">
          {label}
        </span>
        {isActive && (
          <span
            className="font-mono text-[9px] tabular-nums"
            style={{ color: colors.accent }}
          >
            {nodeType === "filter" && activity
              ? `${activity.passed}✓ ${activity.rejected}✗`
              : "●"}
          </span>
        )}
      </div>

      {/* Handles */}
      {hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            width: isActive ? 12 : 10,
            height: isActive ? 12 : 10,
            background: isActive ? colors.accent : "#141719",
            border: `2px solid ${colors.accent}`,
            top: "50%",
            transition: "all 200ms ease",
            boxShadow: isActive ? `0 0 8px ${colors.accent}` : "none",
          }}
        />
      )}
      {hasOutput && (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            width: isActive ? 12 : 10,
            height: isActive ? 12 : 10,
            background: isActive ? colors.accent : "#141719",
            border: `2px solid ${colors.accent}`,
            top: "50%",
            transition: "all 200ms ease",
            boxShadow: isActive ? `0 0 8px ${colors.accent}` : "none",
          }}
        />
      )}
    </div>
  );
}

export const BaseNode = memo(BaseNodeInner);
