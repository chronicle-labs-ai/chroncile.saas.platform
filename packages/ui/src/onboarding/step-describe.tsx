"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Eyebrow } from "../primitives/eyebrow";
import { FormField } from "../primitives/form-field";
import { Input } from "../primitives/input";
import { Textarea } from "../primitives/textarea";
import { SourceGlyph } from "../icons/source-glyph";
import { ArrowLeftIcon, ArrowRightIcon, SparkIcon } from "../icons/glyphs";
import {
  AuthDisplay,
  AuthLede,
  ParseStrip,
  SelectableCard,
  StepFoot,
  UnderlineTabs,
  type ParseStripState,
} from "../auth/_internal";
import { cx } from "../utils/cx";
import {
  detectSources,
  getSource,
  TEMPLATES,
  type SourceId,
  type Template,
} from "./data";

/*
 * StepDescribe — first onboarding step.
 *
 * Three modes (mirrors sign-up):
 *   • freeform    — single textarea; live-parses to extract sources
 *   • structured  — name + goal + trigger fields
 *   • template    — picks a workspace preset
 *
 * The parent owns the state object; this component reads + writes
 * onto a shared `value` of type `DescribeState`. The detection
 * loop is intrinsic to this component so a freeform prompt always
 * reflects detected sources without parent plumbing.
 */

export type DescribeMode = "freeform" | "structured" | "template";

export interface DescribeState {
  mode: DescribeMode;
  /** Agent name (structured mode) — also used as fallback for templates. */
  name?: string;
  /** Freeform / template prompt text. */
  prompt?: string;
  /** Structured-mode primary goal. */
  goal?: string;
  /** Structured-mode trigger description. */
  trigger?: string;
  /** Template id when mode === "template". */
  templateId?: string;
  /** Computed list of source ids (set after parse / template pick). */
  intendedSources?: SourceId[];
  /** Set when the user takes the "explore with sample data" off-ramp. */
  sandbox?: boolean;
}

export interface StepDescribeProps {
  value: DescribeState;
  onChange: (next: DescribeState) => void;
  onNext?: () => void;
  onBack?: () => void;
  /** Override the templates shown in template mode. */
  templates?: readonly Template[];
  /** Disable the AI parse animation (default 380ms debounce). */
  disableAnimation?: boolean;
}

const MODE_TABS = [
  ["freeform", "Freeform"],
  ["structured", "Form"],
  ["template", "Template"],
] as const satisfies ReadonlyArray<readonly [DescribeMode, string]>;

/**
 * Onboarding step 01 — capture the agent description in one of
 * three modes (freeform / structured / template). Freeform mode
 * live-parses the prompt to extract sources and renders the
 * shared `<ParseStrip>` underneath.
 */
export function StepDescribe({
  value,
  onChange,
  onNext,
  onBack,
  templates = TEMPLATES,
  disableAnimation = false,
}: StepDescribeProps) {
  const [parsing, setParsing] = React.useState(false);

  /* ── Live-detect when in freeform mode ─────────────────── */
  React.useEffect(() => {
    if (value.mode !== "freeform") return;
    const text = value.prompt ?? "";
    if (!text.trim()) {
      if (value.intendedSources && value.intendedSources.length) {
        onChange({ ...value, intendedSources: [] });
      }
      setParsing(false);
      return;
    }
    setParsing(true);
    const id = setTimeout(
      () => {
        const ids = detectSources(text);
        onChange({ ...value, intendedSources: ids });
        setParsing(false);
      },
      disableAnimation ? 50 : 380
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.prompt, value.mode, disableAnimation]);

  const setMode = (m: DescribeMode) => {
    onChange({ ...value, mode: m });
  };

  const detected = (value.intendedSources ?? [])
    .map((id) => getSource(id))
    .filter((s): s is NonNullable<ReturnType<typeof getSource>> => Boolean(s));

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    onChange({
      ...value,
      templateId: id,
      prompt: t.prompt,
      name: t.name,
      intendedSources: [...t.sources],
    });
  };

  const onContinue = () => {
    onChange({
      ...value,
      name: value.name?.trim() || "Untitled agent",
    });
    onNext?.();
  };

  const onSandbox = () => {
    onChange({
      ...value,
      sandbox: true,
      name: value.name?.trim() || "Demo agent",
      prompt:
        value.prompt?.trim() || "Sandbox · explore Chronicle with sample data",
      intendedSources: ["intercom", "shopify", "stripe"],
    });
    onNext?.();
  };

  const canContinue = Boolean(
    (value.prompt && value.prompt.trim().length > 0) || value.templateId
  );

  const parseState: ParseStripState = !value.prompt
    ? "idle"
    : parsing
      ? "parsing"
      : detected.length > 0
        ? "match"
        : "nomatch";

  return (
    <div className="flex flex-col">
      <Eyebrow>Step 01</Eyebrow>
      <AuthDisplay>
        Describe your <em>agent</em>.
      </AuthDisplay>
      <AuthLede>
        Tell us what it does — in plain English. We&rsquo;ll spot the data it
        touches.
      </AuthLede>

      <UnderlineTabs
        className="cg-fade-up cg-fade-up-2 mt-s-6"
        items={MODE_TABS}
        value={value.mode}
        onChange={setMode}
      />

      <div className="cg-fade-up cg-fade-up-3 mt-s-5 flex flex-col gap-s-3">
        {value.mode === "freeform" ? (
          <>
            <Textarea
              placeholder="A support agent for our Shopify store. It reads Intercom conversations, looks up orders, issues Stripe refunds for late shipments, and escalates to Slack when a customer is upset."
              value={value.prompt ?? ""}
              onChange={(e) =>
                onChange({ ...value, prompt: e.currentTarget.value })
              }
              variant="auth"
              rows={6}
              className="min-h-[160px] text-[15.5px] leading-[1.55] font-sans font-light"
            />
            <ParseStrip
              state={parseState}
              placeholder="Start typing — we'll detect the sources you mention."
              noMatchHint="No sources detected yet. Mention a tool and we'll spot it."
              match={
                <>
                  {detected.map((s, i) => (
                    <span
                      key={s.id}
                      className="cg-slide-in inline-flex items-center gap-[6px] font-sans text-[12.5px] text-ink-hi"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <span style={{ color: s.color }}>
                        <SourceGlyph
                          id={s.glyph}
                          color="currentColor"
                          size={14}
                        />
                      </span>
                      {s.name}
                    </span>
                  ))}
                </>
              }
            />
          </>
        ) : null}

        {value.mode === "structured" ? (
          <div className="flex flex-col gap-s-4">
            <FormField tone="auth" label="Agent name" htmlFor="onb-name">
              <Input
                id="onb-name"
                variant="auth"
                placeholder="support-concierge"
                value={value.name ?? ""}
                onChange={(e) =>
                  onChange({ ...value, name: e.currentTarget.value })
                }
              />
            </FormField>
            <FormField tone="auth" label="Primary goal" htmlFor="onb-goal">
              <Input
                id="onb-goal"
                variant="auth"
                placeholder="Resolve refunds in under 3 turns."
                value={value.goal ?? ""}
                onChange={(e) =>
                  onChange({ ...value, goal: e.currentTarget.value })
                }
              />
            </FormField>
            <FormField tone="auth" label="Trigger" htmlFor="onb-trigger">
              <Input
                id="onb-trigger"
                variant="auth"
                placeholder="New Intercom conversation"
                value={value.trigger ?? ""}
                onChange={(e) =>
                  onChange({ ...value, trigger: e.currentTarget.value })
                }
              />
            </FormField>
          </div>
        ) : null}

        {value.mode === "template" ? (
          <div className="flex flex-col gap-s-2">
            {templates.map((t) => {
              const active = value.templateId === t.id;
              return (
                <SelectableCard
                  key={t.id}
                  active={active}
                  padding="md"
                  layout="stack"
                  onClick={() => applyTemplate(t.id)}
                >
                  <div className="flex items-baseline justify-between">
                    <span
                      className={cx(
                        "font-display text-title-sm tracking-tight text-ink-hi",
                        "font-medium"
                      )}
                    >
                      {t.name}
                    </span>
                    {active ? (
                      <span className="inline-flex items-center gap-[4px] font-mono text-mono-sm text-ember">
                        <SparkIcon size={11} /> picked
                      </span>
                    ) : null}
                  </div>
                  <p className="font-sans text-[13px] font-light leading-[1.5] text-ink-lo">
                    {t.blurb}
                  </p>
                </SelectableCard>
              );
            })}
          </div>
        ) : null}
      </div>

      <StepFoot
        back={
          <div className="flex items-center gap-s-2">
            {onBack ? (
              <Button
                variant="ghost"
                onPress={onBack}
                leadingIcon={<ArrowLeftIcon />}
              >
                Back
              </Button>
            ) : null}
            <Button variant="ghost" onPress={onSandbox}>
              I don&rsquo;t have an agent yet — explore with sample data →
            </Button>
          </div>
        }
        next={
          <Button
            variant="ember"
            onPress={onContinue}
            isDisabled={!canContinue}
            trailingIcon={<ArrowRightIcon />}
          >
            Continue
          </Button>
        }
      />
    </div>
  );
}
