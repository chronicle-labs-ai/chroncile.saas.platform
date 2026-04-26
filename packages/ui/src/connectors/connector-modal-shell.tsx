"use client";

import * as React from "react";
import { Modal } from "../primitives/modal";
import { AuthStepper, type AuthStep } from "../auth/auth-stepper";
import { cx } from "../utils/cx";

/*
 * ConnectorModalShell — bespoke modal frame for the per-source
 * "Connect <vendor>" flows. Wraps the shared `Modal` primitive
 * (RAC overlay, focus trap, ESC dismiss) and overrides the head
 * to render a glyph + title + sub + stepper-dot row, plus a footer
 * with an optional left-side status block alongside the action
 * buttons.
 *
 * The shell is presentational. State (current step, selected
 * scopes, etc.) lives in the archetype modal that consumes it.
 *
 * Three width sizes:
 *   md  — 540 px  (default, single-column flows)
 *   lg  — 640 px  (wizards with rail + body)
 *   xl  — 760 px  (HubSpot mapping, video composites)
 */

export interface ConnectorModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  /** Headline text. */
  title: React.ReactNode;
  /** Sub-line under the title (vendor blurb / step caption). */
  sub?: React.ReactNode;
  /** Glyph rendered in the head's accent square. */
  glyph?: React.ReactNode;
  /** Color for the glyph square's tint (CSS color or var). */
  glyphTint?: string;
  /** Optional stepper-dot trail (uses `AuthStepper`). */
  stepperDots?: {
    steps: readonly AuthStep[];
    currentIndex: number;
  };
  /**
   * Footer content. When an object, the shell draws the canonical
   * footer with `status` on the left and `actions` on the right.
   * Pass a `ReactNode` directly to render arbitrary footer markup.
   */
  footer?:
    | { status?: React.ReactNode; actions?: React.ReactNode }
    | React.ReactNode;
  /** Width preset. Default `md`. */
  size?: "md" | "lg" | "xl";
  children: React.ReactNode;
  /** Per-slot class overrides forwarded to the underlying Modal. */
  classNames?: {
    body?: string;
    head?: string;
    footer?: string;
    modal?: string;
  };
}

const isFooterObj = (
  v: ConnectorModalShellProps["footer"],
): v is { status?: React.ReactNode; actions?: React.ReactNode } =>
  v != null &&
  typeof v === "object" &&
  !React.isValidElement(v) &&
  ("status" in v || "actions" in v);

const SIZE_CLASS: Record<NonNullable<ConnectorModalShellProps["size"]>, string> = {
  md: "max-w-[540px]",
  lg: "max-w-[640px]",
  xl: "max-w-[760px]",
};

export function ConnectorModalShell({
  isOpen,
  onClose,
  title,
  sub,
  glyph,
  glyphTint,
  stepperDots,
  footer,
  size = "md",
  children,
  classNames,
}: ConnectorModalShellProps) {
  const head = (
    <div className={cx("cmodal-head", classNames?.head)}>
      {glyph ? (
        <span
          className="cmodal-glyph"
          style={glyphTint ? { color: glyphTint } : undefined}
        >
          {glyph}
        </span>
      ) : null}
      <div className="cmodal-titles">
        <div className="cmodal-title">{title}</div>
        {sub ? <div className="cmodal-sub">{sub}</div> : null}
      </div>
      {stepperDots ? (
        <AuthStepper
          steps={[...stepperDots.steps]}
          currentIndex={stepperDots.currentIndex}
          className="cmodal-dots"
        />
      ) : null}
    </div>
  );

  const footerNode = footer != null
    ? isFooterObj(footer)
      ? (
          <>
            <span className="cmodal-foot-status">{footer.status}</span>
            <span className="cmodal-foot-actions">{footer.actions}</span>
          </>
        )
      : footer
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={head}
      actions={footerNode}
      classNames={{
        modal: cx("cmodal", SIZE_CLASS[size], classNames?.modal),
        header: "cmodal-header",
        title: "cmodal-title-slot",
        body: cx("cmodal-body", classNames?.body),
        actions: cx("cmodal-foot", classNames?.footer),
      }}
    >
      {children}
    </Modal>
  );
}
