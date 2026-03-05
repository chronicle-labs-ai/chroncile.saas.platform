import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const FLY_API_BASE = "https://api.machines.dev/v1";

function flyV1Header() {
  const token = process.env.FLY_API_TOKEN ?? "";
  return `FlyV1 ${token.replace(/^FlyV1\s+/, "")}`;
}

function bearerHeader() {
  return `Bearer ${(process.env.FLY_API_TOKEN ?? "").replace(/^FlyV1\s+/, "")}`;
}

async function flyFetch(path: string) {
  const res = await fetch(`${FLY_API_BASE}${path}`, {
    headers: { Authorization: flyV1Header() },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function flyGraphQL(query: string, variables: Record<string, unknown>) {
  try {
    const res = await fetch("https://api.fly.io/graphql", {
      method: "POST",
      headers: { Authorization: bearerHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data ?? null;
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const env = await prisma.environment.findUnique({ where: { id } });
  if (!env) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!env.flyAppName) return NextResponse.json({ machines: [], volumes: [], ips: [], postgres: null, metrics: null });

  // Fetch all resources in parallel
  const [machines, volumes, gqlData, dbVolumes] = await Promise.all([
    flyFetch(`/apps/${env.flyAppName}/machines`).catch(() => null),
    flyFetch(`/apps/${env.flyAppName}/volumes`).catch(() => null),
    flyGraphQL(`
      query($name: String!) {
        app(name: $name) {
          ipAddresses { nodes { address type region createdAt } }
          machines { nodes {
            id name state region updatedAt
            checks { name status output }
          }}
        }
      }
    `, { name: env.flyAppName }),
    env.flyDbName ? flyFetch(`/apps/${env.flyDbName}/volumes`).catch(() => null) : null,
  ]);

  // Parse machines with extended metrics from the Machines API
  const machineList = (machines ?? []).map((m: Record<string, unknown>) => {
    const config = (m.config ?? {}) as Record<string, unknown>;
    const guest = (config.guest ?? {}) as Record<string, unknown>;
    const checks = (m.checks ?? []) as Array<{ name: string; status: string; output: string }>;

    return {
      id: m.id,
      name: m.name,
      state: m.state,
      region: m.region,
      imageRef: config.image ?? null,
      cpus: guest.cpus ?? null,
      cpuKind: guest.cpu_kind ?? "shared",
      memoryMb: guest.memory_mb ?? null,
      updatedAt: m.updated_at,
      createdAt: m.created_at,
      checks: checks.map((c) => ({
        name: c.name,
        status: c.status,
        output: c.output,
      })),
      events: ((m.events ?? []) as Array<{
        type: string;
        status: string;
        timestamp: number;
        request?: { exit_event?: { exit_code: number } };
      }>).slice(0, 10).map((e) => ({
        type: e.type,
        status: e.status,
        timestamp: new Date(e.timestamp).toISOString(),
        exitCode: e.request?.exit_event?.exit_code ?? null,
      })),
    };
  });

  // Parse volumes
  const volumeList = (volumes ?? []).map((v: Record<string, unknown>) => ({
    id: v.id,
    name: v.name,
    state: v.state,
    sizeGb: v.size_gb,
    region: v.region,
    encrypted: v.encrypted,
    createdAt: v.created_at,
    attachedMachineId: v.attached_machine_id ?? null,
  }));

  // Parse IPs
  const ips = gqlData?.app?.ipAddresses?.nodes ?? [];

  // Parse DB volumes for storage info
  const dbStorage = (dbVolumes ?? []).map((v: Record<string, unknown>) => ({
    id: v.id,
    name: v.name,
    sizeGb: v.size_gb,
    region: v.region,
    state: v.state,
  }));

  // Build postgres info with storage
  let postgres = null;
  if (env.flyDbName) {
    const totalStorageGb = dbStorage.reduce((acc: number, v: { sizeGb: number | null }) => acc + (v.sizeGb ?? 0), 0);
    const dbMachines = await flyFetch(`/apps/${env.flyDbName}/machines`).catch(() => null);
    const dbMachineList = (dbMachines ?? []).map((m: Record<string, unknown>) => ({
      id: m.id,
      state: m.state,
      region: m.region,
    }));

    postgres = {
      name: env.flyDbName,
      url: `https://fly.io/apps/${env.flyDbName}`,
      storageGb: totalStorageGb,
      volumes: dbStorage,
      machines: dbMachineList,
    };
  }

  // Build summary metrics
  type MachineRow = { cpus?: number | null; memoryMb?: number | null; state?: string };
  type VolumeRow = { sizeGb?: number | null };
  const metrics = {
    totalCpus: machineList.reduce((acc: number, m: MachineRow) => acc + (m.cpus ?? 0), 0),
    totalMemoryMb: machineList.reduce((acc: number, m: MachineRow) => acc + (m.memoryMb ?? 0), 0),
    runningMachines: machineList.filter((m: MachineRow) => m.state === "started").length,
    stoppedMachines: machineList.filter((m: MachineRow) => m.state === "stopped").length,
    totalMachines: machineList.length,
    totalVolumeGb: volumeList.reduce((acc: number, v: VolumeRow) => acc + (v.sizeGb ?? 0), 0),
    totalIps: ips.length,
    dbStorageGb: postgres?.storageGb ?? 0,
    dbMachines: postgres?.machines?.length ?? 0,
  };

  return NextResponse.json({
    machines: machineList,
    volumes: volumeList,
    ips,
    postgres,
    metrics,
  });
}
