"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { SourceGlyph } from "../icons/source-glyph";
import { StatusDot } from "../primitives/status-dot";
import { InlineAlert } from "../auth/_internal";
import { type Source } from "../onboarding/data";
import { ConnectorModalShell } from "./connector-modal-shell";

/*
 * StateReauth — connector edge state for "your token expired".
 *
 * Distinct from StateError because the user-action is unambiguous —
 * we just need the OAuth round-trip again. No payload inspection,
 * no retry chooser; the only meaningful action is "re-authorize".
 */

export interface StateReauthProps {
  source: Source;
  isOpen: boolean;
  onClose: () => void;
  /** Fire the parent's OAuth-restart handler. */
  onReauth?: () => void;
  /** Display the token's expiry time (string is rendered verbatim). */
  expiredAt?: string;
}

export function StateReauth({
  source,
  isOpen,
  onClose,
  onReauth,
  expiredAt,
}: StateReauthProps) {
  return (
    <ConnectorModalShell
      isOpen={isOpen}
      onClose={onClose}
      glyph={<SourceGlyph id={source.glyph} size={18} />}
      glyphTint="var(--c-event-amber)"
      title={`${source.name} · re-authorize`}
      sub={expiredAt ? `Token expired ${expiredAt}` : "Token expired"}
      footer={{
        status: (
          <span className="cmodal-foot-meta">
            <StatusDot variant="amber" pulse />
            <span className="cmodal-foot-meta-label">stream paused</span>
          </span>
        ),
        actions: (
          <>
            <Button variant="ghost" onPress={onClose}>
              Later
            </Button>
            <Button variant="ember" onPress={onReauth} isDisabled={!onReauth}>
              Re-authorize →
            </Button>
          </>
        ),
      }}
    >
      <div className="cmodal-section">
        <InlineAlert tone="warning">
          {source.name} requires consent again. Existing scopes carry over —
          this is a one-click round-trip.
        </InlineAlert>
        <p className="cmodal-copy">
          We&rsquo;ve paused ingestion for this source. New events buffer
          upstream and replay automatically as soon as the new token lands. No
          data is lost.
        </p>
      </div>
    </ConnectorModalShell>
  );
}
