import { NextResponse } from "next/server";
import { prisma } from "@/server/data/db";

const FLY_ORG = process.env.FLY_ORG_SLUG ?? "personal";
const PROM_BASE = `https://api.fly.io/prometheus/${FLY_ORG}`;

function authHeader(): string {
  const token = process.env.FLY_API_TOKEN ?? "";
  const raw = token.replace(/^(FlyV1|Bearer)\s+/, "");
  return `FlyV1 ${raw}`;
}

interface PromResult {
  metric: Record<string, string>;
  values: [number, string][];
}

async function queryRange(
  query: string,
  start: number,
  end: number,
  step: string
): Promise<PromResult[]> {
  const url = new URL(`${PROM_BASE}/api/v1/query_range`);
  url.searchParams.set("query", query);
  url.searchParams.set("start", start.toString());
  url.searchParams.set("end", end.toString());
  url.searchParams.set("step", step);

  const res = await fetch(url.toString(), {
    headers: { Authorization: authHeader() },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) return [];
  const json = await res.json();
  return json?.data?.result ?? [];
}

interface TimeSeriesPoint {
  t: number;
  v: number | null;
}

function flattenSeries(results: PromResult[]): TimeSeriesPoint[] {
  if (results.length === 0) return [];

  if (results.length === 1) {
    return results[0].values.map(([t, v]) => ({
      t,
      v: parseFloat(v),
    }));
  }

  const byTime = new Map<number, number[]>();
  for (const r of results) {
    for (const [t, v] of r.values) {
      const existing = byTime.get(t) ?? [];
      existing.push(parseFloat(v));
      byTime.set(t, existing);
    }
  }

  return [...byTime.entries()]
    .sort(([a], [b]) => a - b)
    .map(([t, vals]) => ({
      t,
      v: vals.reduce((s, x) => s + x, 0) / vals.length,
    }));
}

const WINDOW_MAP: Record<string, { seconds: number; step: string }> = {
  "30m": { seconds: 1800, step: "30s" },
  "1h": { seconds: 3600, step: "60s" },
  "6h": { seconds: 21600, step: "300s" },
  "24h": { seconds: 86400, step: "600s" },
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const env = await prisma.environment.findUnique({ where: { id } });
  if (!env) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!env.flyAppName) {
    return NextResponse.json({ error: "No Fly app" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const windowKey = searchParams.get("window") ?? "1h";
  const { seconds, step } = WINDOW_MAP[windowKey] ?? WINDOW_MAP["1h"];

  const end = Math.floor(Date.now() / 1000);
  const start = end - seconds;
  const app = env.flyAppName;

  const [cpuRes, memRes, diskRes, reqRes, netInRes, netOutRes] = await Promise.all([
    queryRange(
      `avg(100 * (1 - rate(fly_instance_cpu{app="${app}",mode="idle"}) / rate(fly_instance_cpu{app="${app}"})))`,
      start, end, step
    ),
    queryRange(
      `100 * (1 - avg(fly_instance_memory_mem_available{app="${app}"}) / avg(fly_instance_memory_mem_total{app="${app}"}))`,
      start, end, step
    ),
    queryRange(
      `100 * (1 - avg(fly_instance_filesystem_blocks_avail{app="${app}"}) / avg(fly_instance_filesystem_blocks{app="${app}"}))`,
      start, end, step
    ),
    queryRange(
      `sum(rate(fly_edge_http_responses_count{app="${app}"}))`,
      start, end, step
    ),
    queryRange(
      `sum(rate(fly_instance_net_recv_bytes{app="${app}",device="eth0"}))`,
      start, end, step
    ),
    queryRange(
      `sum(rate(fly_instance_net_sent_bytes{app="${app}",device="eth0"}))`,
      start, end, step
    ),
  ]);

  const cpu = flattenSeries(cpuRes);
  const memory = flattenSeries(memRes);
  const disk = flattenSeries(diskRes);
  const requests = flattenSeries(reqRes);
  const netIn = flattenSeries(netInRes);
  const netOut = flattenSeries(netOutRes);

  const latest = (series: TimeSeriesPoint[]) =>
    series.length > 0 ? series[series.length - 1].v : null;

  return NextResponse.json({
    window: windowKey,
    cpu: { series: cpu, current: latest(cpu) },
    memory: { series: memory, current: latest(memory) },
    disk: { series: disk, current: latest(disk) },
    requests: { series: requests, current: latest(requests) },
    netIn: { series: netIn, current: latest(netIn) },
    netOut: { series: netOut, current: latest(netOut) },
  });
}
