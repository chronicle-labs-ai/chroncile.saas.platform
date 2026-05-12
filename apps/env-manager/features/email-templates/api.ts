import type {
  AssignEmailTemplateInput,
  EmailTemplateKey,
  RegisterTemplateKeyInput,
} from "./types";

async function parseMutationError(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export async function registerTemplateKey(
  input: RegisterTemplateKeyInput
): Promise<EmailTemplateKey> {
  const response = await fetch("/api/email-templates/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: input.key,
      name: input.name,
      description: input.description,
      category: input.category,
      variables: JSON.parse(input.variablesText),
    }),
  });

  if (!response.ok) {
    throw new Error(
      await parseMutationError(response, "Failed to register key")
    );
  }

  return response.json();
}

export async function assignEmailTemplate(input: AssignEmailTemplateInput) {
  const response = await fetch("/api/email-templates/assignments", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      templateKeyId: input.templateKeyId,
      environmentId: input.environmentId || null,
      resendTemplateId: input.resendTemplateId,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await parseMutationError(response, "Failed to assign template")
    );
  }
}

export async function deleteTemplateKey(id: string) {
  const response = await fetch(`/api/email-templates/keys/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await parseMutationError(response, "Failed to delete key"));
  }
}

export async function deleteAssignment(id: string) {
  const response = await fetch(`/api/email-templates/assignments/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(
      await parseMutationError(response, "Failed to remove assignment")
    );
  }
}
