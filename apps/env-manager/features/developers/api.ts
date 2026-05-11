import type { CreateDeveloperInput } from "./types";

async function parseMutationError(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export async function createDeveloper(input: CreateDeveloperInput) {
  const response = await fetch("/api/developers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      email: input.email || undefined,
      tunnelDomain: input.tunnelDomain,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await parseMutationError(response, "Failed to add developer")
    );
  }
}

export async function deleteDeveloper(id: string) {
  const response = await fetch(`/api/developers/${id}`, { method: "DELETE" });

  if (!response.ok) {
    throw new Error(
      await parseMutationError(response, "Failed to remove developer")
    );
  }
}
