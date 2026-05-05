import type { Dictionary } from "./types";

/*
 * Signup + email-verification + invitation-accept error codes.
 * Emitted by `app/api/auth/signup`, `signup/verify`, `signup/resend`,
 * and `app/api/auth/accept-invite`.
 */
export const signupErrorMessages: Dictionary = {
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

  // Invitation flow shared between signup + login.
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
};
