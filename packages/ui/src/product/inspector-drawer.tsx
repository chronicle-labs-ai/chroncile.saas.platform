"use client";

import * as React from "react";
import { cx } from "../utils/cx";

/**
 * InspectorDrawer — Linear-style overlay drawer for trace / event
 * detail. Mounts to the right edge inside the `AppShell`'s `main`
 * region (or any positioned container) and slides in/out via the
 * `open` prop.
 *
 *   <InspectorDrawer open={selected != null} onClose={…}>
 *     <InspectorDrawer.Header eyebrow="CHR-1284 · TRACE">
 *       Refund · wrong shipping address
 *     </InspectorDrawer.Header>
 *     <InspectorDrawer.Body>
 *       <InspectorDrawer.Field label="Status">
 *         <Status kind="canceled" /> Failed
 *       </InspectorDrawer.Field>
 *       <InspectorDrawer.Field label="Priority">
 *         <Priority level="urgent" /> Urgent
 *       </InspectorDrawer.Field>
 *     </InspectorDrawer.Body>
 *   </InspectorDrawer>
 */

interface RootProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  open: boolean;
  onClose?: () => void;
  /** Drawer width. Defaults to 380. */
  width?: number;
}

const CloseIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

function Root({
  open,
  onClose,
  width = 380,
  className,
  children,
  ...props
}: RootProps) {
  return (
    <aside
      data-slot="inspector-drawer"
      data-open={open || undefined}
      aria-hidden={!open}
      role="complementary"
      className={cx(
        "absolute right-0 top-0 bottom-0 z-30",
        "flex flex-col border-l border-l-border bg-l-surface-raised",
        "shadow-l-pop",
        "transition-transform duration-[200ms] ease-out",
        open ? "translate-x-0" : "translate-x-full",
        className
      )}
      style={{ width }}
      {...props}
    >
      {onClose ? (
        <button
          type="button"
          aria-label="Close inspector"
          onClick={onClose}
          className={cx(
            "absolute right-s-2 top-s-2 z-10",
            "inline-flex h-[24px] w-[24px] items-center justify-center rounded-l text-l-ink-dim",
            "hover:bg-l-wash-3 hover:text-l-ink transition-colors duration-fast"
          )}
        >
          <CloseIcon />
        </button>
      ) : null}
      {children}
    </aside>
  );
}

interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: React.ReactNode;
}

function Header({ eyebrow, className, children, ...props }: HeaderProps) {
  return (
    <div
      className={cx(
        "border-b border-l-border-faint px-s-4 py-s-3 pr-s-8",
        className
      )}
      {...props}
    >
      {eyebrow ? (
        <div className="font-mono text-[10.5px] uppercase tracking-eyebrow text-l-ink-dim">
          {eyebrow}
        </div>
      ) : null}
      <h3 className="mt-[6px] font-display text-[20px] font-medium leading-tight text-l-ink">
        {children}
      </h3>
    </div>
  );
}

function Body({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx("flex-1 overflow-auto px-s-4 py-s-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
}

function Field({ label, className, children, ...props }: FieldProps) {
  return (
    <div
      className={cx(
        "grid grid-cols-[80px_1fr] items-center gap-s-3 py-[6px] text-[13px]",
        className
      )}
      {...props}
    >
      <span className="text-l-ink-lo">{label}</span>
      <span className="flex items-center gap-s-2 text-l-ink">{children}</span>
    </div>
  );
}

function Footer({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "border-t border-l-border-faint px-s-4 py-s-3 flex items-center gap-s-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface InspectorDrawerNamespace {
  (props: RootProps): React.ReactElement;
  Header: typeof Header;
  Body: typeof Body;
  Field: typeof Field;
  Footer: typeof Footer;
}

const InspectorDrawer = Root as InspectorDrawerNamespace;
InspectorDrawer.Header = Header;
InspectorDrawer.Body = Body;
InspectorDrawer.Field = Field;
InspectorDrawer.Footer = Footer;

export { InspectorDrawer };
