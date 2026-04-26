"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Eyebrow } from "../primitives/eyebrow";
import { OTPInput } from "../primitives/otp-input";
import { Spinner } from "../primitives/spinner";
import { ArrowLeftIcon } from "../icons/glyphs";
import {
  AuthDisplay,
  AuthLede,
  InlineAlert,
  StepFoot,
} from "./_internal";

/*
 * SignUpVerify — third sign-up step. Six-digit OTP with auto-submit
 * on completion + resend cooldown timer. The parent owns the actual
 * verify call (`onVerify(code)`) and the resend trigger
 * (`onResend()`); this component drives the local UI.
 */

export interface SignUpVerifyProps {
  /** Email the OTP was sent to (rendered into the lede). */
  email: string;
  /** Fires once the user has filled all six cells. */
  onVerify?: (code: string) => void | Promise<void>;
  /** Fires when the user clicks "Resend code". */
  onResend?: () => void | Promise<void>;
  onBack?: () => void;
  /** Show error state (red OTP halo + alert). */
  error?: string | null;
  /** Show success state (green OTP halo) — useful after a positive verify. */
  success?: boolean;
  /** Disable + show "Verifying…" indicator beneath the OTP. */
  isVerifying?: boolean;
  /** Initial cooldown seconds for the resend button. Default 0 (active). */
  resendCooldown?: number;
  /**
   * Optional `Date` (or ISO string) when the OTP becomes invalid.
   * When supplied, the lede swaps from the static
   * "It expires in 10 minutes." copy to a live MM:SS countdown that
   * ticks at 1 Hz (and flips to "Code expired — request a new one."
   * once the deadline passes). Without it, the lede falls back to
   * the static framing.
   */
  expiresAt?: Date | string;
  /** Override the default tip line beneath the OTP. */
  tip?: React.ReactNode;
}

/**
 * Sign-up step 03 — six-digit OTP verify with auto-submit on
 * completion and a resend cooldown timer. Parent owns the verify +
 * resend handlers.
 */
export function SignUpVerify({
  email,
  onVerify,
  onResend,
  onBack,
  error = null,
  success = false,
  isVerifying = false,
  resendCooldown: initialCooldown = 0,
  expiresAt,
  tip,
}: SignUpVerifyProps) {
  const [code, setCode] = React.useState("");
  const [cooldown, setCooldown] = React.useState(initialCooldown);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  /* Wall-clock state — updated at 1 Hz when `expiresAt` is set so the
   * lede's MM:SS countdown reactively re-derives. We don't read
   * `Date.now()` during render (it's an impure side-effect) — instead
   * the effect's setInterval pushes fresh ticks into state, and the
   * memo derives purely from (expiresAt, now). */
  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    if (!expiresAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  /* Live MM:SS countdown — drives the lede expiry copy. Only runs
   * when `expiresAt` is provided; otherwise the lede falls back to
   * its static framing. */
  const expiryMMSS = React.useMemo(() => {
    if (!expiresAt) return null;
    const target =
      typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
    const ms = target.getTime() - now;
    if (Number.isNaN(ms)) return null;
    if (ms <= 0) return { expired: true, mmss: "00:00" } as const;
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return {
      expired: false,
      mmss: `${m.toString().padStart(2, "0")}:${s
        .toString()
        .padStart(2, "0")}`,
    } as const;
  }, [expiresAt, now]);

  const handleResend = () => {
    if (cooldown > 0 || !onResend) return;
    setCooldown(30);
    void onResend();
  };

  const handleComplete = (full: string) => {
    if (onVerify) void onVerify(full);
  };

  /* Lede expiry sentence:
   *   - With `expiresAt`: live "expires in MM:SS" countdown (or
   *     "Code expired" when ms <= 0).
   *   - Without `expiresAt`: static fallback ("expires in 10 minutes")
   *     so existing callers without the prop keep their copy. */
  const ledeExpiry = expiryMMSS
    ? expiryMMSS.expired
      ? <>Code expired — request a new one.</>
      : <>It expires in <b className="text-ink-hi font-medium">{expiryMMSS.mmss}</b>.</>
    : <>It expires in 10 minutes.</>;

  return (
    <div className="flex flex-col">
      <Eyebrow>Step 03 · Verify</Eyebrow>
      <AuthDisplay>Verify your <em>email.</em></AuthDisplay>
      <AuthLede>
        We sent a 6-digit code to{" "}
        <b className="text-ink-hi font-medium">
          {email || "you@company.com"}
        </b>
        . {ledeExpiry}
      </AuthLede>

      <div className="cg-fade-up cg-fade-up-2 mt-s-8 flex flex-col gap-s-3">
        {error ? <InlineAlert>{error}</InlineAlert> : null}

        <OTPInput
          length={6}
          value={code}
          onChange={setCode}
          onComplete={handleComplete}
          error={!!error}
          success={success}
          disabled={isVerifying}
          codeGridStyle
        />

        <div className="flex items-center justify-between font-mono text-mono-sm text-ink-dim">
          <span>Didn&rsquo;t get it? Check spam.</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || !onResend}
            className="text-ink-lo hover:text-ink-hi disabled:text-ink-faint transition-colors"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </div>

        {isVerifying ? (
          <div className="inline-flex items-center justify-center gap-s-2 font-mono text-mono-sm text-ink-lo">
            <Spinner size="sm" tone="ember" />
            <span>Verifying…</span>
          </div>
        ) : null}

        <p className="font-mono text-mono-sm text-ink-dim">
          {tip ?? (
            <>
              Tip: the code auto-fills on paste · try{" "}
              <b className="text-ink-lo font-medium">483 921</b>
            </>
          )}
        </p>
      </div>

      <StepFoot
        back={
          <Button density="brand" variant="ghost" onPress={onBack} leadingIcon={<ArrowLeftIcon />}>
            Back
          </Button>
        }
        next={null}
      />
    </div>
  );
}
