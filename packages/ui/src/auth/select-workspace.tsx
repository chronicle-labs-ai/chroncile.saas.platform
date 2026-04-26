"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Eyebrow } from "../primitives/eyebrow";
import { SearchField } from "../primitives/search-field";
import { ScanLoader } from "../primitives/scan-loader";
import { ArrowRightIcon } from "../icons/glyphs";
import { cx } from "../utils/cx";
import { AuthDisplay, AuthLede } from "./_internal";
import { WorkspaceCard, type Role } from "./workspace-card";

/*
 * SelectWorkspace — the multi-org picker landing page (`/auth/select-workspace`).
 * Single component, four sub-states keyed off the membership count + the
 * `autoRouting` flag (the prototype's G.0 / G.1 / G.2 / G.5):
 *
 *   • G.0 — zero memberships: empty state with "Create new" + "I'm waiting on
 *           an invite" actions.
 *   • G.1 — one membership + autoRouting: a 200–400ms "Loading <orgName>…"
 *           beat with a ScanLoader strip below.
 *   • G.2 — two-or-more memberships: list of WorkspaceCard rows with a
 *           dashed "+ Create another workspace" affordance below.
 *   • G.5 — five-or-more memberships: same as G.2 but adds a SearchField
 *           above the list.
 */

/**
 * One workspace membership row in the picker page. The package barrel
 * re-exports `WorkspaceSwitcherEntry` from `layout/` (formerly named
 * `Workspace`) so this name no longer collides — they describe two
 * distinct shapes: this one is membership-flavored (role, member
 * count, lastSeen), while the layout one is identity-flavored
 * (avatar, plan, group).
 */
export interface Workspace {
  id: string;
  name: string;
  role: Role;
  memberCount?: number;
  /** "2h ago" / "yesterday" / etc. */
  lastSeen?: string;
  /** Optional brand mark gradient seed. */
  brandSeed?: string;
}

export interface SelectWorkspaceProps {
  workspaces: Workspace[];
  onSelect: (id: string) => void;
  onCreateNew?: () => void;
  /** "I'm waiting on an invite" — signs out + returns to /login. */
  onSignOut?: () => void;
  /**
   * When `workspaces.length === 1` and this is true, render the G.1
   * auto-route beat. Default false.
   */
  autoRouting?: boolean;
  /** Threshold above which the SearchField appears. Default 5. */
  searchThreshold?: number;
}

/**
 * Workspace picker page. Conditional layout drives every meaningful
 * sub-state (zero / one auto-routing / many / many+search).
 */
export function SelectWorkspace({
  workspaces,
  onSelect,
  onCreateNew,
  onSignOut,
  autoRouting = false,
  searchThreshold = 5,
}: SelectWorkspaceProps) {
  const count = workspaces.length;

  /* ── G.0 — zero memberships ─────────────────────────────── */
  if (count === 0) {
    return (
      <div className="flex flex-col">
        <Eyebrow>WORKSPACE · NONE</Eyebrow>
        <AuthDisplay>
          You&rsquo;re not in any <em>workspaces</em> yet.
        </AuthDisplay>
        <AuthLede>
          Create a fresh workspace to start streaming events, or wait for an
          invite from a teammate.
        </AuthLede>
        <div className="cg-fade-up cg-fade-up-2 mt-s-8 flex flex-col gap-s-2">
          <Button
            density="brand"
            variant="ember"
            onPress={onCreateNew}
            trailingIcon={<ArrowRightIcon />}
          >
            Create a new workspace
          </Button>
          <Button density="brand" variant="secondary" onPress={onSignOut}>
            I&rsquo;m waiting on an invite
          </Button>
        </div>
      </div>
    );
  }

  /* ── G.1 — one membership · auto-route ──────────────────── */
  if (count === 1 && autoRouting) {
    const ws = workspaces[0]!;
    return (
      <div className="flex flex-col">
        <Eyebrow>WORKSPACE · LOADING</Eyebrow>
        <AuthDisplay>
          Loading <em>{ws.name}…</em>
        </AuthDisplay>
        <AuthLede>
          One workspace, no decision needed. Hydrating the dashboard.
        </AuthLede>
        <div className="cg-fade-up cg-fade-up-2 mt-s-8 flex flex-col gap-s-3">
          <ScanLoader />
          <span className="font-mono text-mono-sm text-ink-dim">
            tenants.findByWorkosOrgId · users.findByWorkosUserId · auth.mintJwt
          </span>
        </div>
      </div>
    );
  }

  /* ── G.2 / G.5 — pick a workspace ───────────────────────── */
  const showSearch = count >= searchThreshold;
  return (
    <div className="flex flex-col">
      <Eyebrow>WORKSPACE · PICK ONE</Eyebrow>
      <AuthDisplay>
        Which one are you <em>working in?</em>
      </AuthDisplay>
      <AuthLede>
        We&rsquo;ll bake your choice into the session — switch later from the
        workspace dropdown in the app header.
      </AuthLede>

      <div className="cg-fade-up cg-fade-up-2 mt-s-8 flex flex-col gap-s-3">
        {showSearch ? (
          <SearchByName workspaces={workspaces} onSelect={onSelect} />
        ) : (
          <div className="flex flex-col gap-s-2">
            {workspaces.map((ws) => (
              <WorkspaceCard
                key={ws.id}
                name={ws.name}
                role={ws.role}
                memberCount={ws.memberCount}
                lastSeen={ws.lastSeen}
                brandSeed={ws.brandSeed}
                onPress={() => onSelect(ws.id)}
              />
            ))}
          </div>
        )}

        {onCreateNew ? (
          <button
            type="button"
            onClick={onCreateNew}
            className={cx(
              "mt-s-2 flex w-full items-center justify-center gap-s-2",
              "rounded-sm border border-dashed border-hairline-strong",
              "px-s-3 py-s-3 font-mono text-mono uppercase tracking-tactical",
              "text-ink-dim transition-colors duration-fast ease-out",
              "hover:border-ember hover:text-ink-hi",
            )}
          >
            + Create another workspace
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SearchByName({
  workspaces,
  onSelect,
}: {
  workspaces: Workspace[];
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = React.useState("");
  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return workspaces;
    return workspaces.filter((w) => w.name.toLowerCase().includes(needle));
  }, [workspaces, q]);
  return (
    <>
      <SearchField
        density="brand"
        placeholder="Filter by workspace name"
        value={q}
        onChange={setQ}
      />
      <div className="flex flex-col gap-s-2">
        {filtered.map((ws) => (
          <WorkspaceCard
            key={ws.id}
            name={ws.name}
            role={ws.role}
            memberCount={ws.memberCount}
            lastSeen={ws.lastSeen}
            brandSeed={ws.brandSeed}
            onPress={() => onSelect(ws.id)}
          />
        ))}
        {filtered.length === 0 ? (
          <span className="px-s-2 py-s-3 font-mono text-mono-sm text-ink-dim">
            No workspaces match &ldquo;{q}&rdquo;.
          </span>
        ) : null}
      </div>
    </>
  );
}
