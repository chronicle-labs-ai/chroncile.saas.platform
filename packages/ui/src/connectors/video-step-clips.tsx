"use client";

import * as React from "react";
import { ConnectorModalShell } from "./connector-modal-shell";
import { Button } from "../primitives/button";
import { SourceGlyph } from "../icons/source-glyph";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "../icons/glyphs";
import { VideoPlayer } from "./video-player";
import { CodeBlock, FieldRow, ReadonlyInput, StepRail } from "./_internal";
import { type Source } from "../onboarding/data";

/*
 * VideoStepClips — connector modal where each wizard step has its
 * own short clip (10–15 seconds). The clip swaps as the user moves
 * through the rail; the previous clips render as compact thumbnails
 * the user can rewind to.
 *
 * Modeled on the 4-step Salesforce wizard, but applies to any
 * step-based archetype.
 */

export interface VideoStepClip {
  id: string;
  label: string;
  /** Duration of the clip in seconds. */
  duration: number;
  /** Caption shown over the player. */
  caption: React.ReactNode;
}

export interface VideoStepClipsProps {
  source: Source;
  isOpen: boolean;
  onClose: () => void;
  clips?: readonly VideoStepClip[];
}

const DEFAULT_CLIPS: VideoStepClip[] = [
  { id: "create", label: "Create app", duration: 22, caption: "Open Setup → App Manager" },
  { id: "paste", label: "Paste creds", duration: 18, caption: "Find consumer key + secret" },
  { id: "oauth", label: "Authorize", duration: 12, caption: "OAuth round-trip" },
  { id: "done", label: "Done", duration: 8, caption: "First event arrives" },
];

export function VideoStepClips({
  source,
  isOpen,
  onClose,
  clips = DEFAULT_CLIPS,
}: VideoStepClipsProps) {
  const [stepIdx, setStepIdx] = React.useState(0);
  const active = clips[stepIdx]!;

  const goNext = () => {
    if (stepIdx < clips.length - 1) setStepIdx(stepIdx + 1);
  };
  const goBack = () => {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
    else onClose();
  };

  return (
    <ConnectorModalShell
      isOpen={isOpen}
      onClose={onClose}
      glyph={<SourceGlyph id={source.glyph} size={18} />}
      glyphTint={source.color}
      title={`Connect ${source.name}`}
      sub={`Step ${stepIdx + 1} of ${clips.length} · ${active.label}`}
      stepperDots={{
        steps: clips.map((c) => ({ id: c.id, label: c.label })),
        currentIndex: stepIdx,
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
              {stepIdx === 0 ? "Cancel" : "Back"}
            </Button>
            <Button
              density="brand"
              variant="ember"
              onPress={goNext}
              isDisabled={stepIdx === clips.length - 1}
              trailingIcon={<ArrowRightIcon />}
            >
              Next
            </Button>
          </>
        ),
      }}
    >
      <div className="wizard-body">
        <StepRail
          items={clips.map((c) => ({ id: c.id, label: c.label }))}
          currentIndex={stepIdx}
          onJump={(i) => setStepIdx(i)}
        />
        <div className="wizard-body-main">
          <VideoPlayer
            caption={active.caption}
            duration={active.duration}
            current={0}
          />
          <FieldRow label="What you'll do">
            <ReadonlyInput value={active.caption?.toString() ?? ""} noCopy mono={false} />
          </FieldRow>
          <FieldRow label="Reference">
            <CodeBlock code={`# step ${stepIdx + 1}\n# ${active.label.toLowerCase()}`} />
          </FieldRow>
          <ul className="step-clip-card-row">
            {clips.map((c, i) => (
              <li
                key={c.id}
                className="step-clip-card"
                data-active={i === stepIdx || undefined}
                data-done={i < stepIdx || undefined}
              >
                <button type="button" onClick={() => setStepIdx(i)}>
                  <span className="step-clip-card-num">
                    {i < stepIdx ? <CheckIcon size={10} /> : i + 1}
                  </span>
                  <span className="step-clip-card-label">{c.label}</span>
                  <span className="step-clip-card-time">
                    {Math.floor(c.duration / 60)}:
                    {(c.duration % 60).toString().padStart(2, "0")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ConnectorModalShell>
  );
}
