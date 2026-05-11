import type { EmailTemplateCategory } from "./types";

export const DEFAULT_REGISTER_VARIABLES = "[]";

export const EMAIL_TEMPLATE_CATEGORIES: {
  value: EmailTemplateCategory;
  label: string;
}[] = [
  { value: "transactional", label: "Transactional" },
  { value: "auth", label: "Auth" },
  { value: "notification", label: "Notification" },
];
