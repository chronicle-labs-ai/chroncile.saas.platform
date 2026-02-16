import type { Node, Edge } from "@xyflow/react";

/* ------------------------------------------------------------------ */
/*  Node config types (discriminated union by nodeType)                */
/* ------------------------------------------------------------------ */

export interface EventSourceConfig {
  dateRange: { start: string; end: string }; // ISO strings
  sourceFilter: string[]; // e.g. ["intercom", "stripe"]
  eventTypeFilter: string[]; // e.g. ["conversation.created"]
}

export interface FilterConfig {
  rules: FilterRule[];
}

export interface FilterRule {
  id: string;
  field: "source" | "event_type" | "actor_type" | "custom";
  operator: "equals" | "not_equals" | "contains" | "not_contains";
  value: string;
}

export type OutputType = "sse" | "webhook" | "file" | "console";
export type FileFormat = "jsonl" | "csv";

export interface OutputConfig {
  outputType: OutputType;
  /** For webhook: the relay target URL */
  webhookUrl: string;
  /** For file: the export format */
  fileFormat: FileFormat;
  /** Transform template for the event payload */
  transformTemplate: string; // Handlebars-style template
  /** Which fields to include in output */
  includedFields: string[];
}

export interface GeneratorConfig {
  sourceTypes: string[]; // which providers to generate from
  eventTypes: string[]; // which event types to generate
  count: number;
  intervalMs: number;
  variationLevel: number; // 0-1
}

/* ------------------------------------------------------------------ */
/*  SandboxNodeData — what lives inside data on each React Flow node  */
/* ------------------------------------------------------------------ */

export type SandboxNodeType =
  | "event-source"
  | "filter"
  | "output"
  | "generator";

export interface SandboxNodeBase {
  label: string;
  nodeType: SandboxNodeType;
  [key: string]: unknown;
}

export interface EventSourceNodeData extends SandboxNodeBase {
  nodeType: "event-source";
  config: EventSourceConfig;
}

export interface FilterNodeData extends SandboxNodeBase {
  nodeType: "filter";
  config: FilterConfig;
}

export interface OutputNodeData extends SandboxNodeBase {
  nodeType: "output";
  config: OutputConfig;
}

export interface GeneratorNodeData extends SandboxNodeBase {
  nodeType: "generator";
  config: GeneratorConfig;
}

export type SandboxNodeData =
  | EventSourceNodeData
  | FilterNodeData
  | OutputNodeData
  | GeneratorNodeData;

export type SandboxNode = Node<SandboxNodeData>;
export type SandboxEdge = Edge;

/* ------------------------------------------------------------------ */
/*  Sandbox entity                                                     */
/* ------------------------------------------------------------------ */

export type SandboxStatus = "draft" | "active" | "archived";

export interface Sandbox {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  status: SandboxStatus;
  nodes: SandboxNode[];
  edges: SandboxEdge[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/* ------------------------------------------------------------------ */
/*  Events flowing through the sandbox                                 */
/* ------------------------------------------------------------------ */

export interface SandboxEvent {
  event_id: string;
  sandbox_id: string;
  source: string;
  source_event_id?: string;
  event_type: string;
  occurred_at: string;
  ingested_at: string;
  subject?: {
    conversation_id?: string;
    ticket_id?: string;
    customer_id?: string;
  };
  actor?: {
    actor_type?: string;
    actor_id?: string;
    name?: string;
  };
  payload?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Agent actions recorded against events                              */
/* ------------------------------------------------------------------ */

export interface AgentAction {
  id: string;
  sandbox_id: string;
  agent_id: string;
  action_type: string;
  event_id: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  API payload helpers                                                */
/* ------------------------------------------------------------------ */

export interface CreateSandboxPayload {
  name: string;
  description: string;
}

export interface UpdateSandboxPayload {
  name?: string;
  description?: string;
  status?: SandboxStatus;
  nodes?: SandboxNode[];
  edges?: SandboxEdge[];
}
