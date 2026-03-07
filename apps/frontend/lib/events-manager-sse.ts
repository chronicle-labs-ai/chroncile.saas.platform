export interface ChroniclePendingEntityRefDto {
  entity_type: string;
  entity_id: string;
}

export interface ChronicleEntityRefDto {
  event_id: string;
  entity_type: string;
  entity_id: string;
  created_by: string;
  created_at: string;
}

export interface EventEnvelopeDto {
  event: {
    event_id: string;
    org_id: string;
    source: string;
    topic: string;
    event_type: string;
    event_time: string;
    ingestion_time: string;
    payload?: Record<string, unknown> | null;
    entity_refs?: ChroniclePendingEntityRefDto[];
  };
  entity_refs?: ChronicleEntityRefDto[];
  search_distance?: number | null;
}

export interface SubscribeToStreamParams {
  orgId: string;
  eventType?: string;
  entityType?: string;
  entityId?: string;
}

export function subscribeToStream(
  baseUrl: string,
  params: SubscribeToStreamParams,
  onEvent: (event: EventEnvelopeDto) => void
): () => void {
  void baseUrl;
  void params;
  void onEvent;
  return () => {};
}
