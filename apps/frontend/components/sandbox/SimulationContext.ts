"use client";

import { createContext } from "react";
import type { NodeActivity } from "./useSandboxSimulation";

export interface SimulationContextValue {
  nodeActivity: Record<string, NodeActivity>;
}

export const SimulationContext = createContext<SimulationContextValue>({
  nodeActivity: {},
});
