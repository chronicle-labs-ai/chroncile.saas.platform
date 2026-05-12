import type { EnvironmentStatus, EnvironmentType } from "./types";

export const TYPE_LABELS: Record<EnvironmentType, string> = {
  PRODUCTION: "PROD",
  STAGING: "STG",
  DEVELOPMENT: "DEV",
  LOCAL: "LOCAL",
  EPHEMERAL: "EPH",
};

export const BADGE_CLASS: Record<EnvironmentType, string> = {
  PRODUCTION: "badge--critical",
  STAGING: "badge--caution",
  DEVELOPMENT: "badge--data",
  LOCAL: "badge--nominal",
  EPHEMERAL: "badge--neutral",
};

export const STATUS_DOT_CLASS: Record<EnvironmentStatus, string> = {
  RUNNING: "status-dot--nominal",
  STOPPED: "status-dot--offline",
  PROVISIONING: "status-dot--caution status-dot--pulse",
  DESTROYING: "status-dot--critical status-dot--pulse",
  ERROR: "status-dot--critical",
};

export class ApiFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly statusText: string
  ) {
    super(message);
    this.name = "ApiFetchError";
  }
}

export async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    let message = response.statusText || "Request failed";

    try {
      const body = (await response.json()) as {
        error?: string;
        message?: string;
      };
      message = body.error ?? body.message ?? message;
    } catch {
      // Some framework errors return HTML/plain text; keep the status message.
    }

    throw new ApiFetchError(message, response.status, response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function apiErrorMessage(
  error: unknown,
  fallback = "Unable to load data"
) {
  if (error instanceof ApiFetchError) {
    return `${fallback} (${error.status}): ${error.message}`;
  }

  if (error instanceof Error) {
    return `${fallback}: ${error.message}`;
  }

  return fallback;
}
