"use client";

import { useCallback, useMemo, useState } from "react";
import {
  MIN_HALF_WIDTH_MS,
  MAX_HALF_WIDTH_MS,
  getTickIntervalSeconds,
} from "./constants";
export interface TimeViewState {
  centerMs: number;
  halfWidthMs: number;
}

const now = () => Date.now();

export function useTimeView(initialCenterMs?: number, initialHalfWidthMs?: number) {
  const [centerMs, setCenterMs] = useState(
    initialCenterMs ?? now() - 30 * 60 * 1000
  );
  const [halfWidthMs, setHalfWidthMs] = useState(
    initialHalfWidthMs ?? 30 * 60 * 1000
  );

  const startMs = centerMs - halfWidthMs;
  const endMs = centerMs + halfWidthMs;
  const durationMs = halfWidthMs * 2;

  const pan = useCallback((deltaMs: number) => {
    setCenterMs((c) => c + deltaMs);
  }, []);

  const zoomAt = useCallback(
    (anchorTimeMs: number, factor: number) => {
      const newHalf = Math.round(halfWidthMs / factor);
      const clamped = Math.min(
        MAX_HALF_WIDTH_MS,
        Math.max(MIN_HALF_WIDTH_MS, newHalf)
      );
      const anchorOffset = anchorTimeMs - centerMs;
      const scale = clamped / halfWidthMs;
      const newAnchorOffset = anchorOffset * scale;
      const centerAdjust = anchorOffset - newAnchorOffset;
      setCenterMs((c) => c + centerAdjust);
      setHalfWidthMs(clamped);
    },
    [centerMs, halfWidthMs]
  );

  const fitToTimes = useCallback(
    (timesMs: number[], paddingRatio = 0.1) => {
      if (timesMs.length === 0) return;
      const minT = Math.min(...timesMs);
      const maxT = Math.max(...timesMs);
      const duration = Math.max(1000, maxT - minT);
      const padding = duration * paddingRatio;
      const newHalf = Math.min(
        MAX_HALF_WIDTH_MS,
        Math.max(MIN_HALF_WIDTH_MS, (duration + padding * 2) / 2)
      );
      setCenterMs((minT + maxT) / 2);
      setHalfWidthMs(newHalf);
    },
    []
  );

  const setRange = useCallback((startMs: number, endMs: number) => {
    if (endMs <= startMs) return;
    const duration = endMs - startMs;
    setCenterMs((startMs + endMs) / 2);
    setHalfWidthMs(
      Math.min(MAX_HALF_WIDTH_MS, Math.max(MIN_HALF_WIDTH_MS, duration / 2))
    );
  }, []);

  const timeToX = useCallback(
    (timeMs: number, width: number): number => {
      if (durationMs <= 0) return width / 2;
      const fraction = (timeMs - startMs) / durationMs;
      return fraction * width;
    },
    [startMs, durationMs]
  );

  const xToTime = useCallback(
    (x: number, width: number): number => {
      if (width <= 0) return centerMs;
      const fraction = x / width;
      return startMs + fraction * durationMs;
    },
    [startMs, durationMs, centerMs]
  );

  const tickIntervalSeconds = useMemo(
    () => getTickIntervalSeconds(durationMs),
    [durationMs]
  );

  return {
    centerMs,
    halfWidthMs,
    startMs,
    endMs,
    durationMs,
    pan,
    zoomAt,
    fitToTimes,
    setRange,
    timeToX,
    xToTime,
    getTickIntervalSeconds: () => getTickIntervalSeconds(durationMs),
    tickIntervalSeconds,
  };
}
