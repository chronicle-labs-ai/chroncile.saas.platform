#!/usr/bin/env tsx
/*
 * inspect-fixtures — run every default seed against its schema and
 * print the exact path of every divergence. Useful when the dev
 * server logs `[seeds] X fixture failed schema validation` with an
 * opaque issues array.
 *
 * Run: `yarn workspace seeds tsx scripts/inspect-fixtures.ts`
 */

import {
  AgentSnapshotSchema,
  AgentSummarySchema,
  HashIndexEntrySchema,
} from "chronicle/schemas/agents";
import {
  ConnectionBackfillRecordSchema,
  ConnectionDeliverySchema,
  ConnectionEventTypeSubSchema,
  ConnectionSchema,
} from "chronicle/schemas/connections";
import {
  DatasetSchema,
  DatasetSnapshotSchema,
  StreamTimelineEventSchema,
} from "chronicle/schemas/datasets";
/* Import directly from the data files to dodge `ui`'s storybook /
   boneyard transitive deps that don't resolve outside a bundler. */
import {
  agentsManagerSeed,
  agentSnapshotsByName,
  globalHashIndexSeed,
} from "../../ui/src/agents/data";
import {
  connectionBackfillsSeed,
  connectionDeliveriesSeed,
  connectionEventSubsSeed,
  connectionsSeed,
} from "../../ui/src/connections/data";
import {
  datasetsManagerSeed,
  datasetSnapshotsById,
} from "../../ui/src/datasets/data";
import {
  datasetsSeed as uiTimelineDatasetsSeed,
  streamTimelineSeed as uiStreamTimelineSeed,
} from "../../ui/src/stream-timeline/data";
import { chronicleDemoAgentsSeed } from "../src/agents/chronicle-demo";
import { supportFlowAgentsSeed } from "../src/agents/support-flow";
import { chronicleDemoBacktestsSeed } from "../src/backtests/chronicle-demo";
import { chronicleDemoConnectionsSeed } from "../src/connections/chronicle-demo";
import { supportFlowConnectionsSeed } from "../src/connections/support-flow";
import { chronicleDemoDatasetsSeed } from "../src/datasets/chronicle-demo";
import { supportFlowDatasetsSeed } from "../src/datasets/support-flow";
import { chronicleDemoTimelineSeed } from "../src/timeline/chronicle-demo";
import { supportFlowTimelineSeed } from "../src/timeline/support-flow";
import { z } from "zod";

interface Probe {
  label: string;
  schema: z.ZodTypeAny;
  value: unknown;
}

const probes: Probe[] = [
  {
    label: "datasets:default datasets[]",
    schema: z.array(DatasetSchema),
    value: structuredClone(datasetsManagerSeed),
  },
  {
    label: "datasets:default snapshotsById",
    schema: z.record(DatasetSnapshotSchema),
    value: structuredClone(datasetSnapshotsById),
  },
  {
    label: "agents:default summaries",
    schema: z.array(AgentSummarySchema),
    value: structuredClone(agentsManagerSeed),
  },
  {
    label: "agents:default snapshotsByName",
    schema: z.record(AgentSnapshotSchema),
    value: structuredClone(agentSnapshotsByName),
  },
  {
    label: "agents:default hashIndex",
    schema: z.array(HashIndexEntrySchema),
    value: structuredClone(globalHashIndexSeed),
  },
  {
    label: "connections:default connections",
    schema: z.array(ConnectionSchema),
    value: structuredClone(connectionsSeed),
  },
  {
    label: "connections:default backfillsByConnection",
    schema: z.record(z.array(ConnectionBackfillRecordSchema)),
    value: structuredClone(connectionBackfillsSeed),
  },
  {
    label: "connections:default deliveriesByConnection",
    schema: z.record(z.array(ConnectionDeliverySchema)),
    value: structuredClone(connectionDeliveriesSeed),
  },
  {
    label: "connections:default eventSubsByConnection",
    schema: z.record(z.array(ConnectionEventTypeSubSchema)),
    value: structuredClone(connectionEventSubsSeed),
  },
  /* ── support-flow scenario probes (compose the per-domain seeds and
        validate the resulting payload as one block) ─────────────── */
  ...(() => {
    const conn = supportFlowConnectionsSeed.build();
    const agents = supportFlowAgentsSeed.build();
    const datasets = supportFlowDatasetsSeed.build();
    return [
      {
        label: "support-flow:connections connections",
        schema: z.array(ConnectionSchema),
        value: conn.connections,
      },
      {
        label: "support-flow:connections backfills",
        schema: z.record(z.array(ConnectionBackfillRecordSchema)),
        value: conn.backfillsByConnection,
      },
      {
        label: "support-flow:connections deliveries",
        schema: z.record(z.array(ConnectionDeliverySchema)),
        value: conn.deliveriesByConnection,
      },
      {
        label: "support-flow:connections eventSubs",
        schema: z.record(z.array(ConnectionEventTypeSubSchema)),
        value: conn.eventSubsByConnection,
      },
      {
        label: "support-flow:agents summaries",
        schema: z.array(AgentSummarySchema),
        value: agents.summaries,
      },
      {
        label: "support-flow:agents snapshotsByName",
        schema: z.record(AgentSnapshotSchema),
        value: agents.snapshotsByName,
      },
      {
        label: "support-flow:agents hashIndex",
        schema: z.array(HashIndexEntrySchema),
        value: agents.hashIndex,
      },
      {
        label: "support-flow:datasets datasets",
        schema: z.array(DatasetSchema),
        value: datasets.datasets,
      },
      {
        label: "support-flow:datasets snapshotsById",
        schema: z.record(DatasetSnapshotSchema),
        value: datasets.snapshotsById,
      },
    ];
  })(),
  /* ── timeline domain probes ────────────────────────────── */
  /* The default seed imports `ui` which transitively pulls
     boneyard's `./react` entry — fine inside Next/Vite, broken
     under bare tsx. Probe the underlying ui fixture directly. */
  {
    label: "timeline:default events (ui fixture)",
    schema: z.array(StreamTimelineEventSchema),
    value: structuredClone(uiStreamTimelineSeed),
  },
  {
    label: "timeline:default datasets (ui fixture)",
    schema: z.array(DatasetSchema),
    value: structuredClone(uiTimelineDatasetsSeed),
  },
  ...(() => {
    const sf = supportFlowTimelineSeed.build();
    return [
      {
        label: "timeline:support-flow events",
        schema: z.array(StreamTimelineEventSchema),
        value: sf.events,
      },
      {
        label: "timeline:support-flow datasets",
        schema: z.array(DatasetSchema),
        value: sf.datasets,
      },
    ];
  })(),
  /* ── chronicle-demo scenario probes (compose the per-domain seeds and
        validate the resulting payload as one block) ─────────────── */
  ...(() => {
    const conn = chronicleDemoConnectionsSeed.build();
    const agents = chronicleDemoAgentsSeed.build();
    const datasets = chronicleDemoDatasetsSeed.build();
    const timeline = chronicleDemoTimelineSeed.build();
    return [
      {
        label: "chronicle-demo:connections connections",
        schema: z.array(ConnectionSchema),
        value: conn.connections,
      },
      {
        label: "chronicle-demo:connections backfills",
        schema: z.record(z.array(ConnectionBackfillRecordSchema)),
        value: conn.backfillsByConnection,
      },
      {
        label: "chronicle-demo:connections deliveries",
        schema: z.record(z.array(ConnectionDeliverySchema)),
        value: conn.deliveriesByConnection,
      },
      {
        label: "chronicle-demo:connections eventSubs",
        schema: z.record(z.array(ConnectionEventTypeSubSchema)),
        value: conn.eventSubsByConnection,
      },
      {
        label: "chronicle-demo:agents summaries",
        schema: z.array(AgentSummarySchema),
        value: agents.summaries,
      },
      {
        label: "chronicle-demo:agents snapshotsByName",
        schema: z.record(AgentSnapshotSchema),
        value: agents.snapshotsByName,
      },
      {
        label: "chronicle-demo:agents hashIndex",
        schema: z.array(HashIndexEntrySchema),
        value: agents.hashIndex,
      },
      {
        label: "chronicle-demo:datasets datasets",
        schema: z.array(DatasetSchema),
        value: datasets.datasets,
      },
      {
        label: "chronicle-demo:datasets snapshotsById",
        schema: z.record(DatasetSnapshotSchema),
        value: datasets.snapshotsById,
      },
      {
        label: "chronicle-demo:timeline events",
        schema: z.array(StreamTimelineEventSchema),
        value: timeline.events,
      },
      {
        label: "chronicle-demo:timeline datasets",
        schema: z.array(DatasetSchema),
        value: timeline.datasets,
      },
    ];
  })(),
  /* ── backtests scenario probes — only the Chronicle-typed slices
        (`Dataset`, `DatasetSnapshot`, `AgentSummary`) have Zod
        schemas; the BacktestRecipe / Divergence / Metric shapes are
        UI-only types and rely on TypeScript at compile time.

        We only probe the `chronicle-demo` backtests seed here. The
        `default` and `support-flow` backtests seeds value-import
        from `"ui"` (which transitively pulls boneyard's `./react`
        entry — fine inside Next.js / Vite, broken under bare tsx).
        Their Chronicle-typed slices are already validated by the
        `default:*` and `support-flow:*` probes above, so there's
        nothing extra to learn from rebuilding them here. ─────── */
  ...(() => {
    const cd = chronicleDemoBacktestsSeed.build();
    return [
      {
        label: "chronicle-demo:backtests availableDatasets",
        schema: z.array(DatasetSchema),
        value: cd.availableDatasets,
      },
      {
        label: "chronicle-demo:backtests availableDatasetSnapshots",
        schema: z.record(DatasetSnapshotSchema),
        value: cd.availableDatasetSnapshots,
      },
      {
        label: "chronicle-demo:backtests availableAgents",
        schema: z.array(AgentSummarySchema),
        value: cd.availableAgents,
      },
    ];
  })(),
];

let totalIssues = 0;
for (const { label, schema, value } of probes) {
  const result = schema.safeParse(value);
  if (result.success) {
    console.log(`ok  ${label}`);
    continue;
  }
  totalIssues += result.error.issues.length;
  console.log(
    `\nFAIL ${label}: ${result.error.issues.length} issue(s)`,
  );
  for (const issue of result.error.issues.slice(0, 25)) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
    console.log(`  - ${path}: ${issue.message}`);
  }
  if (result.error.issues.length > 25) {
    console.log(`  … +${result.error.issues.length - 25} more`);
  }
}
process.exit(totalIssues > 0 ? 1 : 0);
