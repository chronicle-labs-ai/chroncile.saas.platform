/*
 * Default connections seed — wraps the canonical fixtures already
 * shipped by the design system (`connectionsSeed`,
 * `connectionBackfillsSeed`, `connectionDeliveriesSeed`,
 * `connectionEventSubsSeed`). Phase A keeps the bodies in
 * `packages/ui` and structuredClones here so mock-provider mutations
 * never leak into shared state.
 *
 * `build()` validates each cloned slice against the generated Zod
 * schemas in dev mode so a UI fixture that drifts from the canonical
 * Rust shape fails at first use, not silently in production.
 */

import {
  ConnectionBackfillRecordSchema,
  ConnectionDeliverySchema,
  ConnectionEventTypeSubSchema,
  ConnectionSchema,
} from "chronicle/schemas/connections";
import type {
  Connection,
  ConnectionBackfillRecord,
  ConnectionDelivery,
  ConnectionEventTypeSub,
} from "chronicle/types/connections";
import {
  connectionBackfillsSeed,
  connectionDeliveriesSeed,
  connectionEventSubsSeed,
  connectionsSeed,
} from "ui";
import { z } from "zod";

import { validateInDev } from "../_validate";
import type { ConnectionsSeed, ConnectionsSeedData } from "./types";

const ConnectionListSchema = z.array(ConnectionSchema);
const BackfillsByConnectionSchema = z.record(
  z.array(ConnectionBackfillRecordSchema),
);
const DeliveriesByConnectionSchema = z.record(
  z.array(ConnectionDeliverySchema),
);
const EventSubsByConnectionSchema = z.record(
  z.array(ConnectionEventTypeSubSchema),
);

export const defaultConnectionsSeed: ConnectionsSeed = {
  id: "default",
  label: "Realistic workspace",
  description:
    "8 connections covering live / paused / expired / error states · matches Storybook",
  build(): ConnectionsSeedData {
    const connections = structuredClone(connectionsSeed) as Connection[];
    const backfillsByConnection = structuredClone(
      connectionBackfillsSeed,
    ) as Record<string, ConnectionBackfillRecord[]>;
    const deliveriesByConnection = structuredClone(
      connectionDeliveriesSeed,
    ) as Record<string, ConnectionDelivery[]>;
    const eventSubsByConnection = structuredClone(
      connectionEventSubsSeed,
    ) as Record<string, ConnectionEventTypeSub[]>;

    validateInDev(
      ConnectionListSchema,
      connections,
      "connections:default connections",
    );
    validateInDev(
      BackfillsByConnectionSchema,
      backfillsByConnection,
      "connections:default backfillsByConnection",
    );
    validateInDev(
      DeliveriesByConnectionSchema,
      deliveriesByConnection,
      "connections:default deliveriesByConnection",
    );
    validateInDev(
      EventSubsByConnectionSchema,
      eventSubsByConnection,
      "connections:default eventSubsByConnection",
    );

    return {
      connections,
      backfillsByConnection,
      deliveriesByConnection,
      eventSubsByConnection,
    };
  },
};
