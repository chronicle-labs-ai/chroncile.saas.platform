"use client";

import * as React from "react";

import {
  DATASET_CANVAS_SHORTCUTS,
  chordMatches,
  parseChord,
  type DatasetCanvasShortcut,
} from "./dataset-canvas-keymap";

/*
 * useDatasetCanvasKeyboard — hooks the canvas's `keydown` handlers to
 * the keymap manifest. The hook resolves the manifest at mount time
 * (cheap — < 30 entries) and dispatches by shortcut id, so every
 * shortcut has exactly one place to bind logic.
 *
 * Editable-target gating: when focus is inside an `<input>`,
 * `<textarea>`, or `contenteditable`, only **global** shortcuts
 * (`⌘K`, `?`, `Escape`) fire. All other shortcuts no-op so users
 * typing in the search box don't accidentally reassign clusters.
 */

export type DatasetCanvasShortcutId =
  | "focus.next"
  | "focus.prev"
  | "focus.open"
  | "focus.close"
  | "focus.search"
  | "select.toggle"
  | "select.all"
  | "select.clear"
  | "lens.cycle"
  | "lens.list"
  | "lens.graph"
  | "lens.timeline"
  | "lens.coverage"
  | "edit.remove"
  | "palette.open"
  | "sheet.open";

export type DatasetCanvasHandlers = Partial<
  Record<DatasetCanvasShortcutId, () => void>
>;

export interface UseDatasetCanvasKeyboardOptions {
  /** Disable the entire keyboard layer (e.g. when a modal is open
   *  and should own all input). The palette / sheet themselves set
   *  this when they're open. */
  enabled?: boolean;
  handlers: DatasetCanvasHandlers;
  /** Element to listen on. Defaults to `document`. */
  target?: React.RefObject<HTMLElement | null>;
}

const GLOBAL_IDS = new Set<DatasetCanvasShortcutId>([
  "palette.open",
  "sheet.open",
  "focus.close",
]);

interface BoundChord {
  shortcut: DatasetCanvasShortcut;
  parsed: ReturnType<typeof parseChord>;
}

const BOUND_CHORDS: BoundChord[] = DATASET_CANVAS_SHORTCUTS.flatMap((s) =>
  s.chords.map<BoundChord>((c) => ({ shortcut: s, parsed: parseChord(c) })),
);

export function useDatasetCanvasKeyboard({
  enabled = true,
  handlers,
  target,
}: UseDatasetCanvasKeyboardOptions) {
  /* Latest-handlers ref so the listener doesn't rebind every render. */
  const handlersRef = React.useRef<DatasetCanvasHandlers>(handlers);
  handlersRef.current = handlers;

  React.useEffect(() => {
    if (!enabled) return;
    const node: EventTarget = target?.current ?? document;
    const onKey = (rawEvent: Event) => {
      const event = rawEvent as KeyboardEvent;
      const editable = isEditableTarget(event.target);
      for (const { shortcut, parsed } of BOUND_CHORDS) {
        if (!chordMatches(event, parsed)) continue;
        const id = shortcut.id as DatasetCanvasShortcutId;
        if (editable && !GLOBAL_IDS.has(id)) return;
        const handler = handlersRef.current[id];
        if (!handler) return;
        event.preventDefault();
        event.stopPropagation();
        handler();
        return;
      }
    };
    node.addEventListener("keydown", onKey, true);
    return () => node.removeEventListener("keydown", onKey, true);
  }, [enabled, target]);
}

/**
 * Returns true when the event target is a place a user is typing
 * into. Used to gate non-global shortcuts.
 */
export function isEditableTarget(node: EventTarget | null): boolean {
  if (!(node instanceof HTMLElement)) return false;
  const tag = node.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (node.isContentEditable) return true;
  /* Radix popovers / select listboxes set role="textbox" on combobox
     wrappers — treat them as editable too. */
  const role = node.getAttribute("role");
  if (role === "textbox" || role === "combobox") return true;
  return false;
}
