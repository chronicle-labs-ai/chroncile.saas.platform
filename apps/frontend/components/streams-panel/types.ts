export type StreamId = string;

export interface Stream {
  id: StreamId;
  name: string;
  color?: string;
  enabled: boolean;
  status: string;
  kind: "LiveApi" | "McapFile" | string;
  event_count: number;
}

export type StreamViewMode = "Mixed" | "Isolated";

export type RecordingState =
  | { kind: "Idle" }
  | { kind: "SelectingStreams" }
  | {
      kind: "Recording";
      startedAt: number;
      eventCount: number;
      recordingStreamIds: StreamId[];
    }
  | {
      kind: "PendingSave";
      eventCount: number;
      durationSecs: number;
      recordedStreamIds: StreamId[];
    };

export const REC_IDLE: RecordingState = { kind: "Idle" };
export const REC_SELECTING: RecordingState = { kind: "SelectingStreams" };

export function recRecording(
  startedAt: number,
  eventCount: number,
  recordingStreamIds: StreamId[]
): RecordingState {
  return { kind: "Recording", startedAt, eventCount, recordingStreamIds };
}

export function recPendingSave(
  eventCount: number,
  durationSecs: number,
  recordedStreamIds: StreamId[]
): RecordingState {
  return { kind: "PendingSave", eventCount, durationSecs, recordedStreamIds };
}
