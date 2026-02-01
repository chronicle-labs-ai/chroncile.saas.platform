const EVENTS_MANAGER_URL = process.env.EVENTS_MANAGER_URL || "http://localhost:8080";

export interface IngestEventRequest {
  source: string;
  source_event_id: string;
  event_type: string;
  conversation_id: string;
  ticket_id?: string;
  customer_id?: string;
  actor_type: "customer" | "agent" | "system";
  actor_id: string;
  actor_name?: string;
  payload: Record<string, unknown>;
  contains_pii?: boolean;
  occurred_at?: string;
  tenant_id?: string;
}

export interface IngestResponse {
  event_id: string;
  ingested: boolean;
  message: string;
}

export interface EventEnvelope {
  event_id: string;
  tenant_id: string;
  source: string;
  source_event_id: string;
  event_type: string;
  occurred_at: string;
  ingested_at: string;
  subject: {
    conversation_id: string;
    ticket_id?: string;
    customer_id?: string;
  };
  actor: {
    actor_type: string;
    actor_id: string;
    name?: string;
  };
  payload: Record<string, unknown>;
}

export interface EventsQueryParams {
  tenant_id?: string;
  source?: string;
  event_type?: string;
  conversation_id?: string;
  limit?: number;
  offset?: number;
  start_time?: string;
  end_time?: string;
}

export interface EventsResponse {
  events: EventEnvelope[];
  total: number;
  has_more: boolean;
}

class EventsManagerClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || EVENTS_MANAGER_URL;
  }

  async ingestEvent(event: IngestEventRequest): Promise<IngestResponse> {
    const response = await fetch(`${this.baseUrl}/api/ingest`, {
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
    
    if (params.tenant_id) searchParams.set("tenant_id", params.tenant_id);
    if (params.source) searchParams.set("source", params.source);
    if (params.event_type) searchParams.set("event_type", params.event_type);
    if (params.conversation_id) searchParams.set("conversation_id", params.conversation_id);
    if (params.limit) searchParams.set("limit", params.limit.toString());
    if (params.offset) searchParams.set("offset", params.offset.toString());
    if (params.start_time) searchParams.set("start", params.start_time);
    if (params.end_time) searchParams.set("end", params.end_time);

    const response = await fetch(`${this.baseUrl}/api/events/query?${searchParams}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to query events: ${error}`);
    }

    const data = await response.json();
    return {
      events: data.events || [],
      total: data.count || 0,
      has_more: false,
    };
  }

  async listEvents(params?: { limit?: number; source?: string; tenant_id?: string }): Promise<EventEnvelope[]> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.source) searchParams.set("source", params.source);
    if (params?.tenant_id) searchParams.set("tenant_id", params.tenant_id);

    const response = await fetch(`${this.baseUrl}/api/events/query?${searchParams}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list events: ${error}`);
    }

    const data = await response.json();
    return data.events || [];
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
