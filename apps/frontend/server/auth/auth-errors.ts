export type WorkosErrorCode =
  | "email_verification_required"
  | "mfa_enrollment"
  | "mfa_challenge"
  | "organization_selection_required"
  | "sso_required"
  | "organization_authentication_methods_required"
  | "invalid_credentials"
  | "user_creation_failed"
  | "email_already_exists"
  | "authentication_failed"
  | "invalid_grant"
  | "weak_password"
  | string;

export interface ClassifiedAuthError {
  code: WorkosErrorCode;
  message: string;
  pendingAuthenticationToken?: string;
  email?: string;
  connectionIds?: string[];
  authMethods?: Record<string, boolean>;
  organizations?: Array<{ id: string; name: string }>;
}

const CODE_KEYS = ["code", "error"] as const;
const MESSAGE_KEYS = ["message", "error_description", "errorDescription"] as const;
const TOKEN_KEYS = [
  "pendingAuthenticationToken",
  "pending_authentication_token",
] as const;
const EMAIL_KEYS = ["email"] as const;
const CONNECTION_IDS_KEYS = ["connectionIds", "connection_ids", "sso_connection_ids", "ssoConnectionIds"] as const;
const AUTH_METHODS_KEYS = ["authMethods", "auth_methods"] as const;
const ORGANIZATIONS_KEYS = ["organizations"] as const;

function pickString(source: unknown, keys: readonly string[]): string | undefined {
  if (!source || typeof source !== "object") return undefined;
  for (const key of keys) {
    const value = (source as Record<string, unknown>)[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function pickStringArray(
  source: unknown,
  keys: readonly string[],
): string[] | undefined {
  if (!source || typeof source !== "object") return undefined;
  for (const key of keys) {
    const value = (source as Record<string, unknown>)[key];
    if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
      return value as string[];
    }
  }
  return undefined;
}

function pickRecord(
  source: unknown,
  keys: readonly string[],
): Record<string, boolean> | undefined {
  if (!source || typeof source !== "object") return undefined;
  for (const key of keys) {
    const value = (source as Record<string, unknown>)[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const out: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(value)) {
        if (typeof v === "boolean") out[k] = v;
      }
      return out;
    }
  }
  return undefined;
}

function pickOrganizations(
  source: unknown,
): Array<{ id: string; name: string }> | undefined {
  if (!source || typeof source !== "object") return undefined;
  const value = (source as Record<string, unknown>)[ORGANIZATIONS_KEYS[0]];
  if (!Array.isArray(value)) return undefined;
  const out: Array<{ id: string; name: string }> = [];
  for (const entry of value) {
    if (entry && typeof entry === "object") {
      const id = (entry as Record<string, unknown>).id;
      const name = (entry as Record<string, unknown>).name;
      if (typeof id === "string" && typeof name === "string") {
        out.push({ id, name });
      }
    }
  }
  return out.length > 0 ? out : undefined;
}

function flattenErrorSource(err: unknown): unknown {
  if (!err || typeof err !== "object") return err;

  const sources: Record<string, unknown>[] = [];

  const errors = (err as { errors?: unknown[] }).errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0];
    if (first && typeof first === "object") {
      sources.push(first as Record<string, unknown>);
    }
  }

  const rawData = (err as { rawData?: unknown }).rawData;
  if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
    sources.push(rawData as Record<string, unknown>);
  }

  // Pull EVERY own property from the error itself (including non-enumerable
  // ones from Error subclasses, and public class fields).
  const ownProps: Record<string, unknown> = {};
  for (const key of Object.getOwnPropertyNames(err as object)) {
    try {
      ownProps[key] = (err as Record<string, unknown>)[key];
    } catch {
      // ignore non-readable getters
    }
  }
  sources.push(ownProps);

  // Later sources override earlier ones, so outer error wins last.
  return Object.assign({}, ...sources);
}

export function classifyAuthError(err: unknown): ClassifiedAuthError {
  const source = flattenErrorSource(err);

  const code =
    (pickString(source, CODE_KEYS) as WorkosErrorCode | undefined) ??
    "authentication_failed";

  const message =
    pickString(source, MESSAGE_KEYS) ??
    (err instanceof Error ? err.message : "Authentication failed");

  return {
    code,
    message,
    pendingAuthenticationToken: pickString(source, TOKEN_KEYS),
    email: pickString(source, EMAIL_KEYS),
    connectionIds: pickStringArray(source, CONNECTION_IDS_KEYS),
    authMethods: pickRecord(source, AUTH_METHODS_KEYS),
    organizations: pickOrganizations(source),
  };
}

const EMAIL_EXISTS_CODES = new Set([
  "email_already_exists",
  "user_already_exists",
  "email_taken",
]);

function codeMeansEmailExists(code: string | undefined): boolean {
  return code !== undefined && EMAIL_EXISTS_CODES.has(code);
}

export function isEmailAlreadyExistsError(err: unknown): boolean {
  // WorkOS often wraps a specific cause inside `errors[0].code` while the
  // top-level code is a generic wrapper like `user_creation_error`. Check
  // the inner array first, then the flattened source as a fallback.
  if (err && typeof err === "object") {
    const innerErrors = (err as { errors?: unknown }).errors;
    if (Array.isArray(innerErrors)) {
      for (const entry of innerErrors) {
        if (entry && typeof entry === "object") {
          const innerCode = pickString(entry, CODE_KEYS);
          if (codeMeansEmailExists(innerCode)) return true;
          const innerMessage = pickString(entry, MESSAGE_KEYS) ?? "";
          if (
            /email/i.test(innerMessage) &&
            /(exist|taken|use)/i.test(innerMessage)
          ) {
            return true;
          }
        }
      }
    }
  }

  const source = flattenErrorSource(err);
  if (!source || typeof source !== "object") return false;
  const code = pickString(source, CODE_KEYS);
  if (codeMeansEmailExists(code)) {
    return true;
  }
  const status = (source as { status?: unknown }).status;
  if (status === 422 || status === 409) {
    const message = pickString(source, MESSAGE_KEYS) ?? "";
    if (/email/i.test(message) && /(exist|taken|use)/i.test(message)) {
      return true;
    }
  }
  return false;
}

export function isWeakPasswordError(err: unknown): boolean {
  const source = flattenErrorSource(err);
  if (!source || typeof source !== "object") return false;
  const code = pickString(source, CODE_KEYS);
  if (
    code === "weak_password" ||
    code === "password_strength_violation" ||
    code === "invalid_password"
  ) {
    return true;
  }
  const message = pickString(source, MESSAGE_KEYS) ?? "";
  return /password/i.test(message) && /(weak|strength|complexity|short|breach)/i.test(message);
}
