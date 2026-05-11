"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Eyebrow } from "../primitives/eyebrow";
import { Spinner } from "../primitives/spinner";
import { CopyButton } from "../primitives/copy-button";
import {
  AlertIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
} from "../icons/glyphs";
import {
  AuthDisplay,
  AuthLede,
  StepFoot,
  UnderlineTabs,
} from "../auth/_internal";

/*
 * StepMiddleware — fourth onboarding step. Language tabs (Python /
 * Node / cURL), a code panel with the install snippet, and a
 * "Test" button that simulates the first-event handshake.
 *
 * The parent owns the actual test request. Pass `onTest` to get
 * the click; manage `received` externally to flip the panel into
 * the success state. Without `onTest`, the component runs a
 * canned 1.8s waiting → received simulation so the demo works
 * standalone.
 */

export type MiddlewareLang = "python" | "node" | "curl";

export interface StepMiddlewareProps {
  language?: MiddlewareLang;
  defaultLanguage?: MiddlewareLang;
  onLanguageChange?: (lang: MiddlewareLang) => void;
  /** Override the snippets shown for each language. */
  snippets?: Record<MiddlewareLang, string>;
  /** Click handler for the "Test" button. Without it, simulates locally. */
  onTest?: () => void;
  /** Externally-controlled "first event received" state. */
  received?: boolean;
  /** Externally-controlled "waiting for the first event" state. */
  waiting?: boolean;
  /**
   * Externally-controlled error message — shows the alert glyph + the
   * provided copy in the test row and overrides the success / waiting
   * states. The Test button stays clickable so the user can retry.
   */
  error?: string | null;
  onNext?: () => void;
  onBack?: () => void;
}

const DEFAULT_SNIPPETS: Record<MiddlewareLang, string> = {
  python: `import chronicle

client = chronicle.Client(api_key="chr_•••")

@client.on("intercom.new_conversation")
def handle(event):
    ctx = client.context(event)  # recent orders, tickets, etc
    reply = your_agent.run(event, ctx)
    client.emit("support.reply", reply)`,
  node: `import { Chronicle } from "@chroniclelabs/sdk";

const chronicle = new Chronicle({ apiKey: "chr_•••" });

chronicle.on("intercom.new_conversation", async (event) => {
  const ctx = await chronicle.context(event);
  const reply = await yourAgent.run(event, ctx);
  await chronicle.emit("support.reply", reply);
});`,
  curl: `curl -X POST https://api.chronicle.io/v1/subscribe \\
  -H "Authorization: Bearer chr_•••" \\
  -d '{ "events": ["intercom.new_conversation"], "webhook": "https://your-agent.com/hook" }'`,
};

const LANG_TABS = [
  ["python", "Python"],
  ["node", "Node"],
  ["curl", "cURL"],
] as const satisfies ReadonlyArray<readonly [MiddlewareLang, string]>;

/**
 * Onboarding step 04 — install snippet with Python / Node / cURL
 * tabs and a "Test" button that simulates the first-event
 * handshake. Pass `onTest` to wire to a real call; without it the
 * component runs a canned 1.8s demo locally.
 */
export function StepMiddleware({
  language: langProp,
  defaultLanguage = "python",
  onLanguageChange,
  snippets = DEFAULT_SNIPPETS,
  onTest,
  received: receivedProp,
  waiting: waitingProp,
  error,
  onNext,
  onBack,
}: StepMiddlewareProps) {
  const isLangControlled = langProp !== undefined;
  const [internalLang, setInternalLang] =
    React.useState<MiddlewareLang>(defaultLanguage);
  const lang = isLangControlled ? langProp! : internalLang;
  const setLang = (l: MiddlewareLang) => {
    if (!isLangControlled) setInternalLang(l);
    onLanguageChange?.(l);
  };

  const isWaitingControlled = waitingProp !== undefined;
  const isReceivedControlled = receivedProp !== undefined;
  const [internalWaiting, setInternalWaiting] = React.useState(false);
  const [internalReceived, setInternalReceived] = React.useState(false);
  const waiting = isWaitingControlled ? waitingProp! : internalWaiting;
  const received = isReceivedControlled ? receivedProp! : internalReceived;

  const simulate = () => {
    if (onTest) {
      onTest();
      return;
    }
    if (isWaitingControlled || isReceivedControlled) return;
    setInternalWaiting(true);
    setInternalReceived(false);
    window.setTimeout(() => {
      setInternalWaiting(false);
      setInternalReceived(true);
    }, 1800);
  };

  return (
    <div className="flex flex-col">
      <Eyebrow>Step 04</Eyebrow>
      <AuthDisplay>
        Wire up your <em>agent</em>.
      </AuthDisplay>
      <AuthLede>Subscribe to events from your code. Pick a language.</AuthLede>

      <UnderlineTabs
        className="cg-fade-up cg-fade-up-2 mt-s-6"
        items={LANG_TABS}
        value={lang}
        onChange={setLang}
      />

      <div className="cg-fade-up cg-fade-up-3 relative mt-s-3 rounded-sm border border-hairline bg-surface-01">
        <div className="absolute right-s-2 top-s-2">
          <CopyButton text={snippets[lang]} />
        </div>
        <pre className="overflow-x-auto whitespace-pre px-s-4 py-s-4 font-mono text-mono-lg leading-[1.7] text-ink-hi">
          {snippets[lang]}
        </pre>
      </div>

      {/*
       * Test row — pinned icon column + min-width button so the
       * leading glyph stays put across idle / waiting / received /
       * error states and the test button doesn't reflow as its label
       * cycles through different lengths.
       */}
      <div className="mt-s-4 flex items-center gap-s-3 rounded-sm border border-hairline bg-surface-01 px-s-3 py-s-2">
        <span className="flex flex-1 items-center gap-s-2 font-mono text-mono text-ink-dim">
          <span className="inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center">
            {error ? (
              <AlertIcon className="text-event-red" />
            ) : received ? (
              <CheckIcon className="text-event-green" />
            ) : waiting ? (
              <Spinner size="sm" tone="ember" />
            ) : null}
          </span>
          <span
            className={
              error
                ? "text-event-red"
                : received
                  ? "text-event-green"
                  : waiting
                    ? "text-ink-lo"
                    : undefined
            }
          >
            {error
              ? error
              : received
                ? "First event received"
                : waiting
                  ? "Waiting for first event…"
                  : "Run your code, then test the connection."}
          </span>
        </span>
        <Button
          variant="secondary"
          size="sm"
          className="min-w-[104px]"
          isDisabled={waiting}
          onPress={simulate}
        >
          {waiting ? "Listening…" : received ? "Test again" : "Test"}
        </Button>
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
            {received ? "Launch" : "Skip for now"}
          </Button>
        }
      />
    </div>
  );
}
