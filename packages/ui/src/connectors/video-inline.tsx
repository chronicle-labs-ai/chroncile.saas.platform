"use client";

import * as React from "react";
import { ConnectorModalShell } from "./connector-modal-shell";
import { Button } from "../primitives/button";
import { SourceGlyph } from "../icons/source-glyph";
import { VideoPlayer, type VideoChapter } from "./video-player";
import { WatchPill } from "./watch-pill";
import { CodeBlock, FieldRow, ReadonlyInput } from "./_internal";
import { type Source } from "../onboarding/data";

/*
 * VideoInline — connector modal where the walkthrough sits inside
 * the body, expanded under a `WatchPill` trigger. Used when the
 * vendor's instructions are short and the video is supplemental
 * (e.g. Stripe).
 *
 * The composite renders the same body as `ConnectShared`'s OAuth
 * path, with the walkthrough expanding above the action footer.
 * Apps building real flows would compose `VideoPlayer` + their own
 * archetype body — this is a complete A/B example for the placement.
 */

export interface VideoInlineProps {
  source: Source;
  isOpen: boolean;
  onClose: () => void;
  caption?: React.ReactNode;
  duration?: number;
  chapters?: readonly VideoChapter[];
  /** URL printed in the body. */
  endpoint?: string;
}

const DEFAULT_CHAPTERS: VideoChapter[] = [
  { id: "intro", at: 0, label: "Where to find your key" },
  { id: "paste", at: 22, label: "Paste it in" },
  { id: "verify", at: 48, label: "First event arrives" },
];

export function VideoInline({
  source,
  isOpen,
  onClose,
  caption = "Connecting your source",
  duration = 72,
  chapters = DEFAULT_CHAPTERS,
  endpoint = "https://ingest.chronicle.io/v1/stripe/ws_demo",
}: VideoInlineProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <ConnectorModalShell
      isOpen={isOpen}
      onClose={onClose}
      glyph={<SourceGlyph id={source.glyph} size={18} />}
      glyphTint={source.color}
      title={`Connect ${source.name}`}
      sub={source.blurb}
      footer={{
        actions: (
          <>
            <Button variant="ghost" onPress={onClose}>
              Cancel
            </Button>
            <Button variant="ember">Authorize →</Button>
          </>
        ),
      }}
    >
      <div className="cmodal-section">
        <FieldRow label="Endpoint">
          <ReadonlyInput value={endpoint} />
        </FieldRow>
        <FieldRow label="Sample request">
          <CodeBlock
            code={`curl -X POST ${endpoint} \\\n  -H "Content-Type: application/json" \\\n  -d '{"hello":"world"}'`}
          />
        </FieldRow>
        <WatchPill
          expanded={open}
          onChange={setOpen}
          duration={`${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")}`}
        />
        {open ? (
          <div className="watch-expanded">
            <VideoPlayer
              caption={caption}
              duration={duration}
              current={0}
              chapters={chapters}
            />
          </div>
        ) : null}
      </div>
    </ConnectorModalShell>
  );
}
