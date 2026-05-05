import type { Dictionary } from "./types";

/*
 * Service / network / generic catch-all codes.
 * Emitted whenever a downstream call fails (WorkOS / backend / 5xx)
 * and the cause isn't one of the more specific domains.
 */
export const networkErrorMessages: Dictionary = {
  workos_unreachable: {
    message:
      "We couldn't reach the auth provider. Try again — your input is preserved.",
    recoverable: true,
  },
  auth_unreachable: {
    message:
      "We couldn't reach the auth provider. Try again — your input is preserved.",
    recoverable: true,
  },
  backend_unreachable: {
    message: "We couldn't reach our servers. Try again in a moment.",
    recoverable: true,
  },
  service_secret_not_configured: {
    message:
      "Something is misconfigured on our end. Contact support so we can fix it.",
  },

  // Generic / catch-all known codes.
  invalid_request: {
    message: "Something about the request was invalid. Try again.",
    recoverable: true,
  },
  refresh_failed: {
    message: "Couldn't refresh your session. Try again.",
    recoverable: true,
  },
  missing_organization_id: {
    message: "Couldn't switch workspace. Try again.",
    recoverable: true,
  },
  invite_failed: {
    message: "We couldn't send the invitation. Try again.",
    recoverable: true,
  },
};
