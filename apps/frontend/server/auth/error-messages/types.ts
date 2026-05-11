export type ErrorField =
  | "email"
  | "password"
  | "code"
  | "orgName"
  | "slug"
  | "general";

export interface HumanizedBackendError {
  /** Plain-language message to show the user. Always set. */
  message: string;
  /**
   * If the error is bound to a specific input, the field name here
   * lets the caller render the message next to that input instead of
   * (or in addition to) a top-level banner.
   */
  field?: ErrorField;
  /**
   * True when the failure is recoverable by the user retrying (network
   * blips, transient 5xx, etc). Callers can use this to soften the
   * banner copy or suggest a retry button.
   */
  recoverable?: boolean;
}

export interface Entry {
  message: string;
  field?: ErrorField;
  recoverable?: boolean;
}

export type Dictionary = Record<string, Entry>;
