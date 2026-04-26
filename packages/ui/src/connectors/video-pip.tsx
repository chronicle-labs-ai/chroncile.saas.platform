"use client";

import * as React from "react";
import { ConnectorModalShell } from "./connector-modal-shell";
import { Button } from "../primitives/button";
import { SourceGlyph } from "../icons/source-glyph";
import { VideoPlayer, type VideoChapter } from "./video-player";
import { CodeBlock, FieldRow, ReadonlyInput } from "./_internal";
import { type Source } from "../onboarding/data";

/*
 * VideoPip — connector modal that surfaces the walkthrough as a
 * floating picture-in-picture tile docked to the bottom-right. The
 * tile is render-only this pass — no drag implementation; the grip
 * handle is non-functional. Apps that want drag should compose
 * `VideoPlayer` directly with their own pointer logic.
 */

export interface VideoPipProps {
  source: Source;
  isOpen: boolean;
  onClose: () => void;
  caption?: React.ReactNode;
  duration?: number;
  chapters?: readonly VideoChapter[];
}

const DEFAULT_CHAPTERS: VideoChapter[] = [
  { id: "a", at: 0, label: "Step 1" },
  { id: "b", at: 30, label: "Step 2" },
  { id: "c", at: 70, label: "Step 3" },
];

export function VideoPip({
  source,
  isOpen,
  onClose,
  caption = "Walkthrough",
  duration = 100,
  chapters = DEFAULT_CHAPTERS,
}: VideoPipProps) {
  const [pipOpen, setPipOpen] = React.useState(true);
  return (
    <ConnectorModalShell
      isOpen={isOpen}
      onClose={onClose}
      glyph={<SourceGlyph id={source.glyph} size={18} />}
      glyphTint={source.color}
      title={`Connect ${source.name}`}
      sub="Walkthrough docked bottom-right"
      footer={{
        status: pipOpen ? null : (
          <button
            type="button"
            className="pip-launch"
            onClick={() => setPipOpen(true)}
          >
            <span className="pip-launch-ico" aria-hidden>
              ▶
            </span>
            Open walkthrough
          </button>
        ),
        actions: (
          <>
            <Button density="brand" variant="ghost" onPress={onClose}>
              Cancel
            </Button>
            <Button density="brand" variant="ember">
              Authorize →
            </Button>
          </>
        ),
      }}
    >
      <div className="cmodal-section">
        <FieldRow label="Endpoint">
          <ReadonlyInput value={`https://api.${source.id}.com/oauth`} />
        </FieldRow>
        <FieldRow label="Sample">
          <CodeBlock
            code={`# Run this from your terminal\ncurl -X POST https://api.${source.id}.com/oauth/token`}
          />
        </FieldRow>
      </div>

      {pipOpen ? (
        <div className="pip" role="dialog" aria-label="Walkthrough video">
          <div className="pip-grip" aria-hidden>
            ⋮⋮
          </div>
          <button
            type="button"
            className="pip-close"
            aria-label="Close walkthrough"
            onClick={() => setPipOpen(false)}
          >
            ×
          </button>
          <VideoPlayer
            caption={caption}
            duration={duration}
            current={20}
            chapters={chapters}
            aspect="16/9"
          />
        </div>
      ) : null}
    </ConnectorModalShell>
  );
}
