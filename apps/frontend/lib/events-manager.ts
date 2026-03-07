const EVENTS_MANAGER_URL =
  process.env.EVENTS_MANAGER_URL || "http://localhost:8080";

export interface ChroniclePendingEntityRef {
  entity_type: string;
  entity_id: string;
}

export interface ChronicleEntityRef {
  event_id: string;
  entity_type: string;
  entity_id: string;
  created_by: string;
  created_at: string;
}

export interface ChronicleEvent {
  event_id: string;
  org_id: string;
  source: string;
  topic: string;
  event_type: string;
  event_time: string;
  ingestion_time: string;
  payload?: Record<string, unknown> | null;
  entity_refs?: ChroniclePendingEntityRef[];
  raw_body?: string | null;
}

export interface ChronicleEventResult {
  event: ChronicleEvent;
  entity_refs?: ChronicleEntityRef[];
  search_distance?: number | null;
}

export interface IngestEventRequest {
  org_id: string;
  source: string;
  topic: string;
  event_type: string;
  entities?: Record<string, string>;
  payload?: Record<string, unknown>;
  timestamp?: string;
}

export interface IngestResponse {
  event_ids: string[];
  count: number;
}

export interface EventsQueryParams {
  org_id?: string;
  source?: string;
  topic?: string;
  event_type?: string;
  entity_type?: string;
  entity_id?: string;
  limit?: number;
  offset?: number;
  since?: string;
}

export interface EventsResponse {
  events: ChronicleEventResult[];
  total: number;
  has_more: boolean;
}

class EventsManagerClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || EVENTS_MANAGER_URL;
  }

  async ingestEvent(event: IngestEventRequest): Promise<IngestResponse> {
    const response = await fetch(`${this.baseUrl}/v1/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to ingest event: ${error}`);
    }

    return response.json();
  }

  async queryEvents(params: EventsQueryParams): Promise<EventsResponse> {
    const searchParams = new URLSearchParams();

    if (params.org_id) searchParams.set("org_id", params.org_id);
    if (params.source) searchParams.set("source", params.source);
    if (params.topic) searchParams.set("topic", params.topic);
    if (params.event_type) searchParams.set("event_type", params.event_type);
    if (params.entity_type) searchParams.set("entity_type", params.entity_type);
    if (params.entity_id) searchParams.set("entity_id", params.entity_id);
    if (params.limit) searchParams.set("limit", params.limit.toString());
    if (params.offset) searchParams.set("offset", params.offset.toString());
    if (params.since) searchParams.set("since", params.since);

    const response = await fetch(`${this.baseUrl}/v1/events?${searchParams}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to query events: ${error}`);
    }

    const events = (await response.json()) as ChronicleEventResult[];
    return {
      events,
      total: events.length,
      has_more: params.limit ? events.length >= params.limit : false,
    };
  }

  async listEvents(params?: {
    limit?: number;
    source?: string;
    org_id?: string;
  }): Promise<ChronicleEventResult[]> {
    const query = await this.queryEvents({
      org_id: params?.org_id,
      source: params?.source,
      limit: params?.limit,
    });
    return query.events;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const eventsManager = new EventsManagerClient();
export default eventsManager;
