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

interface Entry {
  message: string;
  field?: ErrorField;
  recoverable?: boolean;
}

/**
 * Single source of truth for every code → message mapping. Keys must
 * stay in sync with the strings emitted by routes under
 * `app/api/**` and the backend handlers it forwards from.
 *
 * If you ship a route that returns a new `{ error: code }`, add the
 * code here in the same PR.
 */
const DICTIONARY: Record<string, Entry> = {
  // -----------------------------------------------------------------
  // Auth — login / sign-in
  // -----------------------------------------------------------------
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

  // -----------------------------------------------------------------
  // Auth — signup
  // -----------------------------------------------------------------
  email_already_exists: {
    message: "That email already has an account. Sign in instead.",
    field: "email",
  },
  email_not_available: {
    message: "That email already has an account. Sign in instead.",
    field: "email",
  },
  email_already_registered_to_different_workos_user: {
    message:
      "Looks like this email is already linked to a different account. Sign in with that account, or contact support to merge them.",
    field: "email",
  },
  weak_password: {
    message:
      "Pick a stronger password — at least 8 characters, mix letters and numbers.",
    field: "password",
  },
  user_creation_failed: {
    message: "We couldn't create your account. Try again.",
    recoverable: true,
  },
  email_verification_required: {
    message: "Check your inbox for a verification code to finish signing up.",
  },
  invalid_code: {
    message: "That code didn't match. Check your email and try again.",
    field: "code",
  },
  invalid_code_format: {
    message: "Enter the 6-digit code from your email.",
    field: "code",
  },
  token_invalid: {
    message:
      "Your verification window expired. Start signup again to get a fresh code.",
  },
  missing_pending_token: {
    message: "Verification token missing. Start signup again.",
  },
  verify_failed: {
    message: "Verification failed. Try again.",
    recoverable: true,
  },

  // -----------------------------------------------------------------
  // Auth — invitation flow
  // -----------------------------------------------------------------
  invitation_not_found: {
    message:
      "This invitation isn't valid. It may have been revoked or already used. Ask for a new one.",
  },
  invitation_expired: {
    message: "This invitation has expired. Ask the inviter to send a new one.",
  },
  invitation_not_pending: {
    message:
      "This invitation has already been used or revoked. Ask for a new one.",
  },
  not_pending: {
    message:
      "This invitation has already been used or revoked. Ask for a new one.",
  },
  invitation_email_mismatch: {
    message:
      "Invitations are tied to a specific email — sign up with the email that received the invite.",
    field: "email",
  },
  invitation_mismatch: {
    message: "Invitation link is invalid. Ask the inviter for a new one.",
  },
  invitation_provision_failed: {
    message:
      "We couldn't add you to the workspace. Try again, or ask the inviter to resend.",
    recoverable: true,
  },
  membership_sync_failed: {
    message:
      "We couldn't add you to the workspace. Try again, or ask the inviter to resend.",
    recoverable: true,
  },
  email_mismatch: {
    message:
      "The email on this invitation doesn't match the one you're signed in with. Sign out and back in with the invited address.",
  },
  accept_failed: {
    message: "We couldn't accept the invitation. Try again.",
    recoverable: true,
  },

  // -----------------------------------------------------------------
  // Auth — multi-factor / SSO / org selection
  // -----------------------------------------------------------------
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

  // -----------------------------------------------------------------
  // OAuth state
  // -----------------------------------------------------------------
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

  // -----------------------------------------------------------------
  // Workspace setup (onboarding)
  // -----------------------------------------------------------------
  workspace_name_required: {
    message: "Pick a workspace name (at least 2 characters).",
    field: "orgName",
  },
  workspace_slug_required: {
    message:
      "Pick a workspace URL — lowercase letters, numbers, and hyphens only.",
    field: "slug",
  },
  invalid_org_name: {
    message: "Pick a workspace name between 2 and 60 characters.",
    field: "orgName",
  },
  invalid_slug: {
    message: "Lowercase letters, numbers, and hyphens only.",
    field: "slug",
  },
  slug_taken: {
    message: "That URL is already in use. Try another.",
    field: "slug",
  },
  slug_already_in_use: {
    message: "That URL is already in use. Try another.",
    field: "slug",
  },
  org_slug_conflict: {
    message: "That URL is already in use. Try another.",
    field: "slug",
  },
  duplicate_slug: {
    message: "That URL is already in use. Try another.",
    field: "slug",
  },
  org_name_already_exists: {
    message: "That workspace name is already in use.",
    field: "orgName",
  },
  name_taken: {
    message: "That workspace name is already in use.",
    field: "orgName",
  },
  duplicate_org_name: {
    message: "That workspace name is already in use.",
    field: "orgName",
  },
  workspace_provisioning_failed: {
    message: "We couldn't create your workspace. Try again.",
    recoverable: true,
  },
  tenant_registration_failed: {
    message: "We couldn't register your workspace. Try again.",
    recoverable: true,
  },
  admin_role_not_configured: {
    message:
      "Your workspace couldn't be set up correctly. Contact support so we can fix it on our end.",
  },
  session_refresh_failed: {
    message:
      "We couldn't switch you into your new workspace. Try refreshing the page.",
    recoverable: true,
  },
  session_missing_after_provisioning: {
    message: "Your session ended unexpectedly. Sign in again.",
  },

  // -----------------------------------------------------------------
  // Permissions / authorization
  // -----------------------------------------------------------------
  unauthenticated: {
    message: "Please sign in to continue.",
  },
  forbidden: {
    message: "You don't have permission to do that.",
  },
  not_a_member: {
    message: "You're not a member of that workspace.",
  },

  // -----------------------------------------------------------------
  // Service / network
  // -----------------------------------------------------------------
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

  // -----------------------------------------------------------------
  // Generic / catch-all known codes
  // -----------------------------------------------------------------
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

  // Unknown code — log to console for the dev to add an entry, but
  // show the user a generic message so we never leak `email_taken_by_workos`
  // or similar internals.
  if (typeof window !== "undefined") {
    console.warn(
      `[humanizeBackendError] unmapped code: "${code}". Add it to DICTIONARY.`,
    );
  }
  return {
    message: "Something went wrong. Try again.",
    recoverable: true,
  };
}
