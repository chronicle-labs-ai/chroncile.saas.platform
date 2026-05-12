import { prisma } from "@/lib/data";

const LOCAL_ENV_NAME = "local";
const BACKEND_URL = process.env.LOCAL_BACKEND_URL ?? "http://localhost:8080";
const FRONTEND_URL = process.env.LOCAL_FRONTEND_URL ?? "http://localhost:3000";
const PROBE_TIMEOUT_MS = 2_000;

interface ProbeResult {
  reachable: boolean;
  latencyMs: number;
  gitSha?: string;
  gitTag?: string;
}

async function probeService(url: string): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) return { reachable: false, latencyMs };

    let gitSha: string | undefined;
    let gitTag: string | undefined;
    try {
      const data = await res.json();
      gitSha = data.gitSha;
      gitTag = data.gitTag;
    } catch {
      // non-JSON response is fine, endpoint is still reachable
    }

    return { reachable: true, latencyMs, gitSha, gitTag };
  } catch {
    return { reachable: false, latencyMs: Date.now() - start };
  }
}

export async function syncLocalEnvironment(): Promise<void> {
  const backend = await probeService(`${BACKEND_URL}/health`);
  const frontend = await probeService(FRONTEND_URL);

  const isRunning = backend.reachable;

  if (!isRunning) {
    const existing = await prisma.environment.findUnique({
      where: { name: LOCAL_ENV_NAME },
    });
    if (existing) {
      await prisma.environment.update({
        where: { name: LOCAL_ENV_NAME },
        data: {
          status: "STOPPED",
          isHealthy: false,
        },
      });
    }
    return;
  }

  const serviceSecret =
    process.env.LOCAL_SERVICE_SECRET ?? process.env.SERVICE_SECRET ?? null;

  await prisma.environment.upsert({
    where: { name: LOCAL_ENV_NAME },
    update: {
      status: "RUNNING",
      flyAppUrl: BACKEND_URL,
      vercelUrl: frontend.reachable ? FRONTEND_URL : null,
      gitSha: backend.gitSha ?? null,
      gitTag: backend.gitTag ?? null,
      isHealthy: true,
      lastHealthAt: new Date(),
      serviceSecret,
    },
    create: {
      name: LOCAL_ENV_NAME,
      type: "LOCAL",
      status: "RUNNING",
      gitBranch: "local",
      flyAppUrl: BACKEND_URL,
      vercelUrl: frontend.reachable ? FRONTEND_URL : null,
      gitSha: backend.gitSha ?? null,
      gitTag: backend.gitTag ?? null,
      isHealthy: true,
      lastHealthAt: new Date(),
      serviceSecret,
      expiresAt: null,
    },
  });
}
