"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Eyebrow } from "../primitives/eyebrow";
import { ArrowRightIcon, RestartIcon } from "../icons/glyphs";
import { CompanyLogo } from "../icons";
import {
  AuthDisplay,
  AuthLede,
  StatusChip,
  StepFoot,
} from "../auth/_internal";
import { getSource, type SourceId } from "./data";

/*
 * StepDone — final onboarding step. Quiet success state listing
 * every connected source with a green LIVE chip plus the two
 * exit actions: restart the flow / open the workspace.
 */

export interface DoneState {
  /** Agent / workspace name shown in the headline. Defaults to "Your agent". */
  name?: string;
  /** Connected source ids. */
  connected: SourceId[];
}

export interface StepDoneProps {
  value: DoneState;
  onRestart?: () => void;
  onOpen?: () => void;
  /** Override the primary CTA label. */
  openLabel?: React.ReactNode;
}

/**
 * Onboarding step 06 — quiet success state listing every connected
 * source with a green LIVE chip and the two exit actions
 * (restart / open workspace).
 */
export function StepDone({
  value,
  onRestart,
  onOpen,
  openLabel = "Open workspace",
}: StepDoneProps) {
  const sources = value.connected
    .map((id) => getSource(id))
    .filter((s): s is NonNullable<ReturnType<typeof getSource>> => Boolean(s));
  const n = sources.length;

  return (
    <div className="flex flex-col">
      <Eyebrow>Step 06</Eyebrow>
      <AuthDisplay>
        <em>{value.name?.trim() || "Your agent"}</em> is live.
      </AuthDisplay>
      <AuthLede>
        Streaming from {n} source{n === 1 ? "" : "s"}. Open the workspace to
        watch it run.
      </AuthLede>

      {n > 0 ? (
        <div className="cg-fade-up cg-fade-up-2 mt-s-8 flex flex-col gap-s-2">
          {sources.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-s-3 rounded-sm border border-hairline bg-surface-01 px-s-3 py-s-3"
            >
              <span className="flex">
                <CompanyLogo
                  name={s.name}
                  size={16}
                  rounded
                  fallbackColor={s.color}
                />
              </span>
              <span className="flex-1 font-sans text-[13.5px] text-ink-hi">
                {s.name}
              </span>
              <StatusChip tone="green" dot>
                LIVE
              </StatusChip>
            </div>
          ))}
        </div>
      ) : null}

      <StepFoot
        back={
          <Button
            variant="ghost"
            onPress={onRestart}
            leadingIcon={<RestartIcon />}
          >
            Start over
          </Button>
        }
        next={
          <Button
            variant="ember"
            onPress={onOpen}
            trailingIcon={<ArrowRightIcon />}
          >
            {openLabel}
          </Button>
        }
      />
    </div>
  );
}
