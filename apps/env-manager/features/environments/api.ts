import type { CreateEphemeralEnvironmentInput } from "./types";

async function parseMutationError(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export async function createEphemeralEnvironment(
  input: CreateEphemeralEnvironmentInput
) {
  const response = await fetch("/api/environments/ephemeral", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      branch: input.branch,
      ttlHours: input.ttlHours,
      secrets: input.secrets,
      dbTemplateId: input.dbTemplateId || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseMutationError(response, "Failed to provision"));
  }
}

export async function destroyEnvironment(id: string) {
  const response = await fetch(`/api/environments/${id}`, { method: "DELETE" });

  if (!response.ok) {
    throw new Error(
      await parseMutationError(response, "Failed to destroy environment")
    );
  }
}
