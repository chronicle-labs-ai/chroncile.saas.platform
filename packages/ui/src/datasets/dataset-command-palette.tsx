"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../primitives/dialog";

import { ChordKbds } from "./dataset-shortcut-sheet";
import {
  DATASET_CANVAS_GROUPS,
  DATASET_CANVAS_SHORTCUTS,
  type DatasetCanvasShortcut,
  type DatasetCanvasShortcutGroup,
} from "./dataset-canvas-keymap";

/*
 * DatasetCommandPalette — ⌘K palette over the dataset canvas. Lists
 * every shortcut from the manifest plus arbitrary "command"
 * extensions provided by the consumer (e.g. saved views, dataset
 * actions). Keyboard nav: ↑/↓ to move, Enter to fire, Esc to close.
 *
 * Filters with a small fuzzy match against label + keywords + group.
 * The first matching command is auto-selected so Enter is one
 * keystroke away from "fire the obvious thing".
 */

export interface DatasetCommandPaletteCommand {
  id: string;
  label: string;
  hint?: string;
  group?: DatasetCanvasShortcutGroup | "command";
  /** Optional chord to display on the right edge — rendered with the
   *  same Kbd chips the shortcut sheet uses. */
  chord?: string;
  /** Free-form synonyms for fuzzy match. */
  keywords?: readonly string[];
  run: () => void;
}

export interface DatasetCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback invoked when the user fires a built-in shortcut from
   *  the palette. The canvas dispatches the corresponding handler. */
  onShortcut: (id: DatasetCanvasShortcut["id"]) => void;
  /** Extra commands appended above the built-in shortcut list. */
  extraCommands?: readonly DatasetCommandPaletteCommand[];
}

export function DatasetCommandPalette({
  open,
  onOpenChange,
  onShortcut,
  extraCommands,
}: DatasetCommandPaletteProps) {
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  /* Reset on open. */
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const commands = React.useMemo<DatasetCommandPaletteCommand[]>(() => {
    const builtIn: DatasetCommandPaletteCommand[] = DATASET_CANVAS_SHORTCUTS.map(
      (s) => ({
        id: s.id,
        label: s.label,
        group: s.group,
        chord: s.chords[0],
        keywords: s.keywords,
        run: () => onShortcut(s.id),
      }),
    );
    return [...(extraCommands ?? []), ...builtIn];
  }, [extraCommands, onShortcut]);

  const visible = React.useMemo(() => filterCommands(commands, query), [commands, query]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  /* Auto-scroll the active item into view. */
  React.useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector<HTMLElement>(
      `[data-command-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const grouped = React.useMemo(
    () => groupCommands(visible),
    [visible],
  );

  const fire = (cmd: DatasetCommandPaletteCommand) => {
    onOpenChange(false);
    /* Defer the run so React closes the dialog before the action
       (some actions focus another element; do that after the dialog
       has yielded focus). */
    queueMicrotask(() => cmd.run());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[560px] max-w-[92vw] gap-0 p-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-2 border-b border-l-border-faint px-3 py-2">
          <span
            aria-hidden
            className="font-mono text-[11px] uppercase tracking-[0.06em] text-l-ink-dim"
          >
            ⌘K
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, visible.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const cmd = visible[activeIndex];
                if (cmd) fire(cmd);
              }
            }}
            placeholder="Type a command…"
            aria-label="Command palette search"
            className={cx(
              "flex-1 bg-transparent font-sans text-[14px] text-l-ink",
              "placeholder:text-l-ink-dim focus:outline-none",
            )}
          />
        </div>

        <ul
          ref={listRef}
          role="listbox"
          aria-label="Commands"
          className="max-h-[360px] overflow-auto p-1"
        >
          {grouped.length === 0 ? (
            <li className="px-3 py-6 text-center font-mono text-[11px] text-l-ink-dim">
              No matching commands.
            </li>
          ) : (
            grouped.map(({ group, items, startIndex }) => (
              <React.Fragment key={group}>
                <li
                  className="px-2 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim"
                  aria-hidden
                >
                  {labelForGroup(group)}
                </li>
                {items.map((cmd, i) => {
                  const idx = startIndex + i;
                  const active = idx === activeIndex;
                  return (
                    <li
                      key={cmd.id}
                      role="option"
                      aria-selected={active}
                      data-command-index={idx}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        fire(cmd);
                      }}
                      className={cx(
                        "flex cursor-pointer items-center gap-2 rounded-[3px] px-2 py-1.5",
                        "font-sans text-[12.5px] text-l-ink",
                        active ? "bg-l-surface-selected" : null,
                      )}
                    >
                      <span className="flex-1 truncate">{cmd.label}</span>
                      {cmd.hint ? (
                        <span className="truncate font-mono text-[10px] text-l-ink-dim">
                          {cmd.hint}
                        </span>
                      ) : null}
                      {cmd.chord ? <ChordKbds chord={cmd.chord} /> : null}
                    </li>
                  );
                })}
              </React.Fragment>
            ))
          )}
        </ul>

        <footer className="flex items-center gap-3 border-t border-l-border-faint px-3 py-1.5 font-mono text-[10px] text-l-ink-dim">
          <span>↑↓ navigate</span>
          <span aria-hidden>·</span>
          <span>↵ run</span>
          <span aria-hidden>·</span>
          <span>esc close</span>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

/* ── Filtering ───────────────────────────────────────────── */

function filterCommands(
  commands: readonly DatasetCommandPaletteCommand[],
  query: string,
): DatasetCommandPaletteCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...commands];
  /* Tiny fuzzy filter: every space-separated token must appear in
     either the label, the group, or the keywords list. Order does
     not matter, substring is enough. */
  const tokens = q.split(/\s+/).filter(Boolean);
  return commands.filter((cmd) => {
    const haystack = [
      cmd.label,
      cmd.group ?? "",
      ...(cmd.keywords ?? []),
      cmd.hint ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return tokens.every((t) => haystack.includes(t));
  });
}

interface GroupedCommands {
  group: string;
  items: DatasetCommandPaletteCommand[];
  startIndex: number;
}

function groupCommands(
  commands: readonly DatasetCommandPaletteCommand[],
): GroupedCommands[] {
  const order = [...DATASET_CANVAS_GROUPS.map((g) => g.id), "command"] as const;
  const buckets = new Map<string, DatasetCommandPaletteCommand[]>();
  for (const cmd of commands) {
    const g = cmd.group ?? "command";
    const list = buckets.get(g) ?? [];
    list.push(cmd);
    buckets.set(g, list);
  }
  const result: GroupedCommands[] = [];
  let cursor = 0;
  for (const g of order) {
    const items = buckets.get(g);
    if (!items || items.length === 0) continue;
    result.push({ group: g, items, startIndex: cursor });
    cursor += items.length;
  }
  /* Append unknown groups (defensive — shouldn't happen). */
  for (const [g, items] of buckets) {
    if (!order.includes(g as never)) {
      result.push({ group: g, items, startIndex: cursor });
      cursor += items.length;
    }
  }
  return result;
}

function labelForGroup(group: string): string {
  const meta = DATASET_CANVAS_GROUPS.find((g) => g.id === group);
  if (meta) return meta.label;
  return group === "command" ? "Commands" : group;
}
