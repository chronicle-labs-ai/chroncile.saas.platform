import { execFile as _execFile, spawn as _spawn } from "child_process";
import { promisify } from "util";
import { readdir, readFile, writeFile } from "fs/promises";
import { createWriteStream } from "fs";
import { join, resolve } from "path";
import pg from "pg";

const execAsync = promisify(_execFile);

const CONTAINER_NAME = "chronicle-local-pg";
const PG_IMAGE = "postgres:16-alpine";
const PG_PORT = 5432;
const PG_USER = "chronicle";
const PG_PASSWORD = "chronicle_dev";
const PG_DB = "chronicle";
const VOLUME_NAME = "chronicle-local-pgdata";

const REPO_ROOT = resolve(process.cwd(), "../..");
const BACKEND_DIR = join(REPO_ROOT, "backend");
const ENV_MANAGER_DIR = resolve(process.cwd());
const BACKEND_URL = process.env.LOCAL_BACKEND_URL ?? "http://localhost:8080";

const LOCAL_DATABASE_URL = `postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DB}`;
const BACKEND_LOG_FILE = join(ENV_MANAGER_DIR, ".backend-local.log");
const BACKEND_LOG_MAX_LINES = 200;

export type ContainerState = "running" | "stopped" | "not-found";

export interface ContainerStatus {
  state: ContainerState;
  pgReady: boolean;
  containerId?: string;
  image?: string;
  ports?: string;
  uptime?: string;
}

export interface MigrationEntry {
  version: string;
  description: string;
  appliedAt: string;
}

export interface MigrationStatus {
  sqlx: {
    applied: MigrationEntry[];
    pending: string[];
    currentVersion: string | null;
  };
  prisma: {
    applied: Array<{ name: string; appliedAt: string }>;
    status: string;
  };
  overallVersion: string;
  overallStatus: "up-to-date" | "pending-migrations" | "no-migrations-table" | "error";
}

export interface DbInfo {
  databases: Array<{ name: string; size: string }>;
  activeConnections: number;
  tableCount: number;
  tables: string[];
}

export interface LocalDbStatus {
  dockerAvailable: boolean;
  dockerError: string | null;
  container: ContainerStatus;
  migrations: MigrationStatus | null;
  dbInfo: DbInfo | null;
  backendPid: number | null;
  backendHealthy: boolean;
  databaseUrl: string;
}

export interface MigrationResult {
  target: string;
  success: boolean;
  stdout: string;
  stderr: string;
}

async function exec(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number },
): Promise<{ stdout: string; stderr: string }> {
  return execAsync(cmd, args, {
    env: { ...process.env, ...opts?.env },
    cwd: opts?.cwd,
    timeout: opts?.timeout ?? 30_000,
  });
}

function pgClient(): pg.Client {
  return new pg.Client({
    host: "127.0.0.1",
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: PG_DB,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
  });
}

// ─── Docker Availability ───

export async function checkDockerAvailable(): Promise<{ available: boolean; error: string | null }> {
  try {
    await exec("docker", ["info"], { timeout: 5_000 });
    return { available: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Cannot connect to the Docker daemon") || message.includes("docker.sock")) {
      return {
        available: false,
        error: "Docker daemon is not running. Start Docker Desktop and try again.",
      };
    }
    if (message.includes("ENOENT") || message.includes("not found")) {
      return {
        available: false,
        error: "Docker CLI not found. Install Docker Desktop from https://docker.com/products/docker-desktop",
      };
    }
    return { available: false, error: `Docker unavailable: ${message}` };
  }
}

async function requireDocker(): Promise<void> {
  const { available, error } = await checkDockerAvailable();
  if (!available) {
    throw new Error(error ?? "Docker is not available");
  }
}

// ─── Container Management ───

export async function getContainerStatus(): Promise<ContainerStatus> {
  try {
    const { stdout } = await exec("docker", [
      "inspect",
      "--format",
      '{{.State.Status}}|{{.Id}}|{{.Config.Image}}|{{.State.StartedAt}}',
      CONTAINER_NAME,
    ]);
    const [status, id, image, startedAt] = stdout.trim().split("|");
    const state: ContainerState =
      status === "running" ? "running" : "stopped";
    const pgReady = state === "running" ? await checkPgReady() : false;
    return {
      state,
      pgReady,
      containerId: id?.slice(0, 12),
      image,
      uptime: state === "running" ? startedAt : undefined,
    };
  } catch {
    return { state: "not-found", pgReady: false };
  }
}

async function checkPgReady(): Promise<boolean> {
  try {
    await exec("docker", [
      "exec",
      CONTAINER_NAME,
      "pg_isready",
      "-U",
      PG_USER,
    ]);
    return true;
  } catch {
    return false;
  }
}

async function waitForPgReady(
  timeoutMs = 30_000,
  intervalMs = 1_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await checkPgReady()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

export async function startPostgres(): Promise<ContainerStatus> {
  await requireDocker();
  const current = await getContainerStatus();

  if (current.state === "running") return current;

  if (current.state === "stopped") {
    await exec("docker", ["start", CONTAINER_NAME]);
  } else {
    await exec("docker", [
      "run",
      "-d",
      "--name",
      CONTAINER_NAME,
      "-e",
      `POSTGRES_USER=${PG_USER}`,
      "-e",
      `POSTGRES_PASSWORD=${PG_PASSWORD}`,
      "-e",
      `POSTGRES_DB=${PG_DB}`,
      "-p",
      `${PG_PORT}:5432`,
      "-v",
      `${VOLUME_NAME}:/var/lib/postgresql/data`,
      "--health-cmd",
      `pg_isready -U ${PG_USER}`,
      "--health-interval",
      "5s",
      "--health-timeout",
      "5s",
      "--health-retries",
      "5",
      PG_IMAGE,
    ]);
  }

  await waitForPgReady();

  try {
    const { stdout } = await exec("docker", [
      "exec", CONTAINER_NAME,
      "psql", "-U", PG_USER, "-tc",
      "SELECT 1 FROM pg_database WHERE datname = 'env_manager'",
    ]);
    if (!stdout.trim()) {
      await exec("docker", [
        "exec", CONTAINER_NAME,
        "psql", "-U", PG_USER, "-c",
        "CREATE DATABASE env_manager",
      ]);
    }
  } catch {
    // non-critical -- env_manager DB creation is best-effort
  }

  return getContainerStatus();
}

export async function stopPostgres(): Promise<ContainerStatus> {
  await requireDocker();
  const current = await getContainerStatus();
  if (current.state === "not-found") return current;

  if (current.state === "running") {
    await exec("docker", ["stop", CONTAINER_NAME]);
  }
  return getContainerStatus();
}

export async function resetPostgres(): Promise<ContainerStatus> {
  await requireDocker();
  try {
    await exec("docker", ["rm", "-f", CONTAINER_NAME]);
  } catch {
    // container didn't exist
  }
  try {
    await exec("docker", ["volume", "rm", VOLUME_NAME]);
  } catch {
    // volume didn't exist
  }
  return startPostgres();
}

// ─── Database Info ───

export async function getDbInfo(): Promise<DbInfo | null> {
  const client = pgClient();
  try {
    await client.connect();

    const dbRes = await client.query<{ datname: string; size: string }>(
      `SELECT datname, pg_size_pretty(pg_database_size(datname)) AS size
       FROM pg_database WHERE datistemplate = false ORDER BY datname`,
    );

    const connRes = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM pg_stat_activity
       WHERE datname = $1`,
      [PG_DB],
    );

    const tableRes = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );

    return {
      databases: dbRes.rows.map((r) => ({ name: r.datname, size: r.size })),
      activeConnections: parseInt(connRes.rows[0]?.count ?? "0", 10),
      tableCount: tableRes.rowCount ?? 0,
      tables: tableRes.rows.map((r) => r.tablename),
    };
  } catch {
    return null;
  } finally {
    await client.end().catch(() => {});
  }
}

// ─── Migration Status ───

export async function getMigrationStatus(): Promise<MigrationStatus> {
  const client = pgClient();
  const result: MigrationStatus = {
    sqlx: { applied: [], pending: [], currentVersion: null },
    prisma: { applied: [], status: "unknown" },
    overallVersion: "none",
    overallStatus: "no-migrations-table",
  };

  try {
    await client.connect();

    // SQLx migrations
    try {
      const sqlxRes = await client.query<{
        version: string;
        description: string;
        installed_on: Date;
      }>(
        `SELECT version::text, description, installed_on
         FROM _sqlx_migrations ORDER BY version`,
      );
      result.sqlx.applied = sqlxRes.rows.map((r) => ({
        version: r.version,
        description: r.description,
        appliedAt: r.installed_on.toISOString(),
      }));
      if (result.sqlx.applied.length > 0) {
        result.sqlx.currentVersion =
          result.sqlx.applied[result.sqlx.applied.length - 1].version;
      }

      // Find pending by scanning migration files on disk
      try {
        const files = await readdir(join(BACKEND_DIR, "migrations"));
        const onDisk = files
          .filter((f) => f.endsWith(".sql"))
          .map((f) => f.replace(".sql", ""));
        const appliedVersions = new Set(
          result.sqlx.applied.map((m) => m.version),
        );
        result.sqlx.pending = onDisk.filter((f) => {
          const ver = f.split("_")[0];
          return !appliedVersions.has(ver);
        });
      } catch {
        // migrations dir not readable
      }

      result.overallStatus =
        result.sqlx.pending.length > 0 ? "pending-migrations" : "up-to-date";
      result.overallVersion = result.sqlx.currentVersion ?? "none";
    } catch {
      result.overallStatus = "no-migrations-table";
    }

    // Prisma migrations
    try {
      const prismaRes = await client.query<{
        migration_name: string;
        finished_at: Date | null;
      }>(
        `SELECT migration_name, finished_at
         FROM _prisma_migrations ORDER BY started_at`,
      );
      result.prisma.applied = prismaRes.rows.map((r) => ({
        name: r.migration_name,
        appliedAt: r.finished_at?.toISOString() ?? "in-progress",
      }));
      result.prisma.status =
        result.prisma.applied.length > 0 ? "applied" : "empty";
    } catch {
      result.prisma.status = "no-table";
    }
  } catch {
    result.overallStatus = "error";
  } finally {
    await client.end().catch(() => {});
  }

  return result;
}

// ─── Run Migrations ───

export async function runMigrations(
  targets?: ("sqlx" | "prisma")[],
): Promise<{ before: MigrationStatus; after: MigrationStatus; results: MigrationResult[] }> {
  const before = await getMigrationStatus();
  const results: MigrationResult[] = [];
  const runSqlx = !targets || targets.includes("sqlx");
  const runPrisma = !targets || targets.includes("prisma");

  if (runSqlx) {
    try {
      const { stdout, stderr } = await exec(
        "sqlx",
        ["migrate", "run"],
        {
          cwd: BACKEND_DIR,
          env: { ...process.env, DATABASE_URL: LOCAL_DATABASE_URL },
          timeout: 60_000,
        },
      );
      results.push({ target: "sqlx", success: true, stdout, stderr });
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      results.push({
        target: "sqlx",
        success: false,
        stdout: e.stdout ?? "",
        stderr: e.stderr ?? e.message ?? String(err),
      });
    }
  }

  if (runPrisma) {
    try {
      const { stdout, stderr } = await exec(
        "npx",
        ["prisma", "db", "push", "--skip-generate"],
        {
          cwd: ENV_MANAGER_DIR,
          env: { ...process.env, DATABASE_URL: LOCAL_DATABASE_URL },
          timeout: 60_000,
        },
      );
      results.push({ target: "prisma", success: true, stdout, stderr });
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      results.push({
        target: "prisma",
        success: false,
        stdout: e.stdout ?? "",
        stderr: e.stderr ?? e.message ?? String(err),
      });
    }
  }

  const after = await getMigrationStatus();
  return { before, after, results };
}

// ─── Seeds ───

export async function runSeed(seedName: string): Promise<{ success: boolean; rowsAffected?: string; error?: string }> {
  const safeName = seedName.replace(/[^a-z0-9-]/g, "");
  const seedPath = join(ENV_MANAGER_DIR, "seeds", `${safeName}.sql`);

  const { readFile } = await import("fs/promises");
  let sql: string;
  try {
    sql = await readFile(seedPath, "utf-8");
  } catch {
    return { success: false, error: `Seed file not found: ${safeName}.sql` };
  }

  const client = pgClient();
  try {
    await client.connect();
    const res = await client.query(sql);
    const rowsAffected = Array.isArray(res)
      ? res.map((r) => r.rowCount ?? 0).reduce((a, b) => a + b, 0).toString()
      : (res.rowCount ?? 0).toString();
    return { success: true, rowsAffected };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await client.end().catch(() => {});
  }
}

// ─── Backend Process Control ───

export async function getBackendPid(): Promise<number | null> {
  try {
    const { stdout } = await exec("pgrep", ["-f", "chronicle-backend"]);
    const pids = stdout
      .trim()
      .split("\n")
      .map((s) => parseInt(s, 10))
      .filter((n) => !isNaN(n));
    return pids[0] ?? null;
  } catch {
    return null;
  }
}

async function checkBackendHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getBackendLogs(tail = BACKEND_LOG_MAX_LINES): Promise<string> {
  try {
    const content = await readFile(BACKEND_LOG_FILE, "utf-8");
    const lines = content.split("\n");
    return lines.slice(-tail).join("\n");
  } catch {
    return "";
  }
}

export async function restartBackend(): Promise<{
  success: boolean;
  pid: number | null;
  logs: string;
  error?: string;
}> {
  const existingPid = await getBackendPid();
  if (existingPid) {
    try {
      process.kill(existingPid, "SIGTERM");
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        try {
          process.kill(existingPid, 0);
          await new Promise((r) => setTimeout(r, 500));
        } catch {
          break;
        }
      }
    } catch {
      // process already gone
    }
  }

  await writeFile(BACKEND_LOG_FILE, `--- Backend restart at ${new Date().toISOString()} ---\n`);
  const logStream = createWriteStream(BACKEND_LOG_FILE, { flags: "a" });

  const backendEnv = { ...process.env };
  try {
    const dotenv = await readFile(join(BACKEND_DIR, ".env"), "utf-8");
    for (const line of dotenv.split("\n")) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/);
      if (match) backendEnv[match[1]] = match[2];
    }
  } catch {
    // no backend .env, use process.env as-is
  }

  const child = _spawn("cargo", ["run", "--bin", "chronicle-backend"], {
    cwd: BACKEND_DIR,
    env: backendEnv,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.pipe(logStream);
  child.stderr?.pipe(logStream);
  child.unref();

  child.on("exit", (code) => {
    logStream.write(`\n--- Process exited with code ${code} at ${new Date().toISOString()} ---\n`);
    logStream.end();
  });

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await checkBackendHealthy()) {
      const newPid = await getBackendPid();
      const logs = await getBackendLogs();
      return { success: true, pid: newPid, logs };
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }

  const newPid = await getBackendPid();
  const logs = await getBackendLogs();
  return {
    success: false,
    pid: newPid,
    logs,
    error: "Backend did not become healthy within 120s. Check the logs for details.",
  };
}

// ─── Combined Status ───

export async function getLocalDbStatus(): Promise<LocalDbStatus> {
  const docker = await checkDockerAvailable();
  const backendPid = await getBackendPid();
  const backendHealthy = await checkBackendHealthy();

  if (!docker.available) {
    return {
      dockerAvailable: false,
      dockerError: docker.error,
      container: { state: "not-found", pgReady: false },
      migrations: null,
      dbInfo: null,
      backendPid,
      backendHealthy,
      databaseUrl: LOCAL_DATABASE_URL,
    };
  }

  const container = await getContainerStatus();

  let migrations: MigrationStatus | null = null;
  let dbInfo: DbInfo | null = null;

  if (container.pgReady) {
    [migrations, dbInfo] = await Promise.all([
      getMigrationStatus(),
      getDbInfo(),
    ]);
  }

  return {
    dockerAvailable: true,
    dockerError: null,
    container,
    migrations,
    dbInfo,
    backendPid,
    backendHealthy,
    databaseUrl: LOCAL_DATABASE_URL,
  };
}
