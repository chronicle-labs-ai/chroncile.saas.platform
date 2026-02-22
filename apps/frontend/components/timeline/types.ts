export interface TimelineEvent {
  id: string;
  source: string;
  type: string;
  occurredAt: string;
  actor?: string;
  message?: string;
  payload?: Record<string, unknown>;
  stream?: string;
  color?: string;
}

export interface TimelineOptions {
  showControls?: boolean;
  showTree?: boolean;
  followLive?: boolean;
  timeStart?: string;
  timeEnd?: string;
  theme?: "dark" | "light";
  rowHeight?: number;
  labelWidth?: number;
}

export type PlaybackState = "live" | "playing" | "paused";

export interface SelectionEvent {
  eventId: string | null;
  event: TimelineEvent | null;
}

export interface TimeRangeEvent {
  start: string;
  end: string;
}

export interface PlayheadEvent {
  time: string;
}
