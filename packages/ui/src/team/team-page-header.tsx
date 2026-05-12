import * as React from "react";

import { Button } from "../primitives/button";
import { Eyebrow } from "../primitives/eyebrow";

/*
 * TeamPageHeader — workspace title + slug pill + invite CTA.
 *
 * Owns the `Workspace / <name> / /<slug>` header at the top of the
 * Team Settings page. Keeps the design-system look canonical so
 * `apps/frontend` doesn't need to reach for `text-title`/`text-mono`
 * Tailwind utilities directly.
 */
export interface TeamPageHeaderProps {
  /** Display name for the workspace. Falls back to `—` when missing. */
  orgName?: string | null;
  /** Workspace slug (e.g. `acme-co`). Renders as a `/slug` mono pill. */
  orgSlug?: string | null;
  /** Click handler for the primary "Invite member" button. */
  onInvite: () => void;
  /** Optional override for the CTA label. */
  inviteLabel?: string;
}

function PlusGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className="h-4 w-4"
    >
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function TeamPageHeader({
  orgName,
  orgSlug,
  onInvite,
  inviteLabel = "Invite member",
}: TeamPageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-s-4">
      <div className="min-w-0">
        <Eyebrow>Workspace</Eyebrow>
        <div className="mt-s-1 flex items-baseline gap-s-3">
          <h1 className="font-sans text-title font-medium tracking-tight text-ink-hi">
            {orgName ?? "—"}
          </h1>
          {orgSlug ? (
            <span className="font-mono text-mono text-ink-dim tabular-nums">
              /{orgSlug}
            </span>
          ) : null}
        </div>
        <p className="mt-s-2 text-body-sm text-ink-lo">
          Manage who can access this workspace.
        </p>
      </div>
      <Button
        variant="primary"
        size="md"
        onPress={onInvite}
        leadingIcon={<PlusGlyph />}
      >
        {inviteLabel}
      </Button>
    </header>
  );
}
