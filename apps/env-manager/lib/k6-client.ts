import { writeFile, unlink, readFile } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

const exec = promisify(execFile);

const K6_API_BASE = "https://api.k6.io/cloud/v6";
const K6_INGEST_BASE = "https://ingest.k6.io/v1";

interface K6Config {
  apiToken: string;
  stackId: string;
  projectId: number;
}

function getConfig(): K6Config {
  const apiToken = process.env.K6_CLOUD_API_TOKEN;
  if (!apiToken) throw new Error("K6_CLOUD_API_TOKEN is not set");

  const stackId = process.env.K6_CLOUD_STACK_ID;
  if (!stackId) throw new Error("K6_CLOUD_STACK_ID is not set");

  const projectId = Number(process.env.K6_CLOUD_PROJECT_ID);
  if (!projectId) throw new Error("K6_CLOUD_PROJECT_ID is not set or invalid");

  return { apiToken, stackId, projectId };
}

function k6Headers(cfg: K6Config): HeadersInit {
  return {
    Authorization: `Bearer ${cfg.apiToken}`,
    "X-Stack-Id": cfg.stackId,
    "Content-Type": "application/json",
  };
}

async function k6Fetch(
  path: string,
  init?: RequestInit,
  cfg?: K6Config
): Promise<Response> {
  const config = cfg ?? getConfig();
  const res = await fetch(`${K6_API_BASE}${path}`, {
    ...init,
    headers: { ...k6Headers(config), ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `k6 Cloud API ${init?.method ?? "GET"} ${path} → ${res.status}: ${body}`
    );
  }
  return res;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type K6RunStatus =
  | "created"
  | "queued"
  | "initializing"
  | "running"
  | "processing_metrics"
  | "completed"
  | "aborted";

export interface K6TestRun {
  id: number;
  test_id: number;
  project_id: number;
  status: K6RunStatus;
  created: string;
  ended: string | null;
  result: string | null;
  distribution: Array<{ load_zone: string; percent: number }> | null;
  status_details: { type: string; entered: string };
}

export interface K6LoadTest {
  id: number;
  name: string;
  project_id: number;
  created: string;
  updated: string;
}

// ── Script Builder ───────────────────────────────────────────────────────────

export interface LoadTestConfig {
  vus: number;
  duration: string;
  rampUp: string;
  endpoints: string[];
}

const LOAD_ZONE_MAP: Record<string, string> = {
  "us-east": "amazon:us:ashburn",
  "us-west": "amazon:us:portland",
  "eu-west": "amazon:ie:dublin",
  "eu-central": "amazon:de:frankfurt",
  "ap-southeast": "amazon:sg:singapore",
  "ap-northeast": "amazon:jp:tokyo",
};

export function buildK6Script(
  backendUrl: string,
  frontendUrl: string | null,
  config: LoadTestConfig,
  projectId: number,
  testName: string
): string {
  const stages = buildStages(config);
  const endpoints = config.endpoints.map((ep) => {
    if (ep.startsWith("http")) return ep;
    return `${backendUrl}${ep}`;
  });

  const httpCalls = endpoints
    .map((url) => `  responses.push(http.get(${JSON.stringify(url)}));`)
    .join("\n");

  if (frontendUrl) {
    endpoints.push(frontendUrl);
  }

  return `import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: ${JSON.stringify(stages, null, 4)},
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.1"],
  },
  cloud: {
    projectID: ${projectId},
    name: ${JSON.stringify(testName)},
  },
};

export default function () {
  const responses = [];
${httpCalls}
${frontendUrl ? `  responses.push(http.get(${JSON.stringify(frontendUrl)}));` : ""}

  for (const res of responses) {
    check(res, {
      "status is 2xx": (r) => r.status >= 200 && r.status < 300,
      "response time < 2s": (r) => r.timings.duration < 2000,
    });
  }
  sleep(1);
}
`;
}

function buildStages(
  config: LoadTestConfig
): Array<{ duration: string; target: number }> {
  const stages: Array<{ duration: string; target: number }> = [];

  if (config.rampUp && config.rampUp !== "none" && config.rampUp !== "0s") {
    stages.push({ duration: config.rampUp, target: config.vus });
  }

  stages.push({ duration: config.duration, target: config.vus });

  const rampDownSeconds = Math.max(
    10,
    Math.floor(parseDurationSeconds(config.duration) * 0.1)
  );
  stages.push({ duration: `${rampDownSeconds}s`, target: 0 });

  return stages;
}

function parseDurationSeconds(d: string): number {
  const match = d.match(/^(\d+)(s|m|h)$/);
  if (!match) return 60;
  const value = Number(match[1]);
  switch (match[2]) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 3600;
    default:
      return 60;
  }
}

// ── API Operations ───────────────────────────────────────────────────────────

async function createK6Archive(script: string): Promise<Buffer> {
  const id = randomBytes(6).toString("hex");
  const scriptPath = join(tmpdir(), `k6-script-${id}.js`);
  const archivePath = join(tmpdir(), `k6-archive-${id}.tar`);

  try {
    await writeFile(scriptPath, script, "utf-8");
    await exec("k6", ["archive", scriptPath, "-O", archivePath]);
    return await readFile(archivePath);
  } finally {
    await unlink(scriptPath).catch(() => {});
    await unlink(archivePath).catch(() => {});
  }
}

interface IngestResponse {
  reference_id: string;
  config: {
    testRunDetails: string;
    webAppURL: string;
  };
}

async function uploadArchive(
  archive: Buffer,
  name: string,
  projectId: number,
  cfg: K6Config
): Promise<IngestResponse> {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("project_id", String(projectId));
  formData.append(
    "file",
    new Blob([new Uint8Array(archive)], { type: "application/x-tar" }),
    "archive.tar"
  );

  const res = await fetch(`${K6_INGEST_BASE}/archive-upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiToken}`,
      "X-Stack-Id": cfg.stackId,
    },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`k6 ingest upload failed (${res.status}): ${body}`);
  }

  return res.json();
}

export async function getTestRun(testRunId: number): Promise<K6TestRun> {
  const res = await k6Fetch(`/test_runs/${testRunId}`);
  return res.json();
}

export async function abortTestRun(testRunId: number): Promise<void> {
  await k6Fetch(`/test_runs/${testRunId}/abort`, { method: "POST" });
}

// ── High-level Orchestrator ──────────────────────────────────────────────────

export interface StartLoadTestParams {
  name: string;
  backendUrl: string;
  frontendUrl: string | null;
  config: LoadTestConfig;
}

export interface StartLoadTestResult {
  testRunId: number;
  k6Url: string;
}

export async function launchCloudTest(
  params: StartLoadTestParams
): Promise<StartLoadTestResult> {
  const cfg = getConfig();

  const script = buildK6Script(
    params.backendUrl,
    params.frontendUrl,
    params.config,
    cfg.projectId,
    params.name
  );

  const archive = await createK6Archive(script);
  const result = await uploadArchive(archive, params.name, cfg.projectId, cfg);
  const testRunId = Number(result.reference_id);

  return {
    testRunId,
    k6Url: result.config.testRunDetails,
  };
}

export function resolveLoadZone(region: string): string {
  return LOAD_ZONE_MAP[region] ?? LOAD_ZONE_MAP["us-east"]!;
}

export function isTerminalStatus(status: K6RunStatus): boolean {
  return status === "completed" || status === "aborted";
}

export function isActiveStatus(status: K6RunStatus): boolean {
  return (
    status === "created" ||
    status === "queued" ||
    status === "initializing" ||
    status === "running" ||
    status === "processing_metrics"
  );
}
