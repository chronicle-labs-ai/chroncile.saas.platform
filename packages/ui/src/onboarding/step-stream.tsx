"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Eyebrow } from "../primitives/eyebrow";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PauseIcon,
  PlayIcon,
} from "../icons/glyphs";
import { CompanyLogo } from "../icons";
import {
  AuthDisplay,
  AuthLede,
  StatusChip,
  StepFoot,
} from "../auth/_internal";
import { DEMO_EVENTS, getSource, type DemoEvent, type SourceId } from "./data";

/*
 * StepStream — third onboarding step. Live event preview using
 * `DEMO_EVENTS` filtered by the connected sources. Pause / resume
 * + paged history (capped at 40 rows). Defaults to playing when
 * `livePreview` is true.
 */

export interface StreamState {
  connected: SourceId[];
}

export interface StepStreamProps {
  value: StreamState;
  onNext?: () => void;
  onBack?: () => void;
  /** Auto-play the preview when mounted. Default true. */
  livePreview?: boolean;
  /** Override the demo event sequence. */
  events?: readonly DemoEvent[];
}

interface StreamRow {
  id: number;
  src: ReturnType<typeof getSource>;
  evName: string;
  meta: string;
  t: Date;
}

/**
 * Onboarding step 03 — live event preview ticker driven by
 * `DEMO_EVENTS` filtered to the connected sources. Pause / resume
 * + paged history capped at 40 rows.
 */
export function StepStream({
  value,
  onNext,
  onBack,
  livePreview = true,
  events = DEMO_EVENTS,
}: StepStreamProps) {
  const connectedSources = React.useMemo(
    () =>
      value.connected
        .map((id) => getSource(id))
        .filter((s): s is NonNullable<ReturnType<typeof getSource>> =>
          Boolean(s)
        ),
    [value.connected]
  );

  const [paused, setPaused] = React.useState(!livePreview);
  const [rows, setRows] = React.useState<StreamRow[]>([]);
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const tickRef = React.useRef(0);

  React.useEffect(() => {
    setPaused(!livePreview);
  }, [livePreview]);

  React.useEffect(() => {
    if (paused || connectedSources.length === 0) return;
    const usable = events.filter((e) =>
      connectedSources.some((s) => s.id === e.src)
    );
    if (usable.length === 0) {
      // Fall back to all demo events if none match — keeps the preview alive.
      // Ports the original behavior for the sandbox case.
    }
    const pool = usable.length > 0 ? usable : events;
    const id = setInterval(
      () => {
        tickRef.current++;
        const evt = pool[Math.floor(Math.random() * pool.length)];
        const src = getSource(evt.src);
        if (!src) return;
        setRows((prev) =>
          [
            {
              id: tickRef.current,
              src,
              evName: evt.name,
              meta: evt.meta,
              t: new Date(),
            },
            ...prev,
          ].slice(0, 40)
        );
      },
      1100 + Math.random() * 700
    );
    return () => clearInterval(id);
  }, [paused, connectedSources, events]);

  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({ top: 0, behavior: "smooth" });
  }, [rows.length]);

  if (connectedSources.length === 0) {
    return (
      <div className="flex flex-col">
        <Eyebrow>Step 03</Eyebrow>
        <AuthDisplay>No sources connected yet.</AuthDisplay>
        <AuthLede>
          Go back and connect at least one source to see live events.
        </AuthLede>
        <StepFoot
          back={
            <Button
              variant="ghost"
              onPress={onBack}
              leadingIcon={<ArrowLeftIcon />}
            >
              Back
            </Button>
          }
          next={null}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Eyebrow>Step 03</Eyebrow>
      <AuthDisplay>
        Your <em>event stream</em>.
      </AuthDisplay>
      <AuthLede>
        Everything your agent will see. Real events, flowing in from your
        connected sources.
      </AuthLede>

      <div className="cg-fade-up cg-fade-up-2 mt-s-6 flex items-center gap-s-3 justify-between">
        {/*
         * Min-width matches the longer "Resume" label so the button
         * width stays stable when the user toggles state — keeps the
         * row from jumping mid-interaction (Emil's no-layout-shift).
         */}
        <Button
          variant="secondary"
          size="sm"
          className="min-w-[96px]"
          onPress={() => setPaused((p) => !p)}
          leadingIcon={paused ? <PlayIcon /> : <PauseIcon />}
        >
          {paused ? "Resume" : "Pause"}
        </Button>
        {/*
         * `tabular-nums` is set on StatusChip so the row count
         * doesn't jitter as it crosses 1- → 2-digit territory.
         */}
        <StatusChip tone={paused ? "amber" : "green"} dot>
          {paused ? "Paused" : "Live"} · {rows.length} events
        </StatusChip>
      </div>

      <div
        ref={scrollerRef}
        className="cg-fade-up cg-fade-up-3 mt-s-3 h-[320px] overflow-y-auto rounded-sm border border-hairline bg-surface-01"
      >
        {rows.length === 0 ? (
          <div className="px-s-4 py-s-8 text-center font-mono text-mono text-ink-dim">
            Waiting for events<span className="cg-blink">_</span>
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="cg-slide-in flex items-center gap-s-3 border-b border-hairline px-s-4 py-s-2 last:border-b-0"
            >
              <span className="w-[60px] font-mono text-mono-sm tabular-nums text-ink-dim">
                {row.t.toTimeString().slice(0, 8)}
              </span>
              <span className="flex">
                <CompanyLogo
                  name={row.src!.name}
                  size={12}
                  rounded
                  fallbackColor={row.src!.color}
                />
              </span>
              <span className="flex-1 truncate font-mono text-mono-lg text-ink-hi">
                {row.src!.id}.{row.evName}
              </span>
              <span className="font-mono text-mono-sm text-ink-dim">
                {row.meta}
              </span>
            </div>
          ))
        )}
      </div>

      <StepFoot
        back={
          <Button
            variant="ghost"
            onPress={onBack}
            leadingIcon={<ArrowLeftIcon />}
          >
            Back
          </Button>
        }
        next={
          <Button
            variant="ember"
            onPress={onNext}
            trailingIcon={<ArrowRightIcon />}
          >
            Continue
          </Button>
        }
      />
    </div>
  );
}
