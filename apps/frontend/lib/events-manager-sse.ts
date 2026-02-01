export interface EventEnvelopeDto {
  event_id: string;
  tenant_id: string;
  source: string;
  source_event_id: string;
  event_type: string;
  conversation_id: string;
  actor_type: string;
  actor_id: string;
  actor_name: string | null;
  occurred_at: string;
  ingested_at: string;
  payload: Record<string, unknown>;
  contains_pii: boolean;
}

export interface SubscribeToStreamParams {
  tenantId: string;
  eventType?: string;
  conversationId?: string;
}

export function subscribeToStream(
  baseUrl: string,
  params: SubscribeToStreamParams,
  onEvent: (event: EventEnvelopeDto) => void
): () => void {
  const url = new URL("/api/stream", baseUrl.replace(/\/$/, ""));
  url.searchParams.set("tenant_id", params.tenantId);
  if (params.eventType) url.searchParams.set("event_type", params.eventType);
  if (params.conversationId) url.searchParams.set("conversation_id", params.conversationId);

  const eventSource = new EventSource(url.toString());

  const handler = (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data ?? "{}") as EventEnvelopeDto;
      onEvent(data);
    } catch {
      // ignore parse errors
    }
  };

  eventSource.addEventListener("event", handler);
  eventSource.addEventListener("message", handler);

  return () => {
    eventSource.removeEventListener("event", handler);
    eventSource.close();
  };
}
