export type EmailTemplateCategory = "transactional" | "auth" | "notification";

export interface TemplateVariable {
  key: string;
  type: "string" | "number";
  description?: string;
  sampleValue?: string;
}

export interface EmailTemplateKey {
  id: string;
  key: string;
  name: string;
  description: string | null;
  variables: TemplateVariable[];
  category: string;
  createdAt: string;
  assignments: {
    id: string;
    resendTemplateId: string;
    environmentId: string | null;
    environment: { id: string; name: string } | null;
  }[];
}

export interface Assignment {
  id: string;
  resendTemplateId: string;
  templateKeyId: string;
  environmentId: string | null;
  templateKey: { id: string; key: string; name: string };
  environment: { id: string; name: string } | null;
  createdAt: string;
}

export interface ResendTemplate {
  id: string;
  name: string;
  alias: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface ResendTemplatesResponse {
  data: ResendTemplate[];
}

export interface RegisterTemplateKeyInput {
  key: string;
  name: string;
  description: string;
  category: string;
  variablesText: string;
}

export interface AssignEmailTemplateInput {
  templateKeyId: string;
  environmentId: string;
  resendTemplateId: string;
}
