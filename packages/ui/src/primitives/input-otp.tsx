"use client";

/*
 * InputOTP — the upstream shadcn / input-otp recipe with Chronicle
 * chrome. New code that needs an OTP entry should reach for this
 * compound; the legacy `<OTPInput>` (single-prop API) is kept and still
 * powers the auth flows, but `InputOTP` matches paste-in shadcn snippets.
 *
 *   <InputOTP maxLength={6}>
 *     <InputOTPGroup>
 *       <InputOTPSlot index={0} />
 *       <InputOTPSlot index={1} />
 *       <InputOTPSlot index={2} />
 *     </InputOTPGroup>
 *     <InputOTPSeparator />
 *     <InputOTPGroup>
 *       <InputOTPSlot index={3} />
 *       <InputOTPSlot index={4} />
 *       <InputOTPSlot index={5} />
 *     </InputOTPGroup>
 *   </InputOTP>
 */

import * as React from "react";
import {
  OTPInput as OTPInputPrimitive,
  OTPInputContext,
} from "input-otp";

import { cn } from "../utils/cn";

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInputPrimitive> & {
  containerClassName?: string;
}) {
  return (
    <OTPInputPrimitive
      data-slot="input-otp"
      containerClassName={cn(
        "flex items-center gap-[6px] has-[:disabled]:opacity-50",
        containerClassName
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

function InputOTPGroup({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex items-center gap-[4px]", className)}
      {...props}
    />
  );
}

interface InputOTPSlotProps extends React.HTMLAttributes<HTMLDivElement> {
  index: number;
}

function InputOTPSlot({
  index,
  className,
  ...props
}: InputOTPSlotProps) {
  const inputOTPContext = React.useContext(OTPInputContext);
  const slot = inputOTPContext?.slots?.[index];
  const char = slot?.char;
  const hasFakeCaret = slot?.hasFakeCaret;
  const isActive = slot?.isActive;

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive ? true : undefined}
      className={cn(
        "relative flex h-[36px] w-[32px] items-center justify-center rounded-md border border-hairline-strong bg-l-surface-input text-center font-sans text-[16px] font-medium text-l-ink transition-[border-color,box-shadow,background-color] duration-fast",
        "data-[active=true]:border-[rgba(216,67,10,0.5)] data-[active=true]:shadow-[0_0_0_3px_rgba(216,67,10,0.12)]",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-pulse bg-ember" />
        </div>
      ) : null}
    </div>
  );
}

function InputOTPSeparator(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="input-otp-separator"
      role="separator"
      className="text-l-ink-dim"
      {...props}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
        <path
          d="M5 12h14"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
