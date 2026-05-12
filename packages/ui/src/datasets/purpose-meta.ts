/*
 * Purpose meta — icon + color tokens for each `DatasetPurpose`.
 *
 * Mirrors the `PURPOSE_META` block in `../stream-timeline/dataset-picker.tsx`
 * but exposed as a stand-alone helper so the dataset card / row /
 * detail header can share a single visual vocabulary. Keep this in
 * sync if the picker's mapping changes.
 */

import { Beaker, Database, Layers, Repeat } from "lucide-react";

import type { DatasetPurpose } from "./types";

export interface PurposeMeta {
  label: string;
  Icon: typeof Database;
  /** CSS color for the leading dot (used in row/card headers). */
  dot: string;
  /** Background tint for the icon tile. */
  tile: string;
  /** Glyph color paired with the tile background. */
  ink: string;
  /** Label color used inline (e.g. inside a Linear-style chip). */
  ringClass: string;
}

export const DATASET_PURPOSE_META: Record<DatasetPurpose, PurposeMeta> = {
  eval: {
    label: "Eval",
    Icon: Beaker,
    dot: "bg-event-violet",
    tile: "bg-event-violet/12",
    ink: "text-event-violet",
    ringClass: "ring-event-violet/40",
  },
  training: {
    label: "Training",
    Icon: Database,
    dot: "bg-event-teal",
    tile: "bg-event-teal/12",
    ink: "text-event-teal",
    ringClass: "ring-event-teal/40",
  },
  replay: {
    label: "Replay",
    Icon: Repeat,
    dot: "bg-event-amber",
    tile: "bg-event-amber/12",
    ink: "text-event-amber",
    ringClass: "ring-event-amber/40",
  },
  review: {
    label: "Review",
    Icon: Layers,
    dot: "bg-event-pink",
    tile: "bg-event-pink/12",
    ink: "text-event-pink",
    ringClass: "ring-event-pink/40",
  },
};
