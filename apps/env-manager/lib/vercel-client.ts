const VERCEL_API_BASE = "https://api.vercel.com";

function vercelHeaders(): HeadersInit {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) throw new Error("VERCEL_API_TOKEN is not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function teamParam(): string {
  const teamId = process.env.VERCEL_TEAM_ID;
  return teamId ? `teamId=${teamId}` : "";
}

function projectId(): string {
  const id = process.env.VERCEL_PROJECT_ID;
  if (!id) throw new Error("VERCEL_PROJECT_ID is not set");
  return id;
}

async function vercelFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${VERCEL_API_BASE}${path}${separator}${teamParam()}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...vercelHeaders(), ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Vercel API ${init?.method ?? "GET"} ${path} → ${res.status}: ${body}`
    );
  }
  return res;
}

export interface VercelDeployment {
  uid: string;
  url: string;
  // List API uses `state`, single deployment API uses `readyState` — handle both
  state?: string;
  readyState?: string;
  meta?: {
    githubCommitSha?: string;
    githubCommitRef?: string;
  };
  created: number;
  ready?: number;
}

export async function listDeployments(
  branch?: string,
  limit = 5
): Promise<VercelDeployment[]> {
  const pid = projectId();
  let path = `/v6/deployments?projectId=${pid}&limit=${limit}`;
  if (branch) {
    path += `&meta-githubCommitRef=${encodeURIComponent(branch)}`;
  }
  const res = await vercelFetch(path);
  const data = await res.json();
  return data.deployments ?? [];
}

export async function getLatestDeploymentUrl(
  branch: string
): Promise<string | null> {
  const deployments = await listDeployments(branch, 1);
  if (deployments.length === 0) return null;
  return `https://${deployments[0].url}`;
}

export interface VercelEnvVar {
  id: string;
  key: string;
  value: string;
  target: string[];
  gitBranch?: string;
}

export interface UpsertEnvVarOptions {
  target: "development" | "preview" | "production";
  gitBranch?: string;
  allowPreviewWideFallback?: boolean;
}

/** Find an existing env var on this project by key + target + optional branch */
async function findEnvVar(
  key: string,
  target: string,
  gitBranch?: string
): Promise<VercelEnvVar | null> {
  const pid = projectId();
  try {
    const res = await vercelFetch(`/v10/projects/${pid}/env`);
    const data = await res.json();
    const vars: VercelEnvVar[] = data.envs ?? [];
    return (
      vars.find(
        (v) =>
          v.key === key &&
          v.target.includes(target) &&
          (gitBranch ? v.gitBranch === gitBranch : !v.gitBranch)
      ) ?? null
    );
  } catch {
    return null;
  }
}

/** Update an existing env var value in-place */
async function updateEnvVar(
  envVarId: string,
  value: string
): Promise<VercelEnvVar> {
  const pid = projectId();
  const res = await vercelFetch(`/v10/projects/${pid}/env/${envVarId}`, {
    method: "PATCH",
    body: JSON.stringify({ value, type: "plain" }),
  });
  return res.json();
}

export async function upsertEnvVar(
  key: string,
  value: string,
  options: UpsertEnvVarOptions
): Promise<VercelEnvVar & { branchScoped: boolean }> {
  const pid = projectId();
  const { target, gitBranch, allowPreviewWideFallback = false } = options;

  const createResponse = await fetch(
    `https://api.vercel.com/v10/projects/${pid}/env?${teamParam()}`,
    {
      method: "POST",
      headers: vercelHeaders(),
      body: JSON.stringify({
        key,
        value,
        type: "plain",
        target: [target],
        ...(gitBranch ? { gitBranch } : {}),
      }),
    }
  );

  if (createResponse.ok) {
    return {
      ...(await createResponse.json()),
      branchScoped: Boolean(gitBranch),
    };
  }

  const createError = (await createResponse.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string };
  };

  if (
    createResponse.status === 400 &&
    createError?.error?.code === "ENV_CONFLICT"
  ) {
    const existing = await findEnvVar(key, target, gitBranch);
    if (existing) {
      const updated = await updateEnvVar(existing.id, value);
      return { ...updated, branchScoped: Boolean(gitBranch) };
    }
  }

  const isBranchNotFound =
    target === "preview" &&
    Boolean(gitBranch) &&
    createResponse.status === 400 &&
    (createError?.error?.message?.toLowerCase().includes("branch") ||
      createError?.error?.code === "BAD_REQUEST");

  if (!(allowPreviewWideFallback && isBranchNotFound)) {
    throw new Error(
      `Vercel upsertEnvVar (${target}${gitBranch ? `:${gitBranch}` : ""}) → ${createResponse.status}: ${JSON.stringify(createError)}`
    );
  }

  const branchRes = await fetch(
    `https://api.vercel.com/v10/projects/${pid}/env?${teamParam()}`,
    {
      method: "POST",
      headers: vercelHeaders(),
      body: JSON.stringify({ key, value, type: "plain", target: ["preview"] }),
    }
  );

  if (branchRes.ok) {
    return { ...(await branchRes.json()), branchScoped: false };
  }

  const branchErr = (await branchRes.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string };
  };

  if (branchRes.status === 400 && branchErr?.error?.code === "ENV_CONFLICT") {
    const existing = await findEnvVar(key, "preview");
    if (existing) {
      const updated = await updateEnvVar(existing.id, value);
      return { ...updated, branchScoped: false };
    }
  }

  throw new Error(
    `Vercel upsertEnvVar preview fallback → ${branchRes.status}: ${JSON.stringify(branchErr)}`
  );
}

export async function setEnvVar(
  key: string,
  value: string,
  gitBranch: string
): Promise<VercelEnvVar & { branchScoped: boolean }> {
  return upsertEnvVar(key, value, {
    target: "preview",
    gitBranch,
    allowPreviewWideFallback: true,
  });
}

export async function upsertEnvVars(
  values: Record<string, string>,
  options: UpsertEnvVarOptions
): Promise<Array<VercelEnvVar & { branchScoped: boolean }>> {
  const entries = Object.entries(values).filter((entry) => entry[1].length > 0);
  const results: Array<VercelEnvVar & { branchScoped: boolean }> = [];

  for (const [key, value] of entries) {
    results.push(await upsertEnvVar(key, value, options));
  }

  return results;
}

export async function deleteEnvVar(envVarId: string): Promise<void> {
  const pid = projectId();
  await vercelFetch(`/v10/projects/${pid}/env/${envVarId}`, {
    method: "DELETE",
  });
}

/**
 * Trigger a Vercel deployment for a branch using the connected GitHub repo.
 * Returns the deployment uid + initial URL, or null if the project has no
 * connected repo.
 */
export async function triggerBranchDeployment(
  branch: string
): Promise<{ uid: string; url: string } | null> {
  const pid = projectId();

  let repoId: number | null = null;
  try {
    const projRes = await vercelFetch(`/v9/projects/${pid}`);
    const projData = await projRes.json();
    if (projData.link?.type === "github" && projData.link.repoId) {
      repoId = Number(projData.link.repoId);
    }
  } catch {
    return null;
  }

  if (!repoId) return null;

  // Only send ref — Vercel resolves to the latest commit on the branch.
  // Sending sha can cause "incorrect_git_source_info" if the SHA format
  // doesn't match exactly what Vercel expects.
  const res = await vercelFetch(`/v13/deployments`, {
    method: "POST",
    body: JSON.stringify({
      name: pid,
      project: pid,
      gitSource: { type: "github", repoId, ref: branch },
    }),
  });

  const data = await res.json();
  if (!data.id) return null;

  return { uid: data.id, url: data.url };
}

/**
 * Poll a deployment by ID until it reaches READY, ERROR, or CANCELED.
 * Returns the final URL and state.
 */
export async function waitForDeployment(
  deploymentId: string,
  timeoutMs = 600_000,
  intervalMs = 15_000
): Promise<{ url: string | null; state: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await vercelFetch(`/v13/deployments/${deploymentId}`);
      const data: VercelDeployment = await res.json();
      // Single deployment endpoint returns readyState; list endpoint returns state
      const deployState = data.readyState ?? data.state ?? "";
      if (deployState === "READY")
        return { url: `https://${data.url}`, state: "READY" };
      if (deployState === "ERROR" || deployState === "CANCELED")
        return { url: null, state: deployState };
    } catch {
      // transient error — keep polling
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { url: null, state: "TIMEOUT" };
}
