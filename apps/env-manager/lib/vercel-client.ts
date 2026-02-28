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
    throw new Error(`Vercel API ${init?.method ?? "GET"} ${path} → ${res.status}: ${body}`);
  }
  return res;
}

export interface VercelDeployment {
  uid: string;
  url: string;
  state: string;
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
    return vars.find((v) =>
      v.key === key &&
      v.target.includes(target) &&
      (gitBranch ? v.gitBranch === gitBranch : !v.gitBranch)
    ) ?? null;
  } catch {
    return null;
  }
}

/** Update an existing env var value in-place */
async function updateEnvVar(envVarId: string, value: string): Promise<VercelEnvVar> {
  const pid = projectId();
  const res = await vercelFetch(`/v10/projects/${pid}/env/${envVarId}`, {
    method: "PATCH",
    body: JSON.stringify({ value, type: "plain" }),
  });
  return res.json();
}

export async function setEnvVar(
  key: string,
  value: string,
  gitBranch: string
): Promise<VercelEnvVar & { branchScoped: boolean }> {
  const pid = projectId();

  // ── 1. Try branch-scoped first ───────────────────────────────────────────
  const branchRes = await fetch(
    `https://api.vercel.com/v10/projects/${pid}/env?${teamParam()}`,
    {
      method: "POST",
      headers: vercelHeaders(),
      body: JSON.stringify({ key, value, type: "plain", target: ["preview"], gitBranch }),
    }
  );

  if (branchRes.ok) {
    return { ...(await branchRes.json()), branchScoped: true };
  }

  const branchErr = await branchRes.json().catch(() => ({})) as { error?: { code?: string; message?: string } };

  // Conflict on branch-scoped → update existing one
  if (branchRes.status === 400 && branchErr?.error?.code === "ENV_CONFLICT") {
    const existing = await findEnvVar(key, "preview", gitBranch);
    if (existing) {
      const updated = await updateEnvVar(existing.id, value);
      return { ...updated, branchScoped: true };
    }
  }

  const isBranchNotFound =
    branchRes.status === 400 &&
    (branchErr?.error?.message?.toLowerCase().includes("branch") ||
      branchErr?.error?.code === "BAD_REQUEST");

  if (!isBranchNotFound) {
    throw new Error(
      `Vercel setEnvVar (branch-scoped) → ${branchRes.status}: ${JSON.stringify(branchErr)}`
    );
  }

  // ── 2. Branch not known to Vercel — fall back to preview-wide ────────────
  // Check for an existing preview-wide var first to avoid ENV_CONFLICT
  const existingWide = await findEnvVar(key, "preview");
  if (existingWide) {
    const updated = await updateEnvVar(existingWide.id, value);
    return { ...updated, branchScoped: false };
  }

  const fallbackRes = await vercelFetch(`/v10/projects/${pid}/env`, {
    method: "POST",
    body: JSON.stringify({ key, value, type: "plain", target: ["preview"] }),
  });
  return { ...(await fallbackRes.json()), branchScoped: false };
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
      if (data.state === "READY") return { url: `https://${data.url}`, state: "READY" };
      if (data.state === "ERROR" || data.state === "CANCELED") return { url: null, state: data.state };
    } catch {
      // transient error — keep polling
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { url: null, state: "TIMEOUT" };
}

