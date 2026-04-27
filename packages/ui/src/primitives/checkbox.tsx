"use client";

import * as React from "react";
import {
  Checkbox as RACCheckbox,
  type CheckboxProps as RACCheckboxProps,
} from "react-aria-components/Checkbox";

import { tv, type VariantProps } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

/*
 * RAC's Checkbox exposes `isSelected` / `onChange(isSelected: boolean)`.
 * Our existing callsites spread react-hook-form's `{...register()}` result,
 * which supplies native-style `onChange(event)` plus a `ref` callback aimed
 * at the underlying `<input>`. The shim below accepts both shapes:
 *
 *   - `isSelected`/`defaultSelected`/RAC `onChange(bool)`  — pass-through
 *   - `checked`/`defaultChecked`/native `onChange(event)`  — normalized to
 *     RAC form + a synthetic ChangeEvent is created for the caller.
 *   - `ref` callback                                        — routed to
 *     `inputRef` so react-hook-form's input ref collection still works.
 */

const checkbox = tv({
  slots: {
    base:
      "inline-flex items-center gap-s-2 cursor-pointer " +
      "data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
    box:
      "relative flex shrink-0 items-center justify-center " +
      "transition-colors duration-fast ease-out " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:outline-ember " +
      "data-[selected=true]:bg-ember data-[selected=true]:border-ember " +
      "data-[indeterminate=true]:bg-ember data-[indeterminate=true]:border-ember " +
      "data-[invalid=true]:border-event-red",
    mark:
      "stroke-white stroke-[3] opacity-0 " +
      "data-[selected=true]:opacity-100 data-[indeterminate=true]:opacity-100",
    label: "font-sans text-sm text-ink",
  },
  variants: {
    variant: {
      default: {},
      auth: { box: "bg-transparent" },
    },
    size: {
      sm: {
        box:
          "h-[14px] w-[14px] rounded-l-sm border border-l-border-strong bg-transparent " +
          "data-[hovered=true]:border-l-border-hover",
        mark: "h-[10px] w-[10px]",
        label: "text-[12.5px] text-l-ink",
      },
      md: {
        box:
          "h-[16px] w-[16px] rounded-xs border border-hairline-strong bg-surface-00 " +
          "data-[hovered=true]:border-ink-dim",
        mark: "h-[10px] w-[10px]",
        label: "text-sm text-ink",
      },
    },
  },
  defaultVariants: { variant: "default", size: "md" },
});

type CheckboxVariantProps = VariantProps<typeof checkbox>;

type NativeChangeHandler = (
  event: React.ChangeEvent<HTMLInputElement>
) => void | Promise<boolean | void>;

export interface CheckboxProps
  extends
    Omit<RACCheckboxProps, "className" | "onChange" | "children">,
    CheckboxVariantProps {
  className?: string;
  classNames?: {
    base?: string;
    box?: string;
    mark?: string;
    label?: string;
  };
  /**
   * Visual size. `"sm"` (14 px, Linear-density product chrome) or
   * `"md"` (16 px, brand surface). Defaults to whichever the surrounding
   * `ChromeStyleProvider` resolves to (`compact` → `sm`, `brand` → `md`).
   */
  size?: "sm" | "md";
  /** Explicit density override (alias for choosing between `sm` and `md`). */
  density?: "compact" | "brand";
  /** Native-style selection (alias for `isSelected`). */
  checked?: boolean;
  /** Native-style default selection (alias for `defaultSelected`). */
  defaultChecked?: boolean;
  /** Native-style disabled (alias for `isDisabled`). */
  disabled?: boolean;
  /**
   * Accepts either RAC's `(isSelected: boolean) => void` or the native
   * `(event: ChangeEvent<HTMLInputElement>) => void` shape. Detected by
   * argument arity is unreliable, so we always invoke both forms: a
   * synthetic event is constructed for native callers alongside the
   * boolean RAC payload. Handlers that ignore one or the other are safe.
   */
  onChange?: ((isSelected: boolean) => void) | NativeChangeHandler;
  /** Forwarded to the underlying `<input>`. Also accepts a function-ref so react-hook-form's `register().ref` works. */
  ref?: React.Ref<HTMLInputElement>;
  variant?: "default" | "auth";
  children?: React.ReactNode;
}

function synthesizeEvent(
  name: string | undefined,
  isSelected: boolean
): React.ChangeEvent<HTMLInputElement> {
  const target = {
    name: name ?? "",
    checked: isSelected,
    value: name ?? "",
    type: "checkbox",
  } as unknown as HTMLInputElement;

  return {
    target,
    currentTarget: target,
    type: "change",
    nativeEvent: new Event("change"),
    bubbles: true,
    cancelable: true,
    defaultPrevented: false,
    eventPhase: 0,
    isTrusted: false,
    preventDefault: () => {},
    stopPropagation: () => {},
    isPropagationStopped: () => false,
    isDefaultPrevented: () => false,
    persist: () => {},
    timeStamp: Date.now(),
  } as unknown as React.ChangeEvent<HTMLInputElement>;
}

export function Checkbox({
  checked,
  defaultChecked,
  disabled,
  isDisabled,
  isSelected,
  defaultSelected,
  onChange,
  name,
  className,
  classNames,
  variant = "default",
  size,
  density: densityProp,
  ref,
  children,
  ...rest
}: CheckboxProps) {
  const density = useResolvedChromeDensity(densityProp);
  const resolvedSize: "sm" | "md" = size ?? (density === "compact" ? "sm" : "md");
  const slots = checkbox({ variant, size: resolvedSize });

  const resolvedIsSelected = isSelected ?? checked;
  const resolvedDefaultSelected = defaultSelected ?? defaultChecked;
  const resolvedIsDisabled = disabled ?? isDisabled;

  const handleChange = React.useCallback(
    (nextSelected: boolean) => {
      if (!onChange) return;
      // Try native-event shape first (most common when spreading register()).
      const event = synthesizeEvent(name, nextSelected);
      try {
        (onChange as NativeChangeHandler)(event);
      } catch {
        (onChange as (s: boolean) => void)(nextSelected);
      }
    },
    [onChange, name]
  );

  return (
    <RACCheckbox
      {...rest}
      name={name}
      inputRef={ref as React.RefObject<HTMLInputElement | null> | undefined}
      isSelected={resolvedIsSelected}
      defaultSelected={resolvedDefaultSelected}
      isDisabled={resolvedIsDisabled}
      onChange={handleChange}
      data-density={density}
      className={composeTwRenderProps(
        className,
        slots.base({ className: classNames?.base })
      )}
    >
      <div className={slots.box({ className: classNames?.box })}>
        <svg
          aria-hidden
          viewBox="0 0 18 18"
          fill="none"
          className={slots.mark({ className: classNames?.mark })}
        >
          <polyline points="1 9 7 14 15 4" />
        </svg>
      </div>
      {children ? (
        <span className={slots.label({ className: classNames?.label })}>
          {children}
        </span>
      ) : null}
    </RACCheckbox>
  );
}
