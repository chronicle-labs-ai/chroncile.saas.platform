import type { CreateDbTemplateInput } from "./types";

async function parseMutationError(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export async function createDbTemplate(input: CreateDbTemplateInput) {
  const response = await fetch("/api/db-templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      description: input.description || undefined,
      mode: input.mode,
      flyDbName: input.mode === "FLY_DB" ? input.flyDbName : undefined,
      sourceEnvId: input.mode === "ENVIRONMENT" ? input.sourceEnvId : undefined,
      seedSqlUrl: input.seedSqlUrl || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await parseMutationError(response, "Failed to create template")
    );
  }
}

export async function deleteDbTemplate(id: string) {
  const response = await fetch(`/api/db-templates/${id}`, { method: "DELETE" });

  if (!response.ok) {
    throw new Error(
      await parseMutationError(response, "Failed to delete template")
    );
  }
}
