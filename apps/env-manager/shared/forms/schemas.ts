import { z } from "zod";

export const inviteUserSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  name: z.string().trim(),
  sendEmail: z.boolean(),
});

export const createOrgSchema = z.object({
  orgName: z.string().trim().min(2, "Organization name is required"),
  orgSlug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only"),
  adminEmail: z.string().trim().email("Enter a valid admin email"),
  adminName: z.string().trim(),
  sendEmail: z.boolean(),
});

export const sendTestEmailSchema = z.object({
  to: z.string().trim().email("Enter a valid recipient email"),
});

export const registerTemplateKeySchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Key is required")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only"),
  name: z.string().trim().min(1, "Display name is required"),
  description: z.string().trim(),
  category: z.enum(["transactional", "auth", "notification"]),
  variablesText: z.string().refine((value) => {
    try {
      return Array.isArray(JSON.parse(value));
    } catch {
      return false;
    }
  }, "Variables must be valid JSON array"),
});

export const assignTemplateSchema = z.object({
  templateKeyId: z.string().min(1, "Select a template key"),
  environmentId: z.string(),
  resendTemplateId: z.string().trim().min(1, "Resend template ID is required"),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type SendTestEmailInput = z.infer<typeof sendTestEmailSchema>;
export type RegisterTemplateKeyInput = z.infer<
  typeof registerTemplateKeySchema
>;
export type AssignTemplateInput = z.infer<typeof assignTemplateSchema>;
