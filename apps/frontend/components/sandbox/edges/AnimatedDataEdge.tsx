"use client";

import { memo, useContext, createContext, useMemo } from "react";
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import type { EdgeParticle } from "../useSandboxSimulation";

/* ------------------------------------------------------------------ */
/*  Context for passing simulation state into edges                    */
/* ------------------------------------------------------------------ */

export interface EdgeSimulationData {
  particles: EdgeParticle[];
  activeEdgeIds: Set<string>;
}

export const EdgeSimulationContext = createContext<EdgeSimulationData>({
  particles: [],
  activeEdgeIds: new Set(),
});

/* ------------------------------------------------------------------ */
/*  Animated data edge                                                 */
/* ------------------------------------------------------------------ */

function AnimatedDataEdgeInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const { particles, activeEdgeIds } = useContext(EdgeSimulationContext);

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const isActive = activeEdgeIds.has(id);
  const myParticles = useMemo(
    () => particles.filter((p) => p.edgeId === id),
    [particles, id]
  );

  return (
    <>
      {/* Base edge line */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: isActive ? "#00d4ff" : "#353c45",
          strokeWidth: isActive ? 2.5 : 2,
          transition: "stroke 200ms ease, stroke-width 200ms ease",
        }}
      />

      {/* Active glow line (underneath) */}
      {isActive && (
        <path
          d={edgePath}
          fill="none"
          stroke="#00d4ff"
          strokeWidth={6}
          strokeOpacity={0.15}
          style={{ filter: "blur(4px)" }}
        />
      )}

      {/* Particles traveling along the edge */}
      {myParticles.map((particle) => (
        <ParticleDot
          key={particle.id}
          path={edgePath}
          progress={particle.progress}
          color={particle.sourceColor}
        />
      ))}
    </>
  );
}

export const AnimatedDataEdge = memo(AnimatedDataEdgeInner);

/* ------------------------------------------------------------------ */
/*  Particle dot that follows an SVG path                              */
/* ------------------------------------------------------------------ */

function ParticleDot({
  path,
  progress,
  color,
}: {
  path: string;
  progress: number;
  color: string;
}) {
  const point = useMemo(() => {
    if (typeof document === "undefined") return null;
    try {
      const svgPath = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      svgPath.setAttribute("d", path);
      const length = svgPath.getTotalLength();
      const pt = svgPath.getPointAtLength(
        Math.min(1, Math.max(0, progress)) * length
      );
      return { x: pt.x, y: pt.y };
    } catch {
      return null;
    }
  }, [path, progress]);

  if (!point) return null;

  return (
    <>
      {/* Glow */}
      <circle
        cx={point.x}
        cy={point.y}
        r={8}
        fill={color}
        opacity={0.2}
        style={{ filter: "blur(4px)" }}
      />
      {/* Core dot */}
      <circle
        cx={point.x}
        cy={point.y}
        r={4}
        fill={color}
        opacity={0.9}
      />
      {/* Bright center */}
      <circle
        cx={point.x}
        cy={point.y}
        r={1.5}
        fill="#ffffff"
        opacity={0.7}
      />
    </>
  );
}
