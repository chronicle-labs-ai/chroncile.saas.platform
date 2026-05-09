/*
 * Runtime data-mode configuration.
 *
 * Three sources, in priority order:
 *
 *   1. URL params (`?data.datasets=chronicle&seed.datasets=power-user`)
 *      — useful for per-tab overrides while debugging.
 *   2. `localStorage` keys (`chronicle.data.<domain>` /
 *      `chronicle.seed.<domain>`) — sticky for dev sessions.
 *   3. Build-time `NEXT_PUBLIC_DATA_*` env vars — the team-wide
 *      default for `.env.local`.
 *
 * Falls back to `mock` mode + `default` seeds when nothing is set.
 *
 * The whole config is read once by `<DataProviderProvider>` at mount
 * and frozen — flipping a knob mid-session is intentionally a hard
 * reload (or a `localStorage` change followed by reload). The `mock`
 * provider exposes a `reset(seedId)` for hot-swapping the underlying
 * seed without re-mounting.
 */

import { isDataMode, type DataMode } from "./types";

export interface DataConfig {
  agents: DataMode;
  datasets: DataMode;
  connections: DataMode;
  timeline: DataMode;
  seeds: {
    agents: string;
    datasets: string;
    connections: string;
    timeline: string;
  };
  /** Optional jitter (ms) applied to mock-impl reads/writes so the
   *  UX feels like a real network. `0` disables. */
  mockLatencyMs: number;
}

const DEFAULT_CONFIG: DataConfig = Object.freeze({
  agents: "mock" as DataMode,
  datasets: "mock" as DataMode,
  connections: "mock" as DataMode,
  timeline: "mock" as DataMode,
  seeds: {
    agents: "default",
    datasets: "default",
    connections: "default",
    timeline: "default",
  },
  mockLatencyMs: 0,
});

type Domain = "agents" | "datasets" | "connections" | "timeline";

/* Critical: Next.js / Turbopack only inline `process.env.LITERAL_KEY`
   into client bundles. Dynamic lookups like `process.env[someExpr]`
   are NOT statically analyzed and evaluate to `undefined` in the
   browser — every read silently falls back to "default", which is
   exactly the bug we hit when seed env vars were ignored despite
   being set in `.env.local`. Keep the literal accesses below. */
const ENV_DATA: Record<Domain, string | undefined> = {
  agents: process.env.NEXT_PUBLIC_DATA_AGENTS,
  datasets: process.env.NEXT_PUBLIC_DATA_DATASETS,
  connections: process.env.NEXT_PUBLIC_DATA_CONNECTIONS,
  timeline: process.env.NEXT_PUBLIC_DATA_TIMELINE,
};
const ENV_SEED: Record<Domain, string | undefined> = {
  agents: process.env.NEXT_PUBLIC_DATA_SEED_AGENTS,
  datasets: process.env.NEXT_PUBLIC_DATA_SEED_DATASETS,
  connections: process.env.NEXT_PUBLIC_DATA_SEED_CONNECTIONS,
  timeline: process.env.NEXT_PUBLIC_DATA_SEED_TIMELINE,
};

const URL_KEY = (kind: "data" | "seed", domain: Domain) =>
  `${kind}.${domain}`;
const STORAGE_KEY = (kind: "data" | "seed", domain: Domain) =>
  `chronicle.${kind}.${domain}`;

function readClientOverride(kind: "data" | "seed", domain: Domain): string | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URLSearchParams(window.location.search).get(
      URL_KEY(kind, domain),
    );
    if (url) return url;
  } catch {
    /* malformed URL on SSR shim */
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY(kind, domain));
    if (stored) return stored;
  } catch {
    /* localStorage disabled — Safari private mode */
  }
  return null;
}

function readMode(domain: Domain, fallback: DataMode): DataMode {
  const fromClient = readClientOverride("data", domain);
  const fromEnv = ENV_DATA[domain];
  const candidate = fromClient ?? fromEnv ?? fallback;
  if (isDataMode(candidate)) return candidate;
  if (typeof console !== "undefined") {
    console.warn(
      `[data] invalid mode "${candidate}" for ${domain} — falling back to "${fallback}"`,
    );
  }
  return fallback;
}

function readSeed(domain: Domain, fallback: string): string {
  const fromClient = readClientOverride("seed", domain);
  const fromEnv = ENV_SEED[domain];
  return fromClient ?? fromEnv ?? fallback;
}

function readMockLatency(): number {
  const raw = process.env.NEXT_PUBLIC_DATA_MOCK_LATENCY_MS;
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return 0;
}

let cached: DataConfig | null = null;

/**
 * Read the live `DataConfig`. Memoised so component renders don't
 * re-parse env on every call. The cache is intentionally unbounded —
 * config is fixed for the lifetime of the page.
 */
export function getDataConfig(): DataConfig {
  if (cached) return cached;
  cached = Object.freeze<DataConfig>({
    agents: readMode("agents", DEFAULT_CONFIG.agents),
    datasets: readMode("datasets", DEFAULT_CONFIG.datasets),
    connections: readMode("connections", DEFAULT_CONFIG.connections),
    timeline: readMode("timeline", DEFAULT_CONFIG.timeline),
    seeds: {
      agents: readSeed("agents", DEFAULT_CONFIG.seeds.agents),
      datasets: readSeed("datasets", DEFAULT_CONFIG.seeds.datasets),
      connections: readSeed("connections", DEFAULT_CONFIG.seeds.connections),
      timeline: readSeed("timeline", DEFAULT_CONFIG.seeds.timeline),
    },
    mockLatencyMs: readMockLatency(),
  });
  return cached;
}

/**
 * Reset the cached config. Intended for tests + DevTools widgets
 * that want to flip a knob without a hard reload.
 */
export function __resetDataConfigCache(): void {
  cached = null;
}
