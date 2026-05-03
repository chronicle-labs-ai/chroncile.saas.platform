"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../primitives/dialog";
import { Kbd } from "../primitives/kbd";

import {
  DATASET_CANVAS_GROUPS,
  DATASET_CANVAS_SHORTCUTS,
  chordToKeys,
  type DatasetCanvasShortcutGroup,
} from "./dataset-canvas-keymap";

/*
 * DatasetShortcutSheet — `?`-triggered modal listing every keyboard
 * shortcut on the canvas. Reads from the canonical keymap manifest
 * so the documentation cannot drift from the runtime bindings.
 *
 * Layout: two columns of grouped tables. Each shortcut row pairs a
 * label with a stack of `<Kbd>` chips for every chord (alternates
 * separated by "/").
 */

export interface DatasetShortcutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DatasetShortcutSheet({
  open,
  onOpenChange,
}: DatasetShortcutSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[640px] max-w-[92vw]">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 px-4 py-3 sm:grid-cols-2">
          {DATASET_CANVAS_GROUPS.map((group) => (
            <ShortcutGroup key={group.id} groupId={group.id} label={group.label} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutGroup({
  groupId,
  label,
}: {
  groupId: DatasetCanvasShortcutGroup;
  label: string;
}) {
  const items = DATASET_CANVAS_SHORTCUTS.filter((s) => s.group === groupId);
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-l-ink-dim">
        {label}
      </h3>
      <ul className="flex flex-col">
        {items.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-3 rounded-[3px] py-1.5"
          >
            <span className="flex-1 truncate font-sans text-[12.5px] text-l-ink">
              {s.label}
            </span>
            <ChordList chords={s.chords} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ChordList({
  chords,
  className,
}: {
  chords: readonly string[];
  className?: string;
}) {
  return (
    <span className={cx("flex items-center gap-1", className)}>
      {chords.map((chord, i) => (
        <React.Fragment key={chord}>
          {i > 0 ? (
            <span
              aria-hidden
              className="font-mono text-[10px] text-l-ink-dim"
            >
              or
            </span>
          ) : null}
          <ChordKbds chord={chord} />
        </React.Fragment>
      ))}
    </span>
  );
}

export function ChordKbds({ chord }: { chord: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {chordToKeys(chord).map((k, i) => (
        <Kbd key={`${k}-${i}`} size="sm">
          {k}
        </Kbd>
      ))}
    </span>
  );
}
