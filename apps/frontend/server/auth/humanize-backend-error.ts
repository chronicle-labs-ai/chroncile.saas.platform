/*
 * Backwards-compatible re-export shim.
 *
 * The dictionary now lives split per domain in
 * `./error-messages/{login,signup,workspace,network}.ts`. Existing
 * call sites continue to import from this path; new code should
 * prefer `@/server/auth/error-messages` directly.
 */
export {
  humanizeBackendError,
  type ErrorField,
  type HumanizedBackendError,
} from "./error-messages";
