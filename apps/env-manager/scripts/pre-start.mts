#!/usr/bin/env node
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import { resolve } from "node:path";

const DEFAULT_LOCAL_PROXY_PORT = "15432";
const NEXT_ARGS = ["dev", "--port", "3100", "--turbopack"];

type Env = NodeJS.ProcessEnv;

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};

  const env: Record<string, string> = {};
  const contents = readFileSync(path, "utf8");

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    let value = rawValue.trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function loadDevEnv(): Env {
  const cwd = process.cwd();

  return {
    ...loadEnvFile(resolve(cwd, ".env")),
    ...loadEnvFile(resolve(cwd, ".env.local")),
    ...process.env,
  };
}

function getFlycastProxyEnv(env: Env): Env {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl || env.ENV_MANAGER_DB_PROXY === "0") return env;

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    console.warn("[env-manager] DATABASE_URL is not a valid URL; skipping Fly proxy setup.");
    return env;
  }

  if (!url.hostname.endsWith(".flycast")) return env;

  const appName = env.ENV_MANAGER_DB_PROXY_APP ?? url.hostname.replace(/\.flycast$/, "");
  const localPort = env.ENV_MANAGER_DB_PROXY_PORT ?? DEFAULT_LOCAL_PROXY_PORT;

  url.hostname = "127.0.0.1";
  url.port = localPort;

  return {
    ...env,
    DATABASE_URL: url.toString(),
    ENV_MANAGER_DB_PROXY_APP: appName,
    ENV_MANAGER_DB_PROXY_PORT: localPort,
    ENV_MANAGER_DB_PROXY_REMOTE_PORT: env.ENV_MANAGER_DB_PROXY_REMOTE_PORT ?? "5432",
  };
}

function isFlycastProxyRequired(env: Env): boolean {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl || env.ENV_MANAGER_DB_PROXY === "0") return false;

  try {
    return new URL(databaseUrl).hostname.endsWith(".flycast");
  } catch {
    return false;
  }
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolvePort) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });

    socket.once("connect", () => {
      socket.destroy();
      resolvePort(true);
    });

    socket.once("error", () => {
      socket.destroy();
      resolvePort(false);
    });
  });
}

async function waitForPort(port: number, timeoutMs = 10_000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isPortOpen(port)) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }

  throw new Error(`Timed out waiting for Fly proxy on localhost:${port}`);
}

async function startFlyProxy(env: Env): Promise<ChildProcess | undefined> {
  const appName = env.ENV_MANAGER_DB_PROXY_APP;
  const localPort = Number(env.ENV_MANAGER_DB_PROXY_PORT);
  const remotePort = env.ENV_MANAGER_DB_PROXY_REMOTE_PORT ?? "5432";

  if (!appName || !Number.isInteger(localPort)) {
    throw new Error("Fly proxy configuration is incomplete.");
  }

  if (await isPortOpen(localPort)) {
    console.log(`[env-manager] Reusing existing database listener on localhost:${localPort}.`);
    return undefined;
  }

  console.log(`[env-manager] Starting Fly proxy for ${appName}: localhost:${localPort} -> ${remotePort}`);

  const proxy = spawn("fly", ["proxy", `${localPort}:${remotePort}`, "-a", appName], {
    env,
    stdio: ["ignore", "inherit", "inherit"],
  });

  proxy.once("error", (error) => {
    console.error(`[env-manager] Failed to start Fly proxy: ${error.message}`);
  });

  await waitForPort(localPort);
  return proxy;
}

function stopProcess(child: ChildProcess | undefined): void {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
}

async function main() {
  const loadedEnv = loadDevEnv();
  const childEnv = getFlycastProxyEnv(loadedEnv);
  let proxy: ChildProcess | undefined;

  if (isFlycastProxyRequired(loadedEnv)) {
    proxy = await startFlyProxy(childEnv);
  }

  const next = spawn("next", NEXT_ARGS, {
    env: childEnv,
    stdio: "inherit",
  });

  const cleanup = () => stopProcess(proxy);

  process.once("SIGINT", () => {
    cleanup();
    next.kill("SIGINT");
  });

  process.once("SIGTERM", () => {
    cleanup();
    next.kill("SIGTERM");
  });

  next.once("exit", (code, signal) => {
    cleanup();
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(`[env-manager] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
