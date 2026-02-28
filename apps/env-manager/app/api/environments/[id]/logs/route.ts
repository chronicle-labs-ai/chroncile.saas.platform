import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  source: "provision" | "fly-machine" | "fly-runtime" | "vercel-build";
}

export interface LogsResponse {
  provision: LogEntry[];
  fly: LogEntry[];
  vercel: LogEntry[];
  errors: Record<string, string>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const env = await prisma.environment.findUnique({ where: { id } });
  if (!env) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const errors: Record<string, string> = {};
  const [provision, fly, vercel] = await Promise.all([
    fetchProvisionLogs(env.provisionLog, env.errorLog),
    fetchFlyLogs(env.flyAppName, errors),
    fetchVercelLogs(env.gitBranch, env.vercelDeploymentId, errors),
  ]);

  return NextResponse.json({ provision, fly, vercel, errors } satisfies LogsResponse);
}

function fetchProvisionLogs(
  provisionLog: string | null,
  errorLog: string | null
): LogEntry[] {
  const lines: LogEntry[] = [];

  if (provisionLog) {
    for (const raw of provisionLog.split("\n")) {
      if (!raw.trim()) continue;
      const tsMatch = raw.match(/^\[(\d{4}-\d{2}-\d{2}T[\d:.Z]+)\]\s+(INFO|WARN|ERROR|FATAL):\s*(.+)$/);
      if (tsMatch) {
        const level = tsMatch[2].toLowerCase();
        lines.push({
          timestamp: tsMatch[1],
          level: (level === "fatal" || level === "error") ? "error" : level === "warn" ? "warn" : "info",
          message: tsMatch[3],
          source: "provision",
        });
      } else {
        lines.push({
          timestamp: new Date().toISOString(),
          level: "info",
          message: raw,
          source: "provision",
        });
      }
    }
  }

  // If errorLog differs from provisionLog (fatal crash lines), append them
  if (errorLog && errorLog !== provisionLog) {
    for (const raw of errorLog.split("\n")) {
      if (!raw.trim()) continue;
      if (provisionLog?.includes(raw)) continue; // avoid duplicates
      lines.push({
        timestamp: new Date().toISOString(),
        level: "error",
        message: raw,
        source: "provision",
      });
    }
  }

  return lines;
}

async function fetchFlyLogs(
  flyAppName: string | null,
  errors: Record<string, string>
): Promise<LogEntry[]> {
  if (!flyAppName) return [];

  const token = process.env.FLY_API_TOKEN;
  if (!token) {
    errors.fly = "FLY_API_TOKEN not configured";
    return [];
  }

  const flyV1 = `FlyV1 ${token.replace(/^FlyV1\s+/, "")}`;
  const logs: LogEntry[] = [];

  try {
    // Fetch machines list
    const machinesRes = await fetch(
      `https://api.machines.dev/v1/apps/${flyAppName}/machines`,
      { headers: { Authorization: flyV1 }, signal: AbortSignal.timeout(8_000) }
    );
    if (machinesRes.ok) {
      const machines: Array<{
        id: string;
        name: string;
        state: string;
        region: string;
        updated_at: string;
        events?: Array<{ type: string; status: string; timestamp: number; request?: { exit_event?: { exit_code: number } } }>;
      }> = await machinesRes.json().catch(() => []) ?? [];

      for (const m of machines) {
        logs.push({
          timestamp: m.updated_at,
          level: m.state === "started" ? "info" : m.state === "stopped" ? "warn" : "error",
          message: `Machine ${m.name || m.id} [${m.region}] state: ${m.state}`,
          source: "fly-machine",
        });

        // Include machine events if present
        if (Array.isArray(m.events)) {
          for (const ev of m.events) {
            const ts = new Date(ev.timestamp).toISOString();
            const exitCode = ev.request?.exit_event?.exit_code;
            const isError = exitCode !== undefined && exitCode !== 0;
            logs.push({
              timestamp: ts,
              level: isError ? "error" : "info",
              message: exitCode !== undefined
                ? `${ev.type}: ${ev.status} (exit_code=${exitCode})`
                : `${ev.type}: ${ev.status}`,
              source: "fly-machine",
            });
          }
        }
      }
    }

    // Fetch current release info via GraphQL
    const bearer = `Bearer ${token.replace(/^FlyV1\s+/, "")}`;
    const gqlRes = await fetch("https://api.fly.io/graphql", {
      method: "POST",
      headers: { Authorization: bearer, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        query: `query($name: String!) {
          app(name: $name) {
            releases(first: 5) {
              nodes { id status reason createdAt user { email } }
            }
          }
        }`,
        variables: { name: flyAppName },
      }),
    });

    if (gqlRes.ok) {
      const gqlData = await gqlRes.json().catch(() => null);
      const releases: Array<{ id: string; status: string; reason: string; createdAt: string; user?: { email: string } }> =
        gqlData?.data?.app?.releases?.nodes ?? [];
      for (const rel of releases) {
        logs.push({
          timestamp: rel.createdAt,
          level: rel.status === "failed" ? "error" : "info",
          message: `Release ${rel.id.slice(0, 8)} — status: ${rel.status}${rel.reason ? `, reason: ${rel.reason}` : ""}${rel.user?.email ? ` by ${rel.user.email}` : ""}`,
          source: "fly-runtime",
        });
      }
    }
  } catch (err) {
    errors.fly = err instanceof Error ? err.message : String(err);
  }

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

async function fetchVercelLogs(
  gitBranch: string | null,
  deploymentId: string | null,
  errors: Record<string, string>
): Promise<LogEntry[]> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) {
    if (!token) errors.vercel = "VERCEL_API_TOKEN not configured";
    return [];
  }

  const teamParam = process.env.VERCEL_TEAM_ID ? `&teamId=${process.env.VERCEL_TEAM_ID}` : "";
  const logs: LogEntry[] = [];

  try {
    // Find the latest deployment for this branch
    let dplId = deploymentId;
    if (!dplId && gitBranch) {
      const listRes = await fetch(
        `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=3&meta-githubCommitRef=${encodeURIComponent(gitBranch)}${teamParam}`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8_000) }
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        dplId = listData.deployments?.[0]?.uid ?? null;
      }
    }

    if (!dplId) {
      return [];
    }

    // Fetch deployment build events
    const eventsRes = await fetch(
      `https://api.vercel.com/v2/deployments/${dplId}/events?limit=100${teamParam}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) }
    );

    if (eventsRes.ok) {
      const events: Array<{
        type: string;
        created: number;
        payload?: { text?: string; name?: string; value?: string; info?: { type?: string; message?: string } };
      }> = await eventsRes.json().catch(() => []) ?? [];

      for (const ev of events) {
        const ts = new Date(ev.created).toISOString();
        let message = "";
        let level: LogEntry["level"] = "info";

        if (ev.type === "stdout" || ev.type === "stderr") {
          message = ev.payload?.text ?? "";
          if (ev.type === "stderr") level = "warn";
        } else if (ev.type === "command") {
          message = `$ ${ev.payload?.text ?? ev.payload?.name ?? ""}`;
        } else if (ev.type === "ready") {
          message = "Deployment ready";
        } else if (ev.type === "error") {
          message = ev.payload?.info?.message ?? ev.payload?.text ?? "Error";
          level = "error";
        } else if (ev.type === "building") {
          message = "Build started";
        } else {
          message = ev.payload?.text ?? ev.type;
        }

        if (!message.trim()) continue;
        logs.push({ timestamp: ts, level, message: message.trimEnd(), source: "vercel-build" });
      }
    } else {
      errors.vercel = `Vercel events API ${eventsRes.status}`;
    }
  } catch (err) {
    errors.vercel = err instanceof Error ? err.message : String(err);
  }

  return logs;
}
