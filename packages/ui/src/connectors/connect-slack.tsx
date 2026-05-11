"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import { SourceGlyph } from "../icons/source-glyph";
import { StatusDot } from "../primitives/status-dot";
import { type Source, type SourceId } from "../onboarding/data";
import { type BackfillRunConfig } from "../onboarding/step-connect";
import { ConnectorModalShell } from "./connector-modal-shell";
import { FieldRow, ModePill, ScopeList } from "./_internal";
import {
  SLACK_CHANNEL_SAMPLES,
  SLACK_SCOPES,
  type SlackChannelStub,
  type SlackDirection,
  type SlackScope,
} from "./data";
import { cx } from "../utils/cx";

/*
 * ConnectSlack — vendor-specific archetype for Slack.
 *
 * Body sections:
 *   1. Workspace combo (read-only stub of "your-team.slack.com")
 *   2. Direction pill — Listen / Post / Both
 *   3. Channel picker — checkable rows of public/private channels
 *   4. Scope list — Slack OAuth scopes with reasons + "REQUIRED" tags
 *
 * The 2-step head dot trail surfaces "Authorize → Configure".
 */

export interface ConnectSlackProps {
  source: Source;
  onClose: () => void;
  onDone: (id: SourceId, bf: BackfillRunConfig | null) => void;
  /** Override the default scope list. */
  scopes?: readonly SlackScope[];
  /** Override the default channel sample set. */
  channels?: readonly SlackChannelStub[];
  /** Pre-fill the workspace combo. */
  workspace?: string;
}

const DIRECTION_OPTIONS = [
  { id: "listen" as const, label: "Listen" },
  { id: "post" as const, label: "Post" },
  { id: "both" as const, label: "Both" },
];

const SLACK_STEPS = [
  { id: "authorize", label: "Authorize" },
  { id: "configure", label: "Configure" },
];

export function ConnectSlack({
  source,
  onClose,
  onDone,
  scopes = SLACK_SCOPES,
  channels = SLACK_CHANNEL_SAMPLES,
  workspace = "your-team.slack.com",
}: ConnectSlackProps) {
  const [direction, setDirection] = React.useState<SlackDirection>("both");
  const [selectedChannels, setSelectedChannels] = React.useState<Set<string>>(
    () =>
      new Set([channels[0]?.id, channels[2]?.id].filter(Boolean) as string[])
  );
  const [selectedScopes, setSelectedScopes] = React.useState<Set<string>>(
    () =>
      new Set(
        scopes
          .filter((s) => s.required || s.id === "chat:write")
          .map((s) => s.id)
      )
  );

  const toggleChannel = (id: string) => {
    setSelectedChannels((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleScope = (id: string, next: boolean) => {
    setSelectedScopes((prev) => {
      const n = new Set(prev);
      if (next) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  const canSubmit = selectedChannels.size > 0 && selectedScopes.size > 0;

  const submit = () => {
    onDone(source.id, null);
  };

  return (
    <ConnectorModalShell
      isOpen
      onClose={onClose}
      glyph={<SourceGlyph id={source.glyph} size={18} />}
      glyphTint={source.color}
      title="Connect Slack"
      sub="Pick workspace, direction, channels, and scopes"
      size="lg"
      stepperDots={{ steps: SLACK_STEPS, currentIndex: 1 }}
      footer={{
        status: (
          <span className="cmodal-foot-meta">
            <StatusDot variant="pink" pulse />
            <span className="cmodal-foot-meta-label">
              {selectedChannels.size} channel
              {selectedChannels.size === 1 ? "" : "s"}
            </span>
            <span className="cmodal-foot-sep">·</span>
            <span className="cmodal-foot-meta-label">
              {selectedScopes.size} scope
              {selectedScopes.size === 1 ? "" : "s"}
            </span>
          </span>
        ),
        actions: (
          <>
            <Button variant="ghost" onPress={onClose}>
              Cancel
            </Button>
            <Button variant="ember" isDisabled={!canSubmit} onPress={submit}>
              Authorize →
            </Button>
          </>
        ),
      }}
    >
      <div className="cmodal-section">
        <FieldRow
          label="Workspace"
          help="Use the dropdown to switch teams during the authorize step."
        >
          <div className="ws-combo">
            <span className="ws-combo-mark" aria-hidden>
              #
            </span>
            <span className="ws-combo-value">{workspace}</span>
            <span className="ws-combo-chev" aria-hidden>
              ▾
            </span>
          </div>
        </FieldRow>

        <FieldRow label="Direction" hint="What we do with messages">
          <ModePill
            options={DIRECTION_OPTIONS}
            value={direction}
            onChange={(next) => setDirection(next as SlackDirection)}
          />
        </FieldRow>

        <FieldRow
          label="Channels"
          hint={`${selectedChannels.size}/${channels.length}`}
          help="Add channels you want to listen on. Private channels need an invite first."
        >
          <ul className="ch-list">
            {channels.map((c) => {
              const checked = selectedChannels.has(c.id);
              return (
                <li key={c.id} className={cx("ch-row", checked && "ch-row-on")}>
                  <Checkbox
                    checked={checked}
                    onChange={() => toggleChannel(c.id)}
                    size="sm"
                    variant="auth"
                  />
                  <span className="ch-mark" aria-hidden>
                    {c.isPrivate ? "🔒" : "#"}
                  </span>
                  <span className="ch-name">{c.name}</span>
                  {c.members != null ? (
                    <span className="ch-meta">{c.members} members</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </FieldRow>

        <FieldRow label="Scopes">
          <ScopeList
            items={scopes.map((s) => ({
              id: s.id,
              label: s.id,
              reason: s.reason,
              required: s.required,
            }))}
            selected={Array.from(selectedScopes)}
            onToggle={toggleScope}
          />
        </FieldRow>
      </div>
    </ConnectorModalShell>
  );
}
