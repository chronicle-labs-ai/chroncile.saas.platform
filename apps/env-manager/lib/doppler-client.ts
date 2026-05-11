import type { PermanentEnvConfig } from "./permanent-envs";

const DOPPLER_API_BASE =
  process.env.DOPPLER_API_BASE ?? "https://api.doppler.com";
const DOPPLER_TIMEOUT_MS = 10_000;

type ManagedService = "backend" | "frontend";

interface DopplerAccess {
  project: string;
  config: string;
  token: string;
}

const secretCache = new Map<string, Promise<Record<string, string>>>();

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getAccess(
  config: PermanentEnvConfig,
  service: ManagedService
): DopplerAccess | null {
  const project = readEnv("DOPPLER_PROJECT") ?? "chronicle-platform";
  const configEnvVar =
    service === "backend"
      ? config.backendConfigEnvVar
      : config.frontendConfigEnvVar;
  const tokenEnvVar =
    service === "backend"
      ? config.backendTokenEnvVar
      : config.frontendTokenEnvVar;
  const configName = readEnv(configEnvVar) ?? `${config.dopplerEnv}_${service}`;
  const token = readEnv(tokenEnvVar);

  if (!token) return null;

  return { project, config: configName, token };
}

async function downloadSecrets(
  access: DopplerAccess
): Promise<Record<string, string>> {
  const cacheKey = `${access.project}:${access.config}:${access.token.slice(0, 16)}`;
  const cached = secretCache.get(cacheKey);
  if (cached) return cached;

  const request = (async () => {
    const url = new URL(
      "/v3/configs/config/secrets/download",
      DOPPLER_API_BASE
    );
    url.searchParams.set("project", access.project);
    url.searchParams.set("config", access.config);
    url.searchParams.set("format", "json");

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${access.token}`,
      },
      signal: AbortSignal.timeout(DOPPLER_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Doppler secrets download failed for ${access.config}: ${response.status} ${body}`
      );
    }

    return response.json() as Promise<Record<string, string>>;
  })();

  secretCache.set(cacheKey, request);

  try {
    return await request;
  } catch (error) {
    secretCache.delete(cacheKey);
    throw error;
  }
}

export async function getPermanentEnvSecrets(
  config: PermanentEnvConfig,
  service: ManagedService,
  keys?: string[]
): Promise<Record<string, string> | null> {
  const access = getAccess(config, service);
  if (!access) return null;

  const secrets = await downloadSecrets(access);
  if (!keys) return secrets;

  return Object.fromEntries(
    keys
      .map((key) => [key, secrets[key]])
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
  );
}
