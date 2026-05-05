import { loginErrorMessages } from "./login";
import { networkErrorMessages } from "./network";
import { signupErrorMessages } from "./signup";
import type { Dictionary, HumanizedBackendError } from "./types";
import { workspaceErrorMessages } from "./workspace";

export type { ErrorField, HumanizedBackendError } from "./types";

/*
 * Single source of truth for every code → message mapping. Keys must
 * stay in sync with the strings emitted by routes under
 * `app/api/**` and the backend handlers it forwards from.
 *
 * If you ship a route that returns a new `{ error: code }`, add the
 * code to the relevant per-domain dictionary in this folder.
 */
const DICTIONARY: Dictionary = {
  ...loginErrorMessages,
  ...signupErrorMessages,
  ...workspaceErrorMessages,
  ...networkErrorMessages,
};

/**
 * Translate a backend error code into a human-readable message.
 * Always returns something sensible — never the raw code. Use this
 * everywhere you display an error from a backend response.
 *
 * @example
 *   const { message, field } = humanizeBackendError(data.error);
 *   if (field) setFieldErrors({ [field]: message });
 *   else setBanner(message);
 */
export function humanizeBackendError(
  code: string | null | undefined,
): HumanizedBackendError {
  if (!code) {
    return {
      message: "Something went wrong. Try again.",
      recoverable: true,
    };
  }

  const entry = DICTIONARY[code];
  if (entry) {
    return {
      message: entry.message,
      field: entry.field,
      recoverable: entry.recoverable,
    };
  }

  // Unknown code — log for the dev to add an entry, but show the user
  // a generic message so we never leak `email_taken_by_workos` or
  // similar internals.
  if (typeof window !== "undefined") {
    console.warn(
      `[humanizeBackendError] unmapped code: "${code}". Add it to the relevant error-messages dictionary.`,
    );
  }
  return {
    message: "Something went wrong. Try again.",
    recoverable: true,
  };
}
