"use client";

import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  type IsValidConnection,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { SandboxNode, SandboxEdge } from "./types";
import { CANVAS_THEME } from "./constants";
import { EventSourceNode } from "./nodes/EventSourceNode";
import { FilterNode } from "./nodes/FilterNode";
import { OutputNode } from "./nodes/OutputNode";
import { GeneratorNode } from "./nodes/GeneratorNode";
import { AnimatedDataEdge, EdgeSimulationContext, type EdgeSimulationData } from "./edges/AnimatedDataEdge";
import { SimulationContext, type SimulationContextValue } from "./SimulationContext";

/* ------------------------------------------------------------------ */
/*  Register custom node & edge types                                  */
/* ------------------------------------------------------------------ */

const nodeTypes: NodeTypes = {
  "event-source": EventSourceNode as unknown as NodeTypes[string],
  filter: FilterNode as unknown as NodeTypes[string],
  output: OutputNode as unknown as NodeTypes[string],
  generator: GeneratorNode as unknown as NodeTypes[string],
};

const edgeTypes: EdgeTypes = {
  animated: AnimatedDataEdge as unknown as EdgeTypes[string],
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface SandboxCanvasProps {
  nodes: SandboxNode[];
  edges: SandboxEdge[];
  onNodesChange: OnNodesChange<SandboxNode>;
  onEdgesChange: OnEdgesChange<SandboxEdge>;
  onConnect: (connection: Connection) => void;
  onNodeClick: (nodeId: string) => void;
  onPaneClick: () => void;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  simulationCtx: SimulationContextValue;
  edgeSimCtx: EdgeSimulationData;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function SandboxCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onPaneClick,
  onDrop,
  onDragOver,
  simulationCtx,
  edgeSimCtx,
}: SandboxCanvasProps) {
  const handleNodeClick: NodeMouseHandler<SandboxNode> = useCallback(
    (_event, node) => {
      onNodeClick(node.id);
    },
    [onNodeClick]
  );

  const isValidConnection: IsValidConnection = useCallback(
    (connection) => {
      if (connection.source === connection.target) return false;
      return true;
    },
    []
  );

  return (
    <div className="w-full h-full" style={{ background: CANVAS_THEME.background }}>
      <SimulationContext.Provider value={simulationCtx}>
        <EdgeSimulationContext.Provider value={edgeSimCtx}>
          <ReactFlow<SandboxNode, SandboxEdge>
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onPaneClick={onPaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            isValidConnection={isValidConnection}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              type: "animated",
              style: { stroke: CANVAS_THEME.edgeColor, strokeWidth: 2 },
            }}
            style={{ background: CANVAS_THEME.background }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color={CANVAS_THEME.dotColor}
            />
            <Controls
              showInteractive={false}
              style={{
                background: "#0f1215",
                border: "1px solid #252a30",
                borderRadius: 6,
              }}
            />
            <MiniMap
              nodeColor={() => "#00d4ff"}
              maskColor={CANVAS_THEME.minimapMask}
              style={{
                background: CANVAS_THEME.minimapBg,
                border: "1px solid #252a30",
                borderRadius: 6,
              }}
            />
          </ReactFlow>
        </EdgeSimulationContext.Provider>
      </SimulationContext.Provider>
    </div>
  );
}
