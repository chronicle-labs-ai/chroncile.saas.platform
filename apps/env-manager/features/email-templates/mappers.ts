import type {
  EmailTemplateAssignmentTarget,
  EmailTemplateRegistryEntry,
  EmailTemplateResendTemplate,
} from "ui";
import type { EnvironmentRecord } from "@/frontend/shared/types";
import type { Assignment, EmailTemplateKey, ResendTemplate } from "./types";

export function findMatchingResendTemplate(
  template: EmailTemplateKey,
  resendTemplates: ResendTemplate[]
) {
  return (
    resendTemplates.find((resend) =>
      template.assignments.some(
        (assignment) =>
          assignment.resendTemplateId === resend.alias ||
          assignment.resendTemplateId === resend.id
      )
    ) ??
    resendTemplates.find(
      (resend) => resend.alias === template.key || resend.id === template.key
    )
  );
}

export function toRegistryEntry(
  template: EmailTemplateKey
): EmailTemplateRegistryEntry {
  return {
    id: template.id,
    key: template.key,
    name: template.name,
    description: template.description,
    category: template.category,
    variables: template.variables.map((variable) => variable.key),
    assignments:
      template.assignments.length > 0
        ? template.assignments.map(
            (assignment) => assignment.environment?.name ?? "default"
          )
        : ["none"],
  };
}

export function toResendTemplateCard(
  template: ResendTemplate | undefined
): EmailTemplateResendTemplate | null {
  if (!template) return null;

  return {
    id: template.id,
    name: template.name,
    alias: template.alias,
    status: template.status,
    updatedAt: new Date(template.updated_at).toLocaleDateString(),
  };
}

export function toAssignmentTargets(
  template: EmailTemplateKey,
  environments: EnvironmentRecord[] = []
): EmailTemplateAssignmentTarget[] {
  const selectedEnvironmentIds = new Set(
    template.assignments.map(
      (assignment) => assignment.environmentId ?? "default"
    )
  );

  return environments
    .filter(isEmailTemplateAssignmentEnvironment)
    .sort(sortEmailTemplateAssignmentEnvironment)
    .map((environment) => ({
      id: environment.id,
      name: environment.name,
      description:
        environment.vercelUrl?.replace("https://", "") ?? environment.type,
      selected: selectedEnvironmentIds.has(environment.id),
    }));
}

export function isEmailTemplateAssignmentEnvironment(
  environment: EnvironmentRecord
) {
  const normalizedName = environment.name.toLowerCase();
  return (
    environment.type === "PRODUCTION" ||
    environment.type === "STAGING" ||
    environment.type === "DEVELOPMENT" ||
    normalizedName === "prod" ||
    normalizedName === "production" ||
    normalizedName === "staging" ||
    normalizedName === "stage" ||
    normalizedName === "dev" ||
    normalizedName === "development"
  );
}

export function sortEmailTemplateAssignmentEnvironment(
  first: EnvironmentRecord,
  second: EnvironmentRecord
) {
  const order = new Map([
    ["PRODUCTION", 0],
    ["STAGING", 1],
    ["DEVELOPMENT", 2],
  ]);
  return (order.get(first.type) ?? 99) - (order.get(second.type) ?? 99);
}

export function assignmentEnvironmentLabel(assignment: Assignment) {
  return assignment.environment?.name ?? "default";
}

export function assignmentCreatedLabel(assignment: Assignment) {
  return new Date(assignment.createdAt).toLocaleDateString();
}

export function resendUpdatedLabel(template: ResendTemplate) {
  return new Date(template.updated_at).toLocaleDateString();
}
