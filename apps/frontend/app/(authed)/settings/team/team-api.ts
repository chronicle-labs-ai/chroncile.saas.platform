import type {
  TeamInvitation,
  TeamMember,
  TeamRoleSlug,
} from "ui";

import { errorMessage } from "./team-helpers";

/*
 * Thin typed wrapper around the `/api/org/*` endpoints powering the
 * Team Settings client. Each function returns `{ ok: true, ... }` on
 * success or `{ ok: false, error }` with a human-readable message —
 * the caller just renders it without re-mapping codes.
 */

export interface MembersResponse {
  members: TeamMember[];
  ownerUserId: string | null;
}

export interface InvitationsResponse {
  invitations: TeamInvitation[];
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as
    | { error?: string; detail?: string; required?: string }
    | null;
  const code = data?.error ?? "unknown";
  const detail = data?.detail ? ` — ${data.detail}` : "";
  const required = data?.required ? ` (need: ${data.required})` : "";
  return `[${res.status} ${code}${required}]${detail}`;
}

export async function fetchMembers(): Promise<ApiResult<MembersResponse>> {
  try {
    const res = await fetch("/api/org/members", {
      headers: { "cache-control": "no-store" },
    });
    if (!res.ok) {
      return { ok: false, error: `Failed to load members ${await readError(res)}` };
    }
    return { ok: true, data: (await res.json()) as MembersResponse };
  } catch (err) {
    return {
      ok: false,
      error: `Network error loading members${
        err instanceof Error ? ` (${err.message})` : ""
      }.`,
    };
  }
}

export async function fetchInvitations(): Promise<
  ApiResult<InvitationsResponse>
> {
  try {
    const res = await fetch("/api/org/invitations", {
      headers: { "cache-control": "no-store" },
    });
    if (!res.ok) {
      return { ok: false, error: `Failed to load invitations ${await readError(res)}` };
    }
    return { ok: true, data: (await res.json()) as InvitationsResponse };
  } catch {
    return { ok: false, error: "Network error loading invitations." };
  }
}

async function postOrPatch<T>(
  url: string,
  init: RequestInit,
): Promise<ApiResult<T | undefined>> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: errorMessage(data?.error) };
  }
  return { ok: true, data: undefined };
}

export function createInvitation(
  email: string,
  roleSlug: TeamRoleSlug,
): Promise<ApiResult<undefined>> {
  return postOrPatch("/api/org/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, roleSlug }),
  });
}

export function updateMemberRole(
  membershipId: string,
  roleSlug: TeamRoleSlug,
): Promise<ApiResult<undefined>> {
  return postOrPatch(`/api/org/members/${membershipId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roleSlug }),
  });
}

export function removeMember(
  membershipId: string,
  isSelf: boolean,
): Promise<ApiResult<undefined>> {
  return postOrPatch(`/api/org/members/${membershipId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(isSelf ? { mode: "leave" } : {}),
  });
}

export async function revokeInvitation(
  invitationId: string,
): Promise<ApiResult<undefined>> {
  const res = await fetch(`/api/org/invitations/${invitationId}`, {
    method: "DELETE",
  });
  if (!res.ok) return { ok: false, error: "Failed to revoke invitation." };
  return { ok: true, data: undefined };
}

export async function resendInvitation(
  invitationId: string,
): Promise<ApiResult<undefined>> {
  const res = await fetch(`/api/org/invitations/${invitationId}/resend`, {
    method: "POST",
  });
  if (!res.ok) return { ok: false, error: "Failed to resend invitation." };
  return { ok: true, data: undefined };
}
