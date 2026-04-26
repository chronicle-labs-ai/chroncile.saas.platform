"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Input } from "../primitives/input";
import { SourceGlyph } from "../icons/source-glyph";
import { Spinner } from "../primitives/spinner";
import { CheckIcon, ArrowLeftIcon, ArrowRightIcon } from "../icons/glyphs";
import {
  type Source,
  type SourceId,
} from "../onboarding/data";
import { type BackfillRunConfig } from "../onboarding/step-connect";
import { ConnectorModalShell } from "./connector-modal-shell";
import {
  CodeBlock,
  FieldRow,
  NumberedList,
  ReadonlyInput,
  StepRail,
} from "./_internal";
import { SALESFORCE_REGIONS, type SalesforceRegion } from "./data";

/*
 * ConnectWizard — generic 4-step paste-flow archetype, shaped for
 * Salesforce (the canonical use case) but applicable to any source
 * that needs:
 *
 *   1. Create app — steps to create the upstream OAuth app
 *   2. Paste creds — client id + secret + region
 *   3. OAuth — redirect, consent, return
 *   4. Done — first events flowing
 *
 * The body is a 2-column grid: `StepRail` on the left, the body for
 * the active step on the right. Apps that aren't Salesforce can pass
 * `instructions` (NumberedList rows) and `regions` overrides.
 */

export interface ConnectWizardProps {
  source: Source;
  onClose: () => void;
  onDone: (id: SourceId, bf: BackfillRunConfig | null) => void;
  /** Override the region picker. Default: Salesforce regions. */
  regions?: readonly SalesforceRegion[];
  /** Step-1 instructions. Default: Salesforce connected-app steps. */
  instructions?: React.ReactNode[];
  /** Redirect URI shown on step 1 (matches the consumer's auth callback). */
  redirectUri?: string;
}

type StepId = "create" | "paste" | "oauth" | "done";

const STEPS = [
  { id: "create" as const, label: "Create app", hint: "On the vendor's side" },
  { id: "paste" as const, label: "Paste creds", hint: "Client id + secret" },
  { id: "oauth" as const, label: "Authorize", hint: "OAuth round-trip" },
  { id: "done" as const, label: "Done", hint: "Events flowing" },
];

const SF_INSTRUCTIONS = [
  "Setup → App Manager → New Connected App",
  "Enable OAuth, copy the consumer key and secret",
  "Add the callback URL exactly as shown below",
  "Save the app and wait ~10 minutes for activation",
];

export function ConnectWizard({
  source,
  onClose,
  onDone,
  regions = SALESFORCE_REGIONS,
  instructions = SF_INSTRUCTIONS,
  redirectUri = "https://chronicle.io/oauth/salesforce/callback",
}: ConnectWizardProps) {
  const [step, setStep] = React.useState<StepId>("create");
  const [region, setRegion] = React.useState<string>(regions[0]?.id ?? "prod");
  const [clientId, setClientId] = React.useState("");
  const [clientSecret, setClientSecret] = React.useState("");
  const [oauthState, setOauthState] = React.useState<"idle" | "pending" | "ok">(
    "idle",
  );

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const canPaste = clientId.trim().length > 0 && clientSecret.trim().length > 0;

  const goNext = () => {
    if (step === "create") setStep("paste");
    else if (step === "paste" && canPaste) {
      setStep("oauth");
      setOauthState("pending");
      window.setTimeout(() => {
        setOauthState("ok");
        setStep("done");
      }, 1400);
    } else if (step === "done") submit();
  };

  const goBack = () => {
    if (step === "paste") setStep("create");
    else if (step === "oauth") setStep("paste");
    else if (step === "done") setStep("oauth");
    else onClose();
  };

  const submit = () => {
    onDone(source.id, null);
  };

  const nextDisabled =
    (step === "paste" && !canPaste) || step === "oauth";

  return (
    <ConnectorModalShell
      isOpen
      onClose={onClose}
      glyph={<SourceGlyph id={source.glyph} size={18} />}
      glyphTint={source.color}
      title={`Connect ${source.name}`}
      sub={STEPS[stepIndex]?.hint as string}
      stepperDots={{
        steps: STEPS.map((s) => ({ id: s.id, label: s.label })),
        currentIndex: stepIndex,
      }}
      size="lg"
      footer={{
        actions: (
          <>
            <Button
              density="brand"
              variant="ghost"
              onPress={goBack}
              leadingIcon={<ArrowLeftIcon />}
            >
              {step === "create" ? "Cancel" : "Back"}
            </Button>
            <Button
              density="brand"
              variant="ember"
              onPress={goNext}
              isDisabled={nextDisabled}
              trailingIcon={<ArrowRightIcon />}
            >
              {step === "done" ? "Finish" : step === "oauth" ? "Authorizing…" : "Next"}
            </Button>
          </>
        ),
      }}
    >
      <div className="wizard-body">
        <StepRail
          items={STEPS}
          currentIndex={stepIndex}
          onJump={(_, id) => {
            const idx = STEPS.findIndex((s) => s.id === id);
            if (idx <= stepIndex) setStep(id as StepId);
          }}
        />

        <div className="wizard-body-main">
          {step === "create" ? (
            <>
              <FieldRow label="Steps">
                <NumberedList>
                  {instructions.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </NumberedList>
              </FieldRow>
              <FieldRow
                label="Callback URL"
                help="Paste this exactly into the connected app's allowed callback URLs."
              >
                <ReadonlyInput value={redirectUri} />
              </FieldRow>
            </>
          ) : null}

          {step === "paste" ? (
            <>
              <FieldRow label="Region">
                <select
                  className="cinput-select"
                  value={region}
                  onChange={(e) => setRegion(e.currentTarget.value)}
                  aria-label="Region"
                >
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label} · {r.loginHost}
                    </option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow id="cid" label="Consumer key">
                <Input
                  id="cid"
                  density="brand"
                  variant="auth"
                  value={clientId}
                  onChange={(e) => setClientId(e.currentTarget.value)}
                  placeholder="3MVG…"
                />
              </FieldRow>
              <FieldRow id="csec" label="Consumer secret">
                <Input
                  id="csec"
                  density="brand"
                  variant="auth"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.currentTarget.value)}
                  placeholder="••••••••"
                />
              </FieldRow>
              <FieldRow
                label="Test request"
                help="Verify the credentials by hitting the token endpoint."
              >
                <CodeBlock
                  code={`curl https://${
                    regions.find((r) => r.id === region)?.loginHost ??
                    "login.salesforce.com"
                  }/services/oauth2/token`}
                  copy
                />
              </FieldRow>
            </>
          ) : null}

          {step === "oauth" ? (
            <div className="cmodal-center">
              {oauthState === "ok" ? (
                <>
                  <span className="text-event-green">
                    <CheckIcon size={28} />
                  </span>
                  <span className="cmodal-eyebrow">authorized</span>
                </>
              ) : (
                <>
                  <Spinner size="lg" tone="ember" />
                  <span className="cmodal-eyebrow">
                    Redirecting to {source.name}…
                  </span>
                </>
              )}
            </div>
          ) : null}

          {step === "done" ? (
            <div className="cmodal-center">
              <span className="text-event-green">
                <CheckIcon size={28} />
              </span>
              <span className="cmodal-eyebrow">first event flowing</span>
              <span className="cmodal-copy">
                {source.name} is authorized. We&rsquo;ll start streaming events
                immediately. Manage scopes any time on the source page.
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </ConnectorModalShell>
  );
}
