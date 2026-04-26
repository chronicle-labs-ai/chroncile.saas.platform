"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { SourceGlyph } from "../icons/source-glyph";
import { StatusDot } from "../primitives/status-dot";
import { Spinner } from "../primitives/spinner";
import { CheckIcon } from "../icons/glyphs";
import {
  type Source,
  type SourceId,
} from "../onboarding/data";
import { type BackfillRunConfig } from "../onboarding/step-connect";
import { ConnectorModalShell } from "./connector-modal-shell";
import {
  CodeBlock,
  EventRecv,
  FieldRow,
  ReadonlyInput,
} from "./_internal";
import { REVERSE_WEBHOOK_URL_TEMPLATE } from "./data";

/*
 * ConnectReverseWebhook — generic-webhook archetype.
 *
 * Body sections:
 *   1. Endpoint URL (read-only, copyable) — the URL the user posts to
 *   2. Verify token (HMAC secret) — apps can rotate
 *   3. Sample curl block — copy/paste-able test request
 *   4. Live verifier — listens for the first inbound event and flips
 *      from `awaiting` → `received` (presentational stub)
 *
 * Footer status pulses amber while waiting and turns green on first
 * event.
 */

export interface ConnectReverseWebhookProps {
  source: Source;
  onClose: () => void;
  onDone: (id: SourceId, bf: BackfillRunConfig | null) => void;
  /** Override the ingest URL template ({tenant} placeholder). */
  endpointBase?: string;
  /** Pre-filled tenant slug. */
  tenant?: string;
  /**
   * When provided, the verifier defaults to "received" — for stories
   * and screenshot tests.
   */
  forceReceived?: boolean;
}

export function ConnectReverseWebhook({
  source,
  onClose,
  onDone,
  endpointBase = REVERSE_WEBHOOK_URL_TEMPLATE,
  tenant = "ws_demo",
  forceReceived = false,
}: ConnectReverseWebhookProps) {
  const url = endpointBase.replace("{tenant}", tenant);
  const [verifyToken] = React.useState(
    () => "whsec_" + Math.random().toString(36).slice(2, 12),
  );
  const [received, setReceived] = React.useState(forceReceived);

  const curl = `curl -X POST ${url} \\\n  -H "Content-Type: application/json" \\\n  -H "X-Chronicle-Verify: ${verifyToken}" \\\n  -d '{"type":"order.placed","id":"ord_1234","amount_cents":4900}'`;

  const submit = () => {
    onDone(source.id, null);
  };

  return (
    <ConnectorModalShell
      isOpen
      onClose={onClose}
      glyph={<SourceGlyph id={source.glyph} size={18} />}
      glyphTint={source.color}
      title="Reverse webhook"
      sub="Send any JSON to this URL — Chronicle normalizes and streams it."
      size="lg"
      footer={{
        status: received ? (
          <span className="cmodal-foot-meta">
            <StatusDot variant="green" pulse />
            <span className="cmodal-foot-meta-label">first event received</span>
          </span>
        ) : (
          <span className="cmodal-foot-meta">
            <StatusDot variant="amber" pulse />
            <span className="cmodal-foot-meta-label">awaiting first event</span>
          </span>
        ),
        actions: (
          <>
            <Button density="brand" variant="ghost" onPress={onClose}>
              Cancel
            </Button>
            {!received ? (
              <Button
                density="brand"
                variant="ember"
                onPress={() => setReceived(true)}
              >
                Send test event →
              </Button>
            ) : (
              <Button density="brand" variant="ember" onPress={submit}>
                Done →
              </Button>
            )}
          </>
        ),
      }}
    >
      <div className="cmodal-section">
        <FieldRow
          label="Endpoint"
          help="POST any JSON body. Chronicle normalizes and streams it. Rotate the URL on the source page."
        >
          <ReadonlyInput value={url} />
        </FieldRow>

        <FieldRow
          label="Verify token"
          hint="HMAC SHA-256"
          help="Sign requests with this token in the X-Chronicle-Verify header."
        >
          <ReadonlyInput value={verifyToken} secret />
        </FieldRow>

        <FieldRow label="Sample request">
          <CodeBlock code={curl} caption="Drop this into a terminal" />
        </FieldRow>

        <FieldRow label="Verifier">
          <div className="evt-recv-list" data-state={received ? "received" : "awaiting"}>
            {received ? (
              <>
                <EventRecv
                  ts="just now"
                  preview={
                    <code>{'{"type":"order.placed","id":"ord_1234"...}'}</code>
                  }
                  status={200}
                />
                <span className="evt-recv-ok">
                  <CheckIcon size={14} /> verified · payload accepted
                </span>
              </>
            ) : (
              <span className="evt-recv-wait">
                <Spinner size="sm" tone="ember" />
                Listening at {url}
              </span>
            )}
          </div>
        </FieldRow>
      </div>
    </ConnectorModalShell>
  );
}
