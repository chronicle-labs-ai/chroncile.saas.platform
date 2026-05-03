"use client";

import * as React from "react";
import { cx } from "../utils/cx";

/**
 * GroupHead — sticky 36 px section header used inside Linear-density
 * lists / timelines to label collapsible groups (status / priority /
 * assignee). Hosts a chevron, an icon, the label, a count, and an
 * optional trailing slot for actions.
 *
 *   <GroupHead expanded onToggle={…}>
 *     <Status kind="inprogress" />
 *     <span>In progress</span>
 *     <GroupHead.Count>4</GroupHead.Count>
 *     <GroupHead.Spacer />
 *   </GroupHead>
 *
 * Sticks to the top of its scroll container at `top: 0`. Pair with
 * `<TraceRow>` / `<EventRow>` underneath.
 */

const ChevronDown = ({ className }: { className?: string }) => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="M4 6l4 4 4-4" />
  </svg>
);

interface GroupHeadProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onToggle"
> {
  /** Drives the chevron rotation; chevron points down when expanded. */
  expanded?: boolean;
  /** Fires when the group head is clicked / toggled. */
  onToggle?: (next: boolean) => void;
  /** Hide the leading chevron entirely. */
  hideChevron?: boolean;
}

const Spacer = () => <div className="flex-1" data-slot="group-head-spacer" />;

const Count = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => (
  <span
    className={cx("font-mono text-[11px] text-l-ink-dim", className)}
    data-slot="group-head-count"
  >
    {children}
  </span>
);

function GroupHeadRoot({
  expanded = true,
  onToggle,
  hideChevron = false,
  className,
  children,
  onClick,
  ...props
}: GroupHeadProps) {
  return (
    <div
      data-slot="group-head"
      data-expanded={expanded || undefined}
      role={onToggle ? "button" : undefined}
      tabIndex={onToggle ? 0 : undefined}
      className={cx(
        "sticky top-0 z-[5] flex h-[36px] items-center gap-[10px] px-s-4",
        "border-b border-hairline-strong bg-l-surface-bar",
        "text-[12.5px] font-medium text-l-ink",
        onToggle ? "cursor-pointer hover:bg-l-wash-3" : null,
        "transition-colors duration-fast",
        className
      )}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) onToggle?.(!expanded);
      }}
      onKeyDown={
        onToggle
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggle(!expanded);
              }
            }
          : undefined
      }
      {...props}
    >
      {!hideChevron ? (
        <ChevronDown
          className={cx(
            "shrink-0 text-l-ink-dim transition-transform duration-fast",
            expanded ? "" : "-rotate-90"
          )}
        />
      ) : null}
      {children}
    </div>
  );
}

interface GroupHeadNamespace {
  (props: GroupHeadProps): React.ReactElement;
  Spacer: typeof Spacer;
  Count: typeof Count;
}

const GroupHead = GroupHeadRoot as GroupHeadNamespace;
GroupHead.Spacer = Spacer;
GroupHead.Count = Count;

export { GroupHead };
