"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import { SourceGlyph } from "../icons/source-glyph";
import { StatusDot } from "../primitives/status-dot";
import { ArrowLeftIcon, ArrowRightIcon } from "../icons/glyphs";
import {
  type Source,
  type SourceId,
} from "../onboarding/data";
import { type BackfillRunConfig } from "../onboarding/step-connect";
import { ConnectorModalShell } from "./connector-modal-shell";
import { FieldRow, ScopeList, StepRail } from "./_internal";
import {
  HUBSPOT_DEFAULT_MAPPING,
  HUBSPOT_OBJECTS,
  HUBSPOT_SCOPES,
  type HubSpotMappingRow,
  type HubSpotObject,
  type HubSpotScope,
} from "./data";

/*
 * ConnectHubSpot — 3-step in-modal wizard.
 *
 *   1. Scopes — read access to objects + workflows
 *   2. Objects — which collections to ingest (contacts, deals, ...)
 *   3. Mapping — HubSpot property → Chronicle field map
 *
 * The left rail (`StepRail`) lets the user jump back to completed
 * steps. The footer shows total estimated events/day on the right
 * and a step count on the left.
 */

export interface ConnectHubSpotProps {
  source: Source;
  onClose: () => void;
  onDone: (id: SourceId, bf: BackfillRunConfig | null) => void;
  scopes?: readonly HubSpotScope[];
  objects?: readonly HubSpotObject[];
  mapping?: readonly HubSpotMappingRow[];
}

type StepId = "scopes" | "objects" | "mapping";

const STEPS = [
  { id: "scopes" as const, label: "Scopes", hint: "What we read" },
  { id: "objects" as const, label: "Objects", hint: "Which collections" },
  { id: "mapping" as const, label: "Mapping", hint: "Field aliases" },
];

export function ConnectHubSpot({
  source,
  onClose,
  onDone,
  scopes = HUBSPOT_SCOPES,
  objects = HUBSPOT_OBJECTS,
  mapping: defaultMapping = HUBSPOT_DEFAULT_MAPPING,
}: ConnectHubSpotProps) {
  const [step, setStep] = React.useState<StepId>("scopes");
  const [selectedScopes, setSelectedScopes] = React.useState<Set<string>>(
    () => new Set(scopes.filter((s) => s.defaultOn).map((s) => s.id)),
  );
  const [selectedObjects, setSelectedObjects] = React.useState<Set<string>>(
    () => new Set(objects.map((o) => o.id)),
  );
  const [mapping, setMapping] = React.useState<HubSpotMappingRow[]>(
    () => defaultMapping.map((m) => ({ ...m })),
  );

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const totalEstPerDay = objects
    .filter((o) => selectedObjects.has(o.id))
    .reduce((a, b) => a + b.est, 0);

  const goNext = () => {
    if (step === "scopes") setStep("objects");
    else if (step === "objects") setStep("mapping");
    else submit();
  };

  const goBack = () => {
    if (step === "mapping") setStep("objects");
    else if (step === "objects") setStep("scopes");
    else onClose();
  };

  const toggleScope = (id: string, next: boolean) => {
    setSelectedScopes((prev) => {
      const n = new Set(prev);
      if (next) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  const toggleObject = (id: string) => {
    setSelectedObjects((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const setMappingMode = (idx: number, mode: HubSpotMappingRow["mode"]) => {
    setMapping((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, mode } : row)),
    );
  };

  const submit = () => {
    onDone(source.id, null);
  };

  return (
    <ConnectorModalShell
      isOpen
      onClose={onClose}
      glyph={<SourceGlyph id={source.glyph} size={18} />}
      glyphTint={source.color}
      title="Connect HubSpot"
      sub={
        step === "scopes"
          ? "Step 1 of 3 · Pick the OAuth scopes Chronicle requests"
          : step === "objects"
            ? "Step 2 of 3 · Pick the collections we ingest"
            : "Step 3 of 3 · Confirm field aliases"
      }
      stepperDots={{
        steps: STEPS.map((s) => ({ id: s.id, label: s.label })),
        currentIndex: stepIndex,
      }}
      size="xl"
      footer={{
        status: (
          <span className="cmodal-foot-meta">
            <StatusDot variant="orange" />
            <span className="cmodal-foot-meta-label">
              ~{totalEstPerDay.toLocaleString()} events/day
            </span>
          </span>
        ),
        actions: (
          <>
            <Button
              density="brand"
              variant="ghost"
              onPress={goBack}
              leadingIcon={<ArrowLeftIcon />}
            >
              {step === "scopes" ? "Cancel" : "Back"}
            </Button>
            <Button
              density="brand"
              variant="ember"
              onPress={goNext}
              trailingIcon={<ArrowRightIcon />}
              isDisabled={
                (step === "scopes" && selectedScopes.size === 0) ||
                (step === "objects" && selectedObjects.size === 0)
              }
            >
              {step === "mapping" ? "Connect" : "Next"}
            </Button>
          </>
        ),
      }}
    >
      <div className="wizard-body">
        <StepRail
          items={STEPS}
          currentIndex={stepIndex}
          onJump={(_, id) => setStep(id as StepId)}
        />

        <div className="wizard-body-main">
          {step === "scopes" ? (
            <FieldRow label="OAuth scopes">
              <ScopeList
                items={scopes.map((s) => ({
                  id: s.id,
                  label: s.label,
                  reason: s.reason,
                }))}
                selected={Array.from(selectedScopes)}
                onToggle={toggleScope}
              />
            </FieldRow>
          ) : null}

          {step === "objects" ? (
            <FieldRow
              label="Objects to ingest"
              hint={`${selectedObjects.size}/${objects.length} selected`}
            >
              <ul className="obj-list">
                {objects.map((o) => {
                  const on = selectedObjects.has(o.id);
                  return (
                    <li
                      key={o.id}
                      className="obj-row"
                      data-active={on || undefined}
                    >
                      <Checkbox
                        checked={on}
                        onChange={() => toggleObject(o.id)}
                        size="sm"
                        variant="auth"
                      />
                      <span className="obj-name">{o.label}</span>
                      <span className="obj-est">~{o.est}/day</span>
                    </li>
                  );
                })}
              </ul>
            </FieldRow>
          ) : null}

          {step === "mapping" ? (
            <FieldRow
              label="Property mapping"
              help="Auto-mapped fields use the canonical Chronicle name. Switch to Manual to edit, Skip to omit."
            >
              <table className="map-table">
                <thead>
                  <tr>
                    <th>HubSpot</th>
                    <th aria-hidden></th>
                    <th>Chronicle</th>
                    <th>Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {mapping.map((row, i) => (
                    <tr key={i} data-mode={row.mode}>
                      <td className="map-table-src">{row.source}</td>
                      <td className="map-table-arrow" aria-hidden>
                        →
                      </td>
                      <td className="map-table-dst">{row.target}</td>
                      <td className="map-table-mode">
                        <select
                          value={row.mode}
                          onChange={(e) =>
                            setMappingMode(
                              i,
                              e.currentTarget.value as HubSpotMappingRow["mode"],
                            )
                          }
                          aria-label={`Mapping mode for ${row.source}`}
                        >
                          <option value="auto">Auto</option>
                          <option value="manual">Manual</option>
                          <option value="skip">Skip</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FieldRow>
          ) : null}
        </div>
      </div>
    </ConnectorModalShell>
  );
}
