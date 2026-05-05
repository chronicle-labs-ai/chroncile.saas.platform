import type { Dictionary } from "./types";

/*
 * Login / sign-in error codes — emitted by `app/api/auth/login`,
 * `app/api/auth/callback`, and the WorkOS classified-auth helpers.
 * Includes MFA, SSO, and organization-selection branches that aren't
 * fully wired in the UI yet but still need stable copy.
 */
export const loginErrorMessages: Dictionary = {
  invalid_credentials: {
    message: "Email or password is incorrect.",
    field: "email",
  },
  missing_credentials: {
    message: "Enter your email and password.",
    field: "email",
  },
  rate_limit_exceeded: {
    message: "Too many attempts. Wait a moment and try again.",
    recoverable: true,
  },
  sealing_failed: {
    message: "We couldn't establish your session. Try signing in again.",
    recoverable: true,
  },
  authentication_failed: {
    message: "We couldn't sign you in. Try again.",
    recoverable: true,
  },

  // Multi-factor / SSO / org selection branches.
  mfa_enrollment: {
    message: "Two-factor authentication isn't supported yet in this app.",
  },
  mfa_challenge: {
    message: "Two-factor authentication isn't supported yet in this app.",
  },
  sso_required: {
    message: "Your organization uses single sign-on. Continue with SSO below.",
  },
  organization_authentication_methods_required: {
    message:
      "Your organization requires a specific sign-in method. Use one of the options below.",
  },
  organization_selection_required: {
    message:
      "We couldn't determine which workspace to sign you into. Try again, or contact support.",
  },

  // OAuth round-trip codes from `app/api/auth/callback`.
  oauth_state_invalid: {
    message: "Your sign-in link expired. Start over.",
    recoverable: true,
  },
  missing_code: {
    message: "Sign-in didn't complete. Try again.",
    recoverable: true,
  },
  missing_state: {
    message: "Sign-in didn't complete. Try again.",
    recoverable: true,
  },
};
