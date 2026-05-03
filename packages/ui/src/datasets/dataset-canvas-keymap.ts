/*
 * Dataset canvas keymap — single source of truth for the keyboard
 * layer, the shortcut sheet (`?`), and the command palette (`⌘K`).
 *
 * Each shortcut declares:
 *   - `id`            stable key — used by the palette / sheet for React keys
 *   - `label`         human-readable description
 *   - `group`         category for grouping in the sheet + palette
 *   - `chords`        key chord(s) that fire the action
 *   - `availability`  optional predicate against the canvas context;
 *                     skipped at parse-time, evaluated by the runtime
 *                     binder so context-only shortcuts (e.g. "Remove
 *                     selected") don't fire when the context is empty.
 *   - `keywords`      free-form strings that the palette's fuzzy search
 *                     also matches against (synonyms, verbs).
 *
 * The `chords` shape is intentionally string-based ("j", "?", "⌘K",
 * "⌘Backspace") so the same value can be displayed in the sheet AND
 * matched against `KeyboardEvent`. The parser treats the first chord
 * as the canonical display form.
 *
 * Conventions:
 *   - "⌘"  → meta on macOS, ctrl on Windows/Linux (matched via
 *            `event.metaKey || event.ctrlKey`).
 *   - "⇧"  → shift modifier
 *   - "⌥"  → alt modifier
 *   - The trailing key is matched against `event.key` (case-insensitive
 *     for letters, exact for special keys like "Enter", "Escape",
 *     "Backspace", " ", "?").
 *   - For shifted symbols ("?", "/"), include them without "⇧" — the
 *     shifted character itself is what `event.key` reports.
 */

export type DatasetCanvasShortcutGroup =
  | "navigation"
  | "selection"
  | "edit"
  | "lens"
  | "global";

export interface DatasetCanvasShortcut {
  id: string;
  label: string;
  group: DatasetCanvasShortcutGroup;
  /** First chord is the display form; later ones are aliases. */
  chords: readonly string[];
  /** Free-form synonyms picked up by the palette's fuzzy search. */
  keywords?: readonly string[];
  /** When false, the shortcut is parsed and listed but not bound — the
   *  canvas's runtime decides per-context whether to fire it. */
  contextual?: boolean;
}

export interface ParsedChord {
  /** Lowercased key as reported by `event.key`. */
  key: string;
  meta: boolean;
  shift: boolean;
  alt: boolean;
}

const SHORTCUTS: readonly DatasetCanvasShortcut[] = [
  /* Navigation */
  {
    id: "focus.next",
    label: "Move focus to next trace",
    group: "navigation",
    chords: ["j", "ArrowDown"],
    keywords: ["next", "down", "advance"],
  },
  {
    id: "focus.prev",
    label: "Move focus to previous trace",
    group: "navigation",
    chords: ["k", "ArrowUp"],
    keywords: ["prev", "previous", "up"],
  },
  {
    id: "focus.open",
    label: "Open inspector for focused trace",
    group: "navigation",
    chords: ["Enter"],
    keywords: ["inspect", "open"],
  },
  {
    id: "focus.close",
    label: "Close inspector / clear selection",
    group: "navigation",
    chords: ["Escape"],
    keywords: ["close", "dismiss", "clear"],
  },
  {
    id: "focus.search",
    label: "Focus search",
    group: "navigation",
    chords: ["/"],
    keywords: ["search", "find", "filter"],
  },

  /* Selection */
  {
    id: "select.toggle",
    label: "Toggle multi-select on focused trace",
    group: "selection",
    chords: ["x"],
    keywords: ["select", "check", "toggle"],
  },
  {
    id: "select.all",
    label: "Select all visible traces",
    group: "selection",
    chords: ["⌘a"],
    keywords: ["select all"],
    contextual: true,
  },
  {
    id: "select.clear",
    label: "Clear multi-select",
    group: "selection",
    chords: ["⌘⇧a"],
    keywords: ["deselect", "clear"],
    contextual: true,
  },

  /* Lens */
  {
    id: "lens.cycle",
    label: "Cycle lens",
    group: "lens",
    chords: ["v"],
    keywords: ["lens", "view", "switch"],
  },
  { id: "lens.list", label: "Lens · List", group: "lens", chords: ["⌥1"] },
  { id: "lens.graph", label: "Lens · Graph", group: "lens", chords: ["⌥2"] },
  { id: "lens.timeline", label: "Lens · Timeline", group: "lens", chords: ["⌥3"] },
  { id: "lens.coverage", label: "Lens · Coverage", group: "lens", chords: ["⌥4"] },

  /* Edit */
  {
    id: "edit.remove",
    label: "Remove selected traces from dataset",
    group: "edit",
    chords: ["⌘Backspace", "r"],
    keywords: ["delete", "remove"],
    contextual: true,
  },

  /* Global */
  {
    id: "palette.open",
    label: "Open command palette",
    group: "global",
    chords: ["⌘k"],
    keywords: ["command", "palette"],
  },
  {
    id: "sheet.open",
    label: "Show keyboard shortcuts",
    group: "global",
    chords: ["?"],
    keywords: ["help", "shortcuts"],
  },
];

export const DATASET_CANVAS_SHORTCUTS = SHORTCUTS;

/** Lookup table for one-off resolution. */
export const DATASET_CANVAS_SHORTCUTS_BY_ID = (() => {
  const map = new Map<string, DatasetCanvasShortcut>();
  for (const s of SHORTCUTS) map.set(s.id, s);
  return map;
})();

export const DATASET_CANVAS_GROUPS: Array<{
  id: DatasetCanvasShortcutGroup;
  label: string;
}> = [
  { id: "navigation", label: "Navigation" },
  { id: "selection", label: "Selection" },
  { id: "edit", label: "Edit" },
  { id: "lens", label: "Lens" },
  { id: "global", label: "Global" },
];

/* ── Chord parsing + matching ────────────────────────────── */

/**
 * Parse a chord string like `"⌘k"`, `"⌘⇧a"`, or `"j"` into
 * modifier flags + the bare key. Whitespace is ignored. The trailing
 * key is matched against `event.key` directly so multi-char names
 * (`Enter`, `Escape`, `Backspace`, `ArrowDown`) work as-is.
 */
export function parseChord(chord: string): ParsedChord {
  let s = chord.trim();
  let meta = false;
  let shift = false;
  let alt = false;
  // Eat modifier glyphs, in any order.
  while (true) {
    if (s.startsWith("⌘")) {
      meta = true;
      s = s.slice(1);
    } else if (s.startsWith("⇧")) {
      shift = true;
      s = s.slice(1);
    } else if (s.startsWith("⌥")) {
      alt = true;
      s = s.slice(1);
    } else {
      break;
    }
  }
  const key = s.length === 1 ? s.toLowerCase() : s;
  return { key, meta, shift, alt };
}

/** Returns true when the keyboard event matches the parsed chord. */
export function chordMatches(event: KeyboardEvent, chord: ParsedChord): boolean {
  const meta = event.metaKey || event.ctrlKey;
  if (meta !== chord.meta) return false;
  if (event.altKey !== chord.alt) return false;

  // Shift handling: for letter keys we require the shift state to
  // match. For shifted symbols the chord doesn't include "⇧" — the
  // shifted character itself (e.g. "?") matches `event.key`. So we
  // only enforce shift parity when the chord explicitly asks for it.
  if (chord.shift && !event.shiftKey) return false;

  const a = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const b = chord.key.length === 1 ? chord.key.toLowerCase() : chord.key;
  return a === b;
}

/** Pretty form for rendering inside `<Kbd>` chips — splits a chord
 *  into individual key caps (e.g. `"⌘k"` → `["⌘", "K"]`). */
export function chordToKeys(chord: string): string[] {
  const parsed = parseChord(chord);
  const out: string[] = [];
  if (parsed.meta) out.push("⌘");
  if (parsed.alt) out.push("⌥");
  if (parsed.shift) out.push("⇧");
  const key = parsed.key;
  if (key === "ArrowDown") out.push("↓");
  else if (key === "ArrowUp") out.push("↑");
  else if (key === "ArrowLeft") out.push("←");
  else if (key === "ArrowRight") out.push("→");
  else if (key === "Escape") out.push("Esc");
  else if (key === "Backspace") out.push("⌫");
  else if (key === " ") out.push("Space");
  else if (key.length === 1) out.push(key.toUpperCase());
  else out.push(key);
  return out;
}
