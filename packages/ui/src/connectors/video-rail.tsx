"use client";

import * as React from "react";
import { ConnectorModalShell } from "./connector-modal-shell";
import { Button } from "../primitives/button";
import { SourceGlyph } from "../icons/source-glyph";
import { VideoPlayer, type VideoChapter } from "./video-player";
import { CodeBlock, FieldRow, ReadonlyInput } from "./_internal";
import { type Source } from "../onboarding/data";

/*
 * VideoRail — connector modal with a permanent video rail on the
 * right column. The body splits 60/40: instructions on the left,
 * the player + chapter list on the right. Used when the walkthrough
 * is expected (HubSpot's 3-step OAuth dance).
 */

export interface VideoRailProps {
  source: Source;
  isOpen: boolean;
  onClose: () => void;
  caption?: React.ReactNode;
  duration?: number;
  chapters?: readonly VideoChapter[];
}

const DEFAULT_CHAPTERS: VideoChapter[] = [
  { id: "ch1", at: 0, label: "Open the dashboard" },
  { id: "ch2", at: 18, label: "Create the OAuth app" },
  { id: "ch3", at: 42, label: "Paste credentials" },
  { id: "ch4", at: 66, label: "Verify the first event" },
];

export function VideoRail({
  source,
  isOpen,
  onClose,
  caption = "Walking through OAuth",
  duration = 90,
  chapters = DEFAULT_CHAPTERS,
}: VideoRailProps) {
  const [current, setCurrent] = React.useState(0);
  return (
    <ConnectorModalShell
      isOpen={isOpen}
      onClose={onClose}
      glyph={<SourceGlyph id={source.glyph} size={18} />}
      glyphTint={source.color}
      title={`Connect ${source.name}`}
      sub="Side-by-side walkthrough"
      size="xl"
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
      <div className="video-rail">
        <div className="vr-body">
          <FieldRow label="Endpoint">
            <ReadonlyInput value={`https://api.${source.id}.com/oauth`} />
          </FieldRow>
          <FieldRow label="Sample">
            <CodeBlock
              code={`curl -X POST https://api.${source.id}.com/oauth/token \\\n  -H "Authorization: Bearer …"`}
            />
          </FieldRow>
        </div>
        <aside className="vr-aside">
          <VideoPlayer
            caption={caption}
            duration={duration}
            current={current}
            chapters={chapters}
          />
          <ul className="vr-chapters">
            {chapters.map((c) => (
              <li
                key={c.id}
                className="vr-ch-row"
                data-active={current >= c.at || undefined}
              >
                <button
                  type="button"
                  onClick={() => setCurrent(c.at)}
                  className="vr-ch-btn"
                >
                  <span className="vr-ch-time">
                    {Math.floor(c.at / 60)}:
                    {(c.at % 60).toString().padStart(2, "0")}
                  </span>
                  <span className="vr-ch-label">{c.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </ConnectorModalShell>
  );
}
