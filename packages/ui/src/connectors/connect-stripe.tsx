"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Input } from "../primitives/input";
import { SourceGlyph } from "../icons/source-glyph";
import { StatusDot } from "../primitives/status-dot";
import { InlineAlert } from "../auth/_internal";
import {
  type Source,
  type SourceId,
} from "../onboarding/data";
import { type BackfillRunConfig } from "../onboarding/step-connect";
import { ConnectorModalShell } from "./connector-modal-shell";
import {
  EventChip,
  FieldRow,
  ModePill,
  ReadonlyInput,
} from "./_internal";
import {
  STRIPE_EVENT_TYPES,
  type StripeEnvMode,
  type StripeEventType,
} from "./data";

/*
 * ConnectStripe — vendor-specific archetype for Stripe.
 *
 * Body sections:
 *   1. Mode pill (Test ⇄ Live)
 *   2. Restricted API key field (rk_test_…)
 *   3. Signing secret field (whsec_…) + the webhook URL we expect
 *      Stripe to point at (read-only, copyable)
 *   4. Event-type chip grid — pre-checked from `STRIPE_EVENT_TYPES`,
 *      grouped under common Stripe objects
 *
 * Footer status surfaces the current env (`● test mode` / `● live`).
 */

export interface ConnectStripeProps {
  source: Source;
  onClose: () => void;
  onDone: (id: SourceId, bf: BackfillRunConfig | null) => void;
  /** Override the default event-type catalog. */
  events?: readonly StripeEventType[];
  /** Override the URL printed in the signing-secret section. */
  webhookUrl?: string;
}

const ENV_OPTIONS = [
  { id: "test" as const, label: "Test" },
  { id: "live" as const, label: "Live" },
];

export function ConnectStripe({
  source,
  onClose,
  onDone,
  events = STRIPE_EVENT_TYPES,
  webhookUrl = "https://ingest.chronicle.io/v1/stripe/ws_demo",
}: ConnectStripeProps) {
  const [env, setEnv] = React.useState<StripeEnvMode>("test");
  const [restrictedKey, setRestrictedKey] = React.useState("");
  const [signingSecret, setSigningSecret] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(events.filter((e) => e.defaultOn).map((e) => e.id)),
  );

  const toggleEvent = (id: string, next: boolean) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (next) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  const grouped = React.useMemo(() => {
    const m = new Map<string, StripeEventType[]>();
    for (const e of events) {
      const arr = m.get(e.object) ?? [];
      arr.push(e);
      m.set(e.object, arr);
    }
    return [...m.entries()];
  }, [events]);

  const liveWarning = env === "live";
  const canSubmit =
    restrictedKey.trim().length > 0 && signingSecret.trim().length > 0;

  const submit = () => {
    onDone(source.id, null);
  };

  return (
    <ConnectorModalShell
      isOpen
      onClose={onClose}
      glyph={<SourceGlyph id={source.glyph} size={18} />}
      glyphTint={source.color}
      title="Connect Stripe"
      sub="Restricted key + signing secret · choose what we listen for"
      size="lg"
      footer={{
        status: (
          <span className="cmodal-foot-meta">
            <StatusDot
              variant={env === "live" ? "green" : "amber"}
              pulse={env === "live"}
            />
            <span className="cmodal-foot-meta-label">
              {env === "live" ? "live mode" : "test mode"}
            </span>
            <span className="cmodal-foot-sep">·</span>
            <span className="cmodal-foot-meta-label">
              {selected.size} of {events.length} events
            </span>
          </span>
        ),
        actions: (
          <>
            <Button density="brand" variant="ghost" onPress={onClose}>
              Cancel
            </Button>
            <Button
              density="brand"
              variant="ember"
              isDisabled={!canSubmit}
              onPress={submit}
            >
              Connect →
            </Button>
          </>
        ),
      }}
    >
      <div className="cmodal-section">
        <FieldRow label="Environment">
          <ModePill
            options={ENV_OPTIONS}
            value={env}
            onChange={(next) => setEnv(next as StripeEnvMode)}
          />
        </FieldRow>

        {liveWarning ? (
          <InlineAlert tone="warning">
            Live mode forwards real customer events. Use a restricted key
            scoped to read-only access.
          </InlineAlert>
        ) : null}

        <FieldRow
          id="rk"
          label="Restricted API key"
          hint={env === "live" ? "rk_live_…" : "rk_test_…"}
          help="Stripe → Developers → API keys → Restricted keys. Read-only is enough."
        >
          <Input
            id="rk"
            density="brand"
            variant="auth"
            type="password"
            value={restrictedKey}
            onChange={(e) => setRestrictedKey(e.currentTarget.value)}
            placeholder={env === "live" ? "rk_live_•••" : "rk_test_•••"}
          />
        </FieldRow>

        <FieldRow
          id="wh"
          label="Signing secret"
          hint="whsec_…"
          help="Found under the webhook endpoint you create — we verify every payload."
        >
          <Input
            id="wh"
            density="brand"
            variant="auth"
            type="password"
            value={signingSecret}
            onChange={(e) => setSigningSecret(e.currentTarget.value)}
            placeholder="whsec_•••"
          />
        </FieldRow>

        <FieldRow
          label="Webhook endpoint"
          help={`Add this URL in Stripe → Developers → Webhooks. Forward all events you've checked below.`}
        >
          <ReadonlyInput value={webhookUrl} />
        </FieldRow>

        <FieldRow
          label="Events"
          hint={`${selected.size}/${events.length} selected`}
        >
          <div className="evt-chip-grid">
            {grouped.map(([object, items]) => (
              <div key={object} className="evt-chip-group">
                <div className="evt-chip-group-h">{object}</div>
                <div className="evt-chip-group-row">
                  {items.map((e) => (
                    <EventChip
                      key={e.id}
                      active={selected.has(e.id)}
                      onChange={(next) => toggleEvent(e.id, next)}
                    >
                      {e.id}
                    </EventChip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </FieldRow>
      </div>
    </ConnectorModalShell>
  );
}
