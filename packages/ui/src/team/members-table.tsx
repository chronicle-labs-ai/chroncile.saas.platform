"use client";

import * as React from "react";

import { Badge } from "../primitives/badge";
import { Button } from "../primitives/button";
import { NativeSelect } from "../primitives/native-select";
import {
  Cell,
  Column,
  Row,
  Table,
  TableBody,
  TableHeader,
} from "../primitives/table";
import type { TeamMember, TeamRoleOption, TeamRoleSlug } from "./types";

/*
 * MembersTable — workspace member list with inline role selector and
 * Remove / Leave action.
 *
 * Pure presentation: the parent owns the fetch + mutation. Owner
 * memberships are non-editable here (role select + remove disabled);
 * "you" rows render a Leave button instead of Remove.
 */

const DEFAULT_ROLE_OPTIONS: readonly TeamRoleOption[] = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

export interface MembersTableProps {
  members: readonly TeamMember[];
  /** True while the parent is fetching the initial members list. */
  isLoading?: boolean;
  /** True while a mutation is in flight (disables row actions). */
  isBusy?: boolean;
  onRoleChange: (member: TeamMember, nextRole: TeamRoleSlug) => void;
  /** Triggered for non-self members. */
  onRemove: (member: TeamMember) => void;
  /** Triggered for the row representing the signed-in user. */
  onLeave: (member: TeamMember) => void;
  /** Override the role dropdown options. */
  roleOptions?: readonly TeamRoleOption[];
}

function fullName(m: TeamMember): string {
  const name = [m.firstName, m.lastName].filter(Boolean).join(" ");
  return name || m.email || m.userId;
}

function isRoleSlug(value: string): value is TeamRoleSlug {
  return value === "admin" || value === "member" || value === "viewer";
}

export function MembersTable({
  members,
  isLoading = false,
  isBusy = false,
  onRoleChange,
  onRemove,
  onLeave,
  roleOptions = DEFAULT_ROLE_OPTIONS,
}: MembersTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-hairline-strong bg-surface-01">
      <Table aria-label="Workspace members">
        <TableHeader>
          <Row>
            <Column>Member</Column>
            <Column>Role</Column>
            <Column>Status</Column>
            <Column>
              <span className="sr-only">Actions</span>
            </Column>
          </Row>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <Row>
              <Cell colSpan={4}>Loading…</Cell>
            </Row>
          ) : members.length === 0 ? (
            <Row>
              <Cell colSpan={4}>No members in this workspace.</Cell>
            </Row>
          ) : (
            members.map((m) => {
              const display = fullName(m);
              const currentRole = (m.role?.slug ?? "member") as string;
              return (
                <Row key={m.id}>
                  <Cell>
                    <div className="text-ink-hi">{display}</div>
                    {m.email && display !== m.email ? (
                      <div className="font-mono text-mono text-ink-dim">
                        {m.email}
                      </div>
                    ) : null}
                    {(m.isOwner || m.isSelf) ? (
                      <div className="mt-s-1 flex flex-wrap gap-s-1">
                        {m.isOwner ? (
                          <Badge variant="ember">owner</Badge>
                        ) : null}
                        {m.isSelf ? <Badge variant="neutral">you</Badge> : null}
                      </div>
                    ) : null}
                  </Cell>
                  <Cell>
                    <NativeSelect
                      aria-label={`Role for ${display}`}
                      disabled={isBusy || m.isOwner}
                      value={currentRole}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next === currentRole) return;
                        if (isRoleSlug(next)) onRoleChange(m, next);
                      }}
                    >
                      {roleOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Cell>
                  <Cell>
                    <span
                      data-status={m.status}
                      className="data-[status=active]:text-ink data-[status=inactive]:text-ink-dim"
                    >
                      {m.status}
                    </span>
                  </Cell>
                  <Cell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      isDisabled={isBusy || m.isOwner}
                      onPress={() => (m.isSelf ? onLeave(m) : onRemove(m))}
                    >
                      {m.isSelf ? "Leave" : "Remove"}
                    </Button>
                  </Cell>
                </Row>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
