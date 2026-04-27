"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Input } from "../primitives/input";
import { Spinner } from "../primitives/spinner";
import { SourceGlyph } from "../icons/source-glyph";
import { CheckIcon } from "../icons/glyphs";
import { type Source, type SourceId } from "../onboarding/data";
import {
  BackfillConfig,
  type BackfillRunConfig,
} from "../onboarding/step-connect";
import { ConnectorModalShell } from "./connector-modal-shell";
import { FieldRow, ReadonlyInput } from "./_internal";

/*
 * ConnectShared — generic OAuth / API-key / webhook archetype that
 * dispatches off `source.auth`. Carries the same state machine as
 * the legacy private `ConnectModal` (input → auth → backfill → done)
 * but renders through `ConnectorModalShell` so the head, footer, and
 * stepper trail are consistent with the per-vendor archetypes.
 *
 * Used as the fallback when `step-connect.tsx` doesn't have a
 * vendor-specific archetype (anything that is not Stripe / Slack /
 * HubSpot / Salesforce / webhooks).
 */

export interface ConnectSharedProps {
  source: Source;
  onClose: () => void;
  onDone: (id: SourceId, bf: BackfillRunConfig | null) => void;
  /**
   * Override the default redirect URI shown in the OAuth body
   * (the design's "we'll send you back to this URL" line).
   */
  redirectUri?: string;
}

type ConnectStep = "input" | "auth" | "backfill" | "done";

export function ConnectShared({
  source,
  onClose,
  onDone,
  redirectUri = "https://chronicle.io/oauth/callback",
}: ConnectSharedProps) {
  const [step, setStep] = React.useState<ConnectStep>("input");
  const [apiKey, setApiKey] = React.useState("");
  const bfCfg = source.backfill;
  const [bfEnabled, setBfEnabled] = React.useState(!!bfCfg);
  const [bfWindow, setBfWindow] = React.useState(bfCfg?.windowDays ?? 30);
  const [bfEntities, setBfEntities] = React.useState<string[]>(
    bfCfg ? bfCfg.entities.map((e) => e.id) : []
  );

  const isOauth = source.auth === "oauth";
  const isApiKey = source.auth === "apikey";
  const isWebhook = source.auth === "webhook";

  const begin = () => {
    setStep("auth");
    window.setTimeout(() => {
      setStep(bfCfg ? "backfill" : "done");
    }, 1100);
  };

  const estEvents = () => {
    if (!bfCfg) return 0;
    const selected = bfCfg.entities.filter((e) => bfEntities.includes(e.id));
    return Math.round(selected.reduce((a, b) => a + b.est, 0) * bfWindow);
  };

  const finish = () => {
    const cfg: BackfillRunConfig | null =
      bfCfg && bfEnabled && bfEntities.length > 0
        ? { windowDays: bfWindow, entities: bfEntities, estEvents: estEvents() }
        : null;
    onDone(source.id, cfg);
  };

  const subline =
    step === "backfill"
      ? "Optional · pull historical events"
      : step === "done"
        ? "Connected · ready to stream"
        : source.blurb;

  const actions = (
    <>
      <Button variant="ghost" onPress={onClose}>
        Cancel
      </Button>
      {step === "input" ? (
        <Button
          variant="ember"
          onPress={begin}
          isDisabled={isApiKey && !apiKey.trim()}
        >
          {isOauth
            ? "Authorize →"
            : isApiKey
              ? "Continue →"
              : "Save endpoint →"}
        </Button>
      ) : null}
      {step === "auth" ? (
        <Button variant="ember" isDisabled>
          <Spinner size="sm" tone="inverse" /> Connecting…
        </Button>
      ) : null}
      {step === "backfill" ? (
        <Button variant="ember" onPress={finish}>
          {bfEnabled && bfEntities.length > 0
            ? `Start backfill · ${estEvents().toLocaleString()} events`
            : "Skip backfill"}
        </Button>
      ) : null}
      {step === "done" ? (
        <Button variant="ember" onPress={finish}>
          Done →
        </Button>
      ) : null}
    </>
  );

  return (
    <ConnectorModalShell
      isOpen
      onClose={onClose}
      glyph={<SourceGlyph id={source.glyph} size={18} />}
      glyphTint={source.color}
      title={
        step === "backfill" ? "Backfill history" : `Connect ${source.name}`
      }
      sub={subline}
      footer={{ actions }}
    >
      <div className="cmodal-section">
        {step === "input" ? (
          <>
            {isOauth ? (
              <p className="cmodal-copy">
                You&rsquo;ll be redirected to {source.name} to authorize
                read-only access. After approval, {source.name} sends you back
                to:
                <br />
                <span className="mt-s-2 inline-block w-full">
                  <ReadonlyInput value={redirectUri} />
                </span>
              </p>
            ) : null}
            {isApiKey ? (
              <FieldRow
                id="api-key"
                label={`${source.name} API key`}
                hint="Read-only · paste here, never logged"
              >
                <Input
                  id="api-key"
                  variant="auth"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.currentTarget.value)}
                  placeholder="sk_live_•••••••••"
                />
              </FieldRow>
            ) : null}
            {isWebhook ? (
              <FieldRow
                label="Endpoint"
                help="Send any JSON to this URL — Chronicle normalizes and streams it."
              >
                <ReadonlyInput value="https://ingest.chronicle.io/v1/hook/ws_demo" />
              </FieldRow>
            ) : null}
          </>
        ) : null}

        {step === "auth" ? (
          <div className="cmodal-center">
            <Spinner size="lg" tone="ember" />
            <span className="cmodal-eyebrow">Establishing connection…</span>
          </div>
        ) : null}

        {step === "backfill" && bfCfg ? (
          <BackfillConfig
            spec={bfCfg}
            enabled={bfEnabled}
            onToggleEnabled={setBfEnabled}
            windowDays={bfWindow}
            onWindowChange={setBfWindow}
            entities={bfEntities}
            onEntitiesChange={setBfEntities}
            estEvents={estEvents()}
          />
        ) : null}

        {step === "done" ? (
          <div className="cmodal-center">
            <span className="text-event-green">
              <CheckIcon size={28} />
            </span>
            <span className="cmodal-eyebrow">Connected · ready to stream</span>
          </div>
        ) : null}
      </div>
    </ConnectorModalShell>
  );
}
