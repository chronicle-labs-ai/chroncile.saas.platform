"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { SourceGlyph } from "../icons/source-glyph";
import { StatusDot } from "../primitives/status-dot";
import { Spinner } from "../primitives/spinner";
import { CheckIcon } from "../icons/glyphs";
import { type Source } from "../onboarding/data";
import { ConnectorModalShell } from "./connector-modal-shell";

/*
 * StateTesting — connector edge state for "we're verifying the
 * connection right now". Surfaces the in-flight checks (auth →
 * scopes → first event) with per-row spinners that flip to a green
 * check as each completes.
 *
 * Apps drive `checks` from their probe results; the modal renders
 * whatever is passed. No timer or polling lives here.
 */

export interface ConnectorCheck {
  id: string;
  label: React.ReactNode;
  /** "pending" / "ok" / "fail" — drives the row icon. */
  status: "pending" | "ok" | "fail";
  /** Optional sub-line. */
  detail?: React.ReactNode;
}

export interface StateTestingProps {
  source: Source;
  isOpen: boolean;
  onClose: () => void;
  checks: readonly ConnectorCheck[];
}

export function StateTesting({
  source,
  isOpen,
  onClose,
  checks,
}: StateTestingProps) {
  const allOk = checks.every((c) => c.status === "ok");
  const anyFail = checks.some((c) => c.status === "fail");
  const stillRunning = !allOk && !anyFail;
  return (
    <ConnectorModalShell
      isOpen={isOpen}
      onClose={onClose}
      glyph={<SourceGlyph id={source.glyph} size={18} />}
      glyphTint={source.color}
      title={`Testing ${source.name}`}
      sub="Running pre-flight checks before opening the stream"
      footer={{
        status: (
          <span className="cmodal-foot-meta">
            <StatusDot
              variant={allOk ? "green" : anyFail ? "red" : "amber"}
              pulse={stillRunning}
            />
            <span className="cmodal-foot-meta-label">
              {allOk
                ? "all checks passed"
                : anyFail
                  ? "check failed"
                  : "running checks"}
            </span>
          </span>
        ),
        actions: (
          <Button variant="ember" onPress={onClose}>
            {allOk ? "Done" : "Close"}
          </Button>
        ),
      }}
    >
      <div className="cmodal-section">
        <ul className="test-bar">
          {checks.map((c) => (
            <li key={c.id} className="test-bar-row" data-status={c.status}>
              <span className="test-bar-ico" aria-hidden>
                {c.status === "ok" ? (
                  <CheckIcon size={12} />
                ) : c.status === "fail" ? (
                  <span className="test-bar-x">×</span>
                ) : (
                  <Spinner size="sm" tone="ember" />
                )}
              </span>
              <span className="test-bar-label">{c.label}</span>
              {c.detail ? (
                <span className="test-bar-detail">{c.detail}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </ConnectorModalShell>
  );
}
