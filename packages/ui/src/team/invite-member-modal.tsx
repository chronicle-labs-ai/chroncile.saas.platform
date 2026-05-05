"use client";

import * as React from "react";

import { Button } from "../primitives/button";
import { FormField } from "../primitives/form-field";
import { Input } from "../primitives/input";
import { Modal } from "../primitives/modal";
import { NativeSelect } from "../primitives/native-select";
import type { TeamRoleOption, TeamRoleSlug } from "./types";

/*
 * InviteMemberModal — collects an email + role and emits it via
 * `onSubmit`. The parent owns network + redirect state and surfaces
 * errors back through `error` (banner-shaped) and `fieldErrors.email`
 * (inline below the input).
 *
 * Cheap email check is intentionally local — server is the source
 * of truth, this just spares a round-trip on obvious typos. Auto-focus
 * is gated on `(pointer: fine)` so touch users don't get the keyboard
 * popped before they've parsed the dialog (Emil's rule).
 */

const DEFAULT_ROLE_OPTIONS: readonly TeamRoleOption[] = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface InviteMemberModalValue {
  email: string;
  role: TeamRoleSlug;
}

export interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: InviteMemberModalValue) => void | Promise<void>;
  isBusy?: boolean;
  /** Banner-shaped error (non-field). */
  error?: string | null;
  /** Inline field errors. */
  fieldErrors?: { email?: string | null };
  /** Override the role dropdown options. */
  roleOptions?: readonly TeamRoleOption[];
  /** Default role pre-selected when the modal opens. Defaults to `member`. */
  defaultRole?: TeamRoleSlug;
}

function isRoleSlug(value: string): value is TeamRoleSlug {
  return value === "admin" || value === "member" || value === "viewer";
}

export function InviteMemberModal({
  isOpen,
  onClose,
  onSubmit,
  isBusy = false,
  error = null,
  fieldErrors,
  roleOptions = DEFAULT_ROLE_OPTIONS,
  defaultRole = "member",
}: InviteMemberModalProps) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<TeamRoleSlug>(defaultRole);
  const [localEmailError, setLocalEmailError] = React.useState<string | null>(
    null,
  );

  // Reset local state whenever the modal opens so reopening starts
  // from a clean slate (matches the original team-settings behavior).
  React.useEffect(() => {
    if (isOpen) {
      setEmail("");
      setRole(defaultRole);
      setLocalEmailError(null);
    }
  }, [isOpen, defaultRole]);

  const closeIfIdle = () => {
    if (!isBusy) onClose();
  };

  const submit = () => {
    setLocalEmailError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setLocalEmailError("Enter the teammate's email");
      return;
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      setLocalEmailError("That email doesn't look right");
      return;
    }
    void onSubmit({ email: trimmed, role });
  };

  const visibleEmailError =
    fieldErrors?.email ?? localEmailError ?? error ?? undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeIfIdle}
      title="Invite a teammate"
      actions={
        <>
          <Button
            variant="secondary"
            isDisabled={isBusy}
            onPress={closeIfIdle}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="invite-form"
            isLoading={isBusy}
            isDisabled={!email.trim()}
          >
            {isBusy ? "Sending…" : "Send invitation"}
          </Button>
        </>
      }
    >
      {/*
       * `<form>` lets the browser submit on Enter from any input and
       * gives Cmd+Enter the same behaviour for free. The footer's
       * Send button is hoisted out of the form via `form="invite-form"`
       * so the visual layout (sticky footer row, separated by a
       * hairline) stays intact.
       */}
      <form
        id="invite-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-s-3"
        noValidate
      >
        <p className="text-body-sm text-ink-lo">
          They&rsquo;ll get an email with a 7-day acceptance link.
        </p>
        <FormField
          label="Email"
          htmlFor="invite-email"
          error={visibleEmailError ?? undefined}
        >
          <Input
            id="invite-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            autoCapitalize="off"
            value={email}
            onChange={(e) => {
              setEmail(e.currentTarget.value);
              if (localEmailError) setLocalEmailError(null);
            }}
            placeholder="teammate@company.com"
            invalid={Boolean(visibleEmailError)}
            data-1p-ignore
            data-lpignore="true"
            autoFocus={
              typeof window !== "undefined" &&
              window.matchMedia?.("(pointer: fine)").matches
            }
          />
        </FormField>
        <FormField label="Role" htmlFor="invite-role">
          <NativeSelect
            id="invite-role"
            value={role}
            onChange={(e) => {
              const next = e.currentTarget.value;
              if (isRoleSlug(next)) setRole(next);
            }}
          >
            {roleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </form>
    </Modal>
  );
}
