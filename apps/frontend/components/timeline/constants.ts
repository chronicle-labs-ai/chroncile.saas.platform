export const DEFAULT_ROW_HEIGHT = 28;
export const DEFAULT_LABEL_WIDTH = 180;
export const HEADER_HEIGHT = 40;
export const INDENT_SIZE = 20;
export const MIN_HALF_WIDTH_MS = 1000;
export const MAX_HALF_WIDTH_MS = 7 * 24 * 60 * 60 * 1000;

export const TIMELINE_THEME = {
  bg_primary: "rgb(8, 10, 18)",
  bg_surface: "rgb(12, 15, 25)",
  bg_elevated: "rgb(18, 22, 35)",
  bg_row_alt: "rgb(14, 17, 28)",
  bg_row_hover: "rgb(20, 25, 40)",
  bg_row_selected: "rgb(0, 60, 80)",
  text_primary: "rgb(248, 250, 252)",
  text_secondary: "rgb(148, 163, 184)",
  text_muted: "rgb(100, 116, 139)",
  accent: "rgb(0, 212, 255)",
  accent_hover: "rgb(56, 189, 248)",
  playhead: "rgb(255, 100, 100)",
  separator: "rgb(30, 35, 50)",
  indent_guide: "rgb(40, 45, 60)",
  chevron: "rgb(100, 116, 139)",
  button_bg: "rgb(30, 35, 50)",
  button_hover: "rgb(40, 48, 70)",
  button_active: "rgb(0, 80, 100)",
} as const;

/** Source color (hex). Aligned with timeline-core source_color. */
export function sourceColor(source: string): string {
  const s = source.toLowerCase();
  switch (s) {
    case "intercom":
      return "#40B4A6";
    case "stripe":
    case "mock-stripe":
      return "#635BFF";
    case "zendesk":
      return "#03363D";
    case "slack":
      return "#4A154B";
    case "hubspot":
      return "#FF7A59";
    case "github":
      return "#6E5494";
    case "salesforce":
      return "#00A1E0";
    default: {
      let hash = 0;
      for (let i = 0; i < source.length; i++) hash = (hash + source.charCodeAt(i)) >>> 0;
      const hue = hash % 360;
      return hslToHex(hue, 0.6, 0.5);
    }
  }
}

export function pathColor(pathDisplay: string, baseHex: string): string {
  let hash = 0;
  for (let i = 0; i < pathDisplay.length; i++) hash = (hash + pathDisplay.charCodeAt(i)) >>> 0;
  const variation = (hash / 255) * 0.2 - 0.1;
  const [r, g, b] = hexToRgb(baseHex);
  const clamp = (x: number) => Math.min(255, Math.max(0, x));
  return rgbToHex(
    clamp(Math.round((r / 255) * (1 + variation) * 255)),
    clamp(Math.round((g / 255) * (1 + variation) * 255)),
    clamp(Math.round((b / 255) * (1 + variation) * 255))
  );
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }
  return rgbToHex(
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Tick interval in seconds for time axis. */
export function getTickIntervalSeconds(durationMs: number): number {
  const secs = durationMs / 1000;
  if (secs <= 60) return 10;
  if (secs <= 300) return 30;
  if (secs <= 1800) return 60;
  if (secs <= 7200) return 3600;
  if (secs <= 14400) return 600;
  return 3600;
}

export const MAX_TICKS = 17;

export function getTickIntervalMs(durationMs: number): number {
  const base = getTickIntervalSeconds(durationMs) * 1000;
  const estimatedTicks = Math.ceil(durationMs / base);
  if (estimatedTicks <= MAX_TICKS) return base;
  // Increase interval so we have at most MAX_TICKS
  return Math.ceil(durationMs / MAX_TICKS / 1000) * 1000;
}

export function formatTickLabel(durationSecs: number, ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const s = d.getSeconds();
  const m = d.getMinutes();
  const h = d.getHours();
  if (durationSecs <= 60) return pad(s);
  if (durationSecs <= 1800) return `${pad(m)}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}`;
}
