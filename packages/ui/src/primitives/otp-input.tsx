"use client";

import * as React from "react";
import { cva } from "class-variance-authority";

/*
 * OTPInput — N-cell numeric one-time-passcode input. Paste-aware
 * (a 6-digit string anywhere in the clipboard is split across the
 * cells), arrow-keys move focus, backspace clears the current cell
 * then steps back and clears the previous one. Fires `onComplete`
 * when every cell is filled.
 *
 * Controlled: pass `value` (string of digits, length ≤ `length`)
 * and `onChange(next)`. Uncontrolled: omit both — `defaultValue`
 * seeds the cells.
 */

export const otpRowVariants = cva("flex gap-[6px]", {
  variants: {
    codeGrid: {
      true: "gap-s-3",
      false: "",
    },
  },
  defaultVariants: {
    codeGrid: false,
  },
});

export const otpCellVariants = cva(
  "text-center border outline-none transition-[border-color,box-shadow,background-color] duration-fast ease-out disabled:opacity-40 disabled:cursor-not-allowed h-[36px] w-[32px] rounded-md bg-l-surface-input caret-ember font-sans font-medium text-[16px] text-l-ink border-hairline-strong hover:border-l-border-strong focus:border-[rgba(216,67,10,0.5)] focus:shadow-[0_0_0_3px_rgba(216,67,10,0.12)]",
  {
    variants: {
      state: {
        idle: "",
        filled: "",
        error:
          "border-event-red focus:border-event-red focus:shadow-[0_0_0_3px_rgba(239,68,68,0.18)]",
        success:
          "border-[rgba(74,222,128,0.45)] focus:border-event-green focus:shadow-[0_0_0_3px_rgba(74,222,128,0.18)]",
      },
      codeGrid: {
        true: "h-[64px] w-[52px] text-[26px] caret-[3px] rounded-md bg-transparent focus:caret-ember focus:shadow-[0_0_0_3px_rgba(216,67,10,0.16)]",
        false: "",
      },
    },
    compoundVariants: [
      { state: "filled", className: "bg-l-surface-raised-2" },
    ],
    defaultVariants: {
      codeGrid: false,
      state: "idle",
    },
  }
);

export interface OTPInputProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "onChange" | "defaultValue"
  > {
  /** Number of cells. Defaults to 6. */
  length?: number;
  /** Controlled string of digits (length ≤ `length`). */
  value?: string;
  /** Uncontrolled seed value. */
  defaultValue?: string;
  /** Fires on every keystroke / paste with the current concatenated string. */
  onChange?: (value: string) => void;
  /** Fires once when every cell is filled. */
  onComplete?: (value: string) => void;
  /** Auto-focus the first cell on mount. Defaults to true. */
  autoFocus?: boolean;
  /** Render in error tone (red border + halo). */
  error?: boolean;
  /** Render in success tone (green border + halo). */
  success?: boolean;
  /** Disable every cell. */
  disabled?: boolean;
  /**
   * Render in the taller "code grid" style used by `SignUpVerify`
   * (A.3): bigger cells (~52×64px), `•` placeholder for empty cells,
   * thicker ember caret. Behaviour is identical to the default style.
   */
  codeGridStyle?: boolean;
  /** Aria label for the group. Defaults to "One-time passcode". */
  "aria-label"?: string;
}

/**
 * Multi-cell OTP input — auto-advances on type, jumps back on
 * backspace, and pastes a full code in one go. Fires `onComplete`
 * once every cell is filled.
 */
export function OTPInput({
  length = 6,
  value: valueProp,
  defaultValue,
  onChange,
  onComplete,
  autoFocus = true,
  error = false,
  success = false,
  disabled = false,
  codeGridStyle = false,
  className,
  "aria-label": ariaLabel = "One-time passcode",
  ...rest
}: OTPInputProps) {
  const isControlled = valueProp !== undefined;
  const [internal, setInternal] = React.useState<string>(() =>
    (defaultValue ?? "").replace(/\D/g, "").slice(0, length)
  );
  const value = isControlled
    ? (valueProp ?? "").replace(/\D/g, "").slice(0, length)
    : internal;

  const cells = React.useMemo(
    () => Array.from({ length }, (_, i) => value[i] ?? ""),
    [value, length]
  );

  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const [focusedIdx, setFocusedIdx] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (autoFocus && refs.current[0] && !disabled) {
      refs.current[0].focus();
      refs.current[0].select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completeRef = React.useRef(false);
  React.useEffect(() => {
    if (value.length === length && !completeRef.current) {
      completeRef.current = true;
      onComplete?.(value);
    } else if (value.length < length) {
      completeRef.current = false;
    }
  }, [value, length, onComplete]);

  const setCellAt = (i: number, digit: string) => {
    const next = cells.slice();
    next[i] = digit;
    const joined = next.join("");
    if (!isControlled) setInternal(joined);
    onChange?.(joined);
  };

  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    const digit = v.replace(/\D/g, "").slice(-1);
    if (!digit && v.length > 0) return;
    setCellAt(i, digit);
    if (digit && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (
    i: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace") {
      if (cells[i]) {
        setCellAt(i, "");
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
        setCellAt(i - 1, "");
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
      e.preventDefault();
    } else if (e.key === "ArrowRight" && i < length - 1) {
      refs.current[i + 1]?.focus();
      e.preventDefault();
    } else if (e.key === "Home") {
      refs.current[0]?.focus();
      e.preventDefault();
    } else if (e.key === "End") {
      refs.current[length - 1]?.focus();
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    e.preventDefault();
    const digits = text.slice(0, length);
    if (!isControlled) setInternal(digits);
    onChange?.(digits);
    const lastIdx = Math.min(digits.length, length - 1);
    requestAnimationFrame(() => {
      refs.current[lastIdx]?.focus();
      refs.current[lastIdx]?.select();
    });
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={otpRowVariants({
        codeGrid: codeGridStyle,
        className,
      })}
      onPaste={handlePaste}
      data-state={error ? "error" : success ? "success" : "idle"}
      data-style={codeGridStyle ? "code-grid" : "default"}
      {...rest}
    >
      {cells.map((digit, i) => {
        const cellInput = (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={digit}
            disabled={disabled}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onFocus={(e) => {
              setFocusedIdx(i);
              e.currentTarget.select();
            }}
            onBlur={() => setFocusedIdx((cur) => (cur === i ? null : cur))}
            aria-label={`Digit ${i + 1} of ${length}`}
            className={otpCellVariants({
              state: error
                ? "error"
                : success
                  ? "success"
                  : digit
                    ? "filled"
                    : "idle",
              codeGrid: codeGridStyle,
            })}
          />
        );
        if (!codeGridStyle) return cellInput;
        return (
          <span
            key={i}
            className="cg-code-grid-cell relative"
            data-filled={digit ? "true" : "false"}
            data-focused={focusedIdx === i ? "true" : "false"}
          >
            {cellInput}
          </span>
        );
      })}
    </div>
  );
}
