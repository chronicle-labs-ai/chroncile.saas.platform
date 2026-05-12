import { NextResponse } from "next/server";
import { prisma } from "@/backend/data/db";

const BACKEND_URL = process.env.LOCAL_BACKEND_URL ?? "http://localhost:8080";
const SAMPLE_INTERVAL_MS = 2_000;
const MAX_SAMPLES = 1800;

interface Sample {
  t: number;
  memoryBytes: number | null;
  threads: number | null;
}

const sampleBuffer: Sample[] = [];
let lastSampleAt = 0;
let samplerRunning = false;

async function collectSample(): Promise<void> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/platform/metrics`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return;
    const data = await res.json();
    const now = Date.now();
    sampleBuffer.push({
      t: now,
      memoryBytes: data.process?.memoryBytes ?? null,
      threads: data.process?.numThreads ?? null,
    });
    if (sampleBuffer.length > MAX_SAMPLES) {
      sampleBuffer.splice(0, sampleBuffer.length - MAX_SAMPLES);
    }
    lastSampleAt = now;
  } catch {
    // backend not reachable, skip sample
  }
}

function startSampler(): void {
  if (samplerRunning) return;
  samplerRunning = true;
  const tick = async () => {
    await collectSample();
    if (samplerRunning) {
      setTimeout(tick, SAMPLE_INTERVAL_MS);
    }
  };
  tick();
}

const WINDOW_MS: Record<string, number> = {
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "6h": 6 * 60 * 60_000,
  "24h": 24 * 60 * 60_000,
};

function buildSeries(
  windowMs: number,
  extractor: (s: Sample) => number | null
): { series: Array<{ t: number; v: number | null }>; current: number | null } {
  const cutoff = Date.now() - windowMs;
  const filtered = sampleBuffer.filter((s) => s.t >= cutoff);
  const series = filtered.map((s) => ({ t: s.t, v: extractor(s) }));
  const last =
    filtered.length > 0 ? extractor(filtered[filtered.length - 1]) : null;
  return { series, current: last };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const env = await prisma.environment.findUnique({ where: { id } });
  if (!env) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (env.type !== "LOCAL") {
    return NextResponse.json(
      { error: "Metrics not available for this environment type" },
      { status: 404 }
    );
  }

  startSampler();

  if (Date.now() - lastSampleAt > SAMPLE_INTERVAL_MS * 2) {
    await collectSample();
  }

  const url = new URL(req.url);
  const windowKey = url.searchParams.get("window") ?? "1h";
  const windowMs = WINDOW_MS[windowKey] ?? WINDOW_MS["1h"];

  const memoryPct = buildSeries(windowMs, (s) => {
    if (s.memoryBytes == null) return null;
    const totalMemMb = 16 * 1024;
    return (
      Math.round((s.memoryBytes / (totalMemMb * 1024 * 1024)) * 10000) / 100
    );
  });

  const cpuSeries = buildSeries(windowMs, (s) => {
    return s.threads != null ? Math.min(s.threads * 2, 100) : null;
  });

  return NextResponse.json({
    window: windowKey,
    cpu: cpuSeries,
    memory: memoryPct,
    disk: { series: [], current: null },
    requests: { series: [], current: null },
    netIn: { series: [], current: null },
    netOut: { series: [], current: null },
  });
}
