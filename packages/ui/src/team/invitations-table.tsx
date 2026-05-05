"use client";

import * as React from "react";

import { Button } from "../primitives/button";
import {
  Cell,
  Column,
  Row,
  Table,
  TableBody,
  TableHeader,
} from "../primitives/table";
import type { TeamInvitation } from "./types";

/*
 * InvitationsTable — pending / expired invitations with Resend +
 * Revoke actions. Pure presentation; the parent owns the API calls.
 */

export interface InvitationsTableProps {
  invitations: readonly TeamInvitation[];
  isLoading?: boolean;
  isBusy?: boolean;
  onResend: (invitation: TeamInvitation) => void;
  onRevoke: (invitation: TeamInvitation) => void;
}

export function InvitationsTable({
  invitations,
  isLoading = false,
  isBusy = false,
  onResend,
  onRevoke,
}: InvitationsTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-hairline-strong bg-surface-01">
      <Table aria-label="Pending invitations">
        <TableHeader>
          <Row>
            <Column>Email</Column>
            <Column>State</Column>
            <Column>Expires</Column>
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
          ) : invitations.length === 0 ? (
            <Row>
              <Cell colSpan={4}>No pending invitations.</Cell>
            </Row>
          ) : (
            invitations.map((inv) => (
              <Row key={inv.id}>
                <Cell>
                  <span className="text-ink-hi">{inv.email}</span>
                </Cell>
                <Cell>{inv.state}</Cell>
                <Cell>
                  <span className="tabular-nums text-ink-dim">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </span>
                </Cell>
                <Cell className="text-right">
                  <span className="inline-flex items-center gap-s-1">
                    {inv.state === "pending" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        isDisabled={isBusy}
                        onPress={() => onResend(inv)}
                      >
                        Resend
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      isDisabled={isBusy}
                      onPress={() => onRevoke(inv)}
                    >
                      Revoke
                    </Button>
                  </span>
                </Cell>
              </Row>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
