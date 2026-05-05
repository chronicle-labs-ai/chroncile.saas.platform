"use client";

import * as React from "react";

/*
 * use-rail-resize — pointer + keyboard resize for a right-edge side
 * rail (the rail's resize handle sits on the LEFT, dragging left to
 * grow). Mirrors the gesture used by the dataset trace detail drawer
 * so manager surfaces, detail surfaces, and per-domain rails all feel
 * the same.
 *
 * Promoted to `layout/` so multiple modules (datasets, agents, …) can
 * consume the same hook without cross-module imports.
 */

export interface UseRailResizeOptions {
  /** Current width in px (controlled). */
  width: number;
  /** Width change request. When omitted the handle is inert. */
  onWidthChange?: (next: number) => void;
  /** Lower clamp. */
  minWidth?: number;
  /** Upper clamp. */
  maxWidth?: number;
}

export interface UseRailResizeReturn {
  dragging: boolean;
  /** Spread onto the resize-handle element. */
  handleProps: {
    role: "separator";
    "aria-orientation": "vertical";
    "aria-valuenow": number;
    "aria-valuemin": number;
    "aria-valuemax": number;
    tabIndex: number;
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  };
}

export function useRailResize({
  width,
  onWidthChange,
  minWidth = 280,
  maxWidth = 560,
}: UseRailResizeOptions): UseRailResizeReturn {
  const [dragging, setDragging] = React.useState(false);
  const dragOriginRef = React.useRef<{
    pointerX: number;
    startWidth: number;
  } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!onWidthChange || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOriginRef.current = { pointerX: event.clientX, startWidth: width };
    setDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const origin = dragOriginRef.current;
    if (!origin || !onWidthChange) return;
    /* Rail sits at the right edge; dragging the handle LEFT
       (negative delta) should grow the panel. */
    const delta = origin.pointerX - event.clientX;
    const next = Math.max(
      minWidth,
      Math.min(maxWidth, origin.startWidth + delta)
    );
    if (next !== width) onWidthChange(next);
  };

  const endResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOriginRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragOriginRef.current = null;
    setDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onWidthChange) return;
    const step = event.shiftKey ? 32 : 8;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onWidthChange(Math.min(maxWidth, width + step));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onWidthChange(Math.max(minWidth, width - step));
    } else if (event.key === "Home") {
      event.preventDefault();
      onWidthChange(maxWidth);
    } else if (event.key === "End") {
      event.preventDefault();
      onWidthChange(minWidth);
    }
  };

  React.useEffect(() => {
    /* Defensive cleanup so a remount mid-drag (or HMR) can't leave
       the body locked in resize mode. */
    return () => {
      if (dragOriginRef.current) {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
  }, []);

  return {
    dragging,
    handleProps: {
      role: "separator",
      "aria-orientation": "vertical",
      "aria-valuenow": width,
      "aria-valuemin": minWidth,
      "aria-valuemax": maxWidth,
      tabIndex: 0,
      onPointerDown,
      onPointerMove,
      onPointerUp: endResize,
      onPointerCancel: endResize,
      onKeyDown,
    },
  };
}

export const RAIL_HANDLE_CLASSNAME =
  "absolute inset-y-0 left-0 z-30 w-1.5 cursor-col-resize touch-none " +
  "transition-colors duration-fast ease-out motion-reduce:transition-none " +
  "before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-px " +
  "before:bg-transparent before:transition-colors before:duration-fast motion-reduce:before:transition-none " +
  "[@media(hover:hover)]:hover:before:bg-l-border-strong " +
  "focus-visible:outline-none focus-visible:before:bg-ember focus-visible:before:w-0.5";
