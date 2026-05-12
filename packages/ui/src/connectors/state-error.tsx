"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { SourceGlyph } from "../icons/source-glyph";
import { StatusDot } from "../primitives/status-dot";
import { InlineAlert } from "../auth/_internal";
import { type Source } from "../onboarding/data";
import { ConnectorModalShell } from "./connector-modal-shell";
import { CodeBlock, FieldRow } from "./_internal";

/*
 * StateError — connector edge state for "the connection broke".
 *
 * Surfaces a tone-warning alert at the top with a brief headline,
 * a code block for the failing payload (signature mismatch, 401,
 * etc.), and a primary "Retry" button alongside "Dismiss". Apps
 * dispatch from the source's status badge; the modal does not
 * own the retry mutation.
 */

export type ConnectorErrorKind =
  | "auth"
  | "signature"
  | "rate-limit"
  | "unknown";

export interface StateErrorProps {
  source: Source;
  isOpen: boolean;
  onClose: () => void;
  /** Trigger the parent's retry handler. */
  onRetry?: () => void;
  /** Kind drives the headline + code-block label. */
  kind?: ConnectorErrorKind;
  /** ISO timestamp when the error was last seen. */
  lastSeen?: string;
  /** Raw error payload — verbatim API response for the user to inspect. */
  payload?: string;
}

const KIND_HEADLINES: Record<ConnectorErrorKind, string> = {
  auth: "Auth failed — credentials rejected",
  signature: "Signature mismatch on incoming events",
  "rate-limit": "Rate limited by upstream",
  unknown: "Something went wrong",
};

const KIND_HINTS: Record<ConnectorErrorKind, string> = {
  auth: "The API key Chronicle holds was rotated or revoked. Re-authorize to restore the stream.",
  signature:
    "Recent events failed HMAC verification. Confirm the signing secret on both sides.",
  "rate-limit":
    "Upstream returned 429s on recent calls. We back off and retry; ingestion resumes when the limit lifts.",
  unknown:
    "Chronicle hit an unexpected error. The latest payload is below — share it with support if it persists.",
};

export function StateError({
  source,
  isOpen,
  onClose,
  onRetry,
  kind = "unknown",
  lastSeen,
  payload,
}: StateErrorProps) {
  return (
    <ConnectorModalShell
      isOpen={isOpen}
      onClose={onClose}
      glyph={<SourceGlyph id={source.glyph} size={18} />}
      glyphTint="var(--c-event-red)"
      title={`${source.name} · error`}
      sub={lastSeen ? `Last seen ${lastSeen}` : undefined}
      footer={{
        status: (
          <span className="cmodal-foot-meta">
            <StatusDot variant="red" pulse />
            <span className="cmodal-foot-meta-label">connection failing</span>
          </span>
        ),
        actions: (
          <>
            <Button variant="ghost" onPress={onClose}>
              Dismiss
            </Button>
            <Button variant="ember" onPress={onRetry} isDisabled={!onRetry}>
              Retry now →
            </Button>
          </>
        ),
      }}
    >
      <div className="cmodal-section">
        <InlineAlert tone="danger">{KIND_HEADLINES[kind]}</InlineAlert>
        <p className="cmodal-copy">{KIND_HINTS[kind]}</p>
        {payload ? (
          <FieldRow label="Last payload">
            <CodeBlock code={payload} caption="From the most recent failure" />
          </FieldRow>
        ) : null}
      </div>
    </ConnectorModalShell>
  );
}
