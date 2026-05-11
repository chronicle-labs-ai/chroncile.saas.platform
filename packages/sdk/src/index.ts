export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export type AttachmentRole = "input" | "output";
export type AttachmentType = "code" | "text" | "image" | "iframe";
export type SignalSentiment = "POSITIVE" | "NEGATIVE";
export type SignalType = "default" | "feedback" | "edit" | "agent" | "standard";
export type SpanKind = "ai" | "model" | "tool" | "stream" | "function" | "http" | "custom";
export type SpanStatus = "ok" | "error" | "pending";

export interface ChronicleAttachment {
  type: AttachmentType | string;
  value: string;
  role: AttachmentRole | string;
  name?: string;
  language?: string;
  contentType?: string;
  metadata?: JsonObject;
}

export interface ChronicleClientOptions {
  writeKey: string;
  endpoint?: string;
  orgId?: string;
  debug?: boolean;
  flushIntervalMs?: number;
  maxBatchSize?: number;
  maxQueueSize?: number;
  fetch?: typeof fetch;
}

export interface EventContext {
  userId?: string;
  eventId?: string;
  eventName?: string;
  convoId?: string;
  properties?: JsonObject;
  attachments?: ChronicleAttachment[];
  traceparent?: string;
  privacy?: JsonObject;
}

export interface TrackEventInput {
  event: string;
  userId?: string;
  eventId?: string;
  convoId?: string;
  properties?: JsonObject;
  attachments?: ChronicleAttachment[];
  timestamp?: string | Date;
}

export interface TrackAiInput extends TrackEventInput {
  model?: string;
  input?: string;
  output?: string;
  usage?: JsonObject;
}

export interface SignalInput {
  eventId: string;
  name: string;
  timestamp?: string | Date;
  properties?: JsonObject;
  attachmentId?: string;
  signalType?: SignalType;
  sentiment?: SignalSentiment;
}

export interface IdentifyInput {
  userId: string;
  traits: JsonObject;
}

export interface TraceSpanInput {
  traceId: string;
  spanId?: string;
  parentSpanId?: string;
  eventId?: string;
  name: string;
  kind?: SpanKind;
  status?: SpanStatus;
  startedAt?: string | Date;
  endedAt?: string | Date;
  durationMs?: number;
  attributes?: JsonObject;
  links?: Array<{
    traceId?: string;
    spanId?: string;
    eventId?: string;
    attributes?: JsonObject;
  }>;
}

export interface TraceTrackInput {
  orgId?: string;
  traceId?: string;
  eventId?: string;
  name?: string;
  startedAt?: string | Date;
  endedAt?: string | Date;
  attributes?: JsonObject;
  spans: TraceSpanInput[];
}

export interface ChronicleClient {
  events: {
    track(input: TrackEventInput): string;
  };
  ai: {
    track(input: TrackAiInput): string;
  };
  signals: {
    track(input: SignalInput): void;
  };
  users: {
    identify(input: IdentifyInput): void;
  };
  traces: {
    track(input: TraceTrackInput): string;
    span(input: TraceSpanInput): string;
    startSpan(input: Omit<TraceSpanInput, "spanId" | "startedAt"> & { spanId?: string }): ActiveSpan;
  };
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface ActiveSpan {
  traceId: string;
  spanId: string;
  finish(input?: {
    status?: SpanStatus;
    endedAt?: string | Date;
    attributes?: JsonObject;
  }): void;
}

type QueueItem =
  | { kind: "event"; input: TrackEventInput; ai?: false; enqueuedAt: string }
  | { kind: "event"; input: TrackAiInput; ai: true; enqueuedAt: string }
  | { kind: "signal"; input: SignalInput; enqueuedAt: string }
  | { kind: "identify"; input: IdentifyInput; enqueuedAt: string }
  | { kind: "trace"; input: TraceTrackInput; enqueuedAt: string };
type NewQueueItem =
  | { kind: "event"; input: TrackEventInput; ai?: false }
  | { kind: "event"; input: TrackAiInput; ai: true }
  | { kind: "signal"; input: SignalInput }
  | { kind: "identify"; input: IdentifyInput }
  | { kind: "trace"; input: TraceTrackInput };

const DEFAULT_ENDPOINT = "http://localhost:8080";
const DEFAULT_ORG_ID = "default";

export class ChronicleApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ChronicleApiError";
  }
}

export function createChronicleClient(options: ChronicleClientOptions): ChronicleClient {
  return new ChronicleBrowserClient(options);
}

export function createId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${random.replaceAll("-", "")}`;
}

function toIsoString(value: string | Date | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function definedObject(input: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as JsonObject;
}

class ChronicleBrowserClient implements ChronicleClient {
  readonly events = {
    track: (input: TrackEventInput) => {
      const eventId = input.eventId ?? createId("evt");
      this.enqueue({ kind: "event", input: { ...input, eventId } });
      return eventId;
    },
  };

  readonly ai = {
    track: (input: TrackAiInput) => {
      const eventId = input.eventId ?? createId("evt");
      this.enqueue({ kind: "event", input: { ...input, eventId }, ai: true });
      return eventId;
    },
  };

  readonly signals = {
    track: (input: SignalInput) => {
      this.enqueue({ kind: "signal", input });
    },
  };

  readonly users = {
    identify: (input: IdentifyInput) => {
      this.enqueue({ kind: "identify", input });
    },
  };

  readonly traces = {
    track: (input: TraceTrackInput) => {
      const traceId = input.traceId ?? createId("trace");
      this.enqueue({ kind: "trace", input: { ...input, traceId } });
      return traceId;
    },
    span: (input: TraceSpanInput) => {
      const spanId = input.spanId ?? createId("span");
      this.enqueue({
        kind: "trace",
        input: {
          traceId: input.traceId,
          eventId: input.eventId,
          spans: [{ ...input, spanId }],
        },
      });
      return spanId;
    },
    startSpan: (input: Omit<TraceSpanInput, "spanId" | "startedAt"> & { spanId?: string }) => {
      const startedAt = new Date();
      const spanId = input.spanId ?? createId("span");
      return {
        traceId: input.traceId,
        spanId,
        finish: (finishInput: Parameters<ActiveSpan["finish"]>[0] = {}) => {
          const endedAt = finishInput.endedAt ?? new Date();
          this.traces.span({
            ...input,
            spanId,
            startedAt,
            endedAt,
            status: finishInput.status ?? "ok",
            durationMs: Math.max(
              0,
              new Date(toIsoString(endedAt) ?? Date.now()).getTime() - startedAt.getTime()
            ),
            attributes: {
              ...(input.attributes ?? {}),
              ...(finishInput.attributes ?? {}),
            },
          });
        },
      };
    },
  };

  private readonly endpoint: string;
  private readonly orgId: string;
  private readonly writeKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxBatchSize: number;
  private readonly maxQueueSize: number;
  private readonly debug: boolean;
  private readonly queue: QueueItem[] = [];
  private droppedEvents = 0;
  private flushTimer: ReturnType<typeof setInterval> | undefined;
  private flushing: Promise<void> | undefined;

  constructor(options: ChronicleClientOptions) {
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.orgId = options.orgId ?? DEFAULT_ORG_ID;
    this.writeKey = options.writeKey;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.maxBatchSize = options.maxBatchSize ?? 50;
    this.maxQueueSize = options.maxQueueSize ?? 10_000;
    this.debug = options.debug ?? false;

    if (!this.fetchImpl) {
      throw new Error("Chronicle SDK requires fetch. Pass options.fetch in this runtime.");
    }

    if (options.flushIntervalMs && options.flushIntervalMs > 0) {
      this.flushTimer = setInterval(() => {
        void this.flush().catch((error) => this.log("flush failed", error));
      }, options.flushIntervalMs);
    }
  }

  async flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = this.flushInternal().finally(() => {
      this.flushing = undefined;
    });
    return this.flushing;
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flush();
  }

  private enqueue(item: NewQueueItem) {
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
      this.droppedEvents += 1;
    }

    this.queue.push({ ...item, enqueuedAt: new Date().toISOString() } as QueueItem);
    if (this.queue.length >= this.maxBatchSize) {
      void this.flush().catch((error) => this.log("flush failed", error));
    }
  }

  private async flushInternal() {
    const flushStartedAt = new Date();
    const batch = this.queue.splice(0, this.queue.length);
    if (batch.length === 0) return;
    const queueSizeAtFlush = batch.length;
    const networkMetrics: NetworkMetric[] = [];

    const events = batch.filter(isEventItem);
    const signals = batch.filter(isSignalItem);
    const identifies = batch.filter(isIdentifyItem);
    const traces = batch.filter(isTraceItem);

    if (events.length > 0) {
      networkMetrics.push(
        await this.request("/v1/events/batch", events.map((item) => this.toChronicleEvent(item)))
      );
    }
    for (const item of identifies) {
      networkMetrics.push(await this.request("/v1/users/identify", {
        org_id: this.orgId,
        user_id: item.input.userId,
        traits: item.input.traits,
        _chronicle_queue: this.queueMetadata(item, queueSizeAtFlush),
      }));
    }
    if (signals.length > 0) {
      networkMetrics.push(await this.request("/v1/signals/track", {
        org_id: this.orgId,
        signals: signals.map((item) => ({
          event_id: item.input.eventId,
          signal_name: item.input.name,
          timestamp: toIsoString(item.input.timestamp),
          properties: item.input.properties,
          attachment_id: item.input.attachmentId,
          signal_type: item.input.signalType ?? "default",
          sentiment: item.input.sentiment,
          _chronicle_queue: this.queueMetadata(item, queueSizeAtFlush),
        })),
      }));
    }
    if (traces.length > 0) {
      networkMetrics.push(await this.request("/v1/traces/track", {
        org_id: this.orgId,
        traces: traces.map((item) => this.toTracePayload(item.input)),
      }));
    }

    if (networkMetrics.length > 0) {
      const flushEndedAt = new Date();
      const flushTraceId = createId("trace");
      await this.request("/v1/traces/track", {
        org_id: this.orgId,
        traces: [
          {
            trace_id: flushTraceId,
            name: "chronicle.sdk.flush",
            started_at: flushStartedAt.toISOString(),
            ended_at: flushEndedAt.toISOString(),
            attributes: {
              queue_size: queueSizeAtFlush,
              dropped_events: this.droppedEvents,
              network: networkMetrics,
            },
            spans: networkMetrics.map((metric) => ({
              trace_id: flushTraceId,
              span_id: createId("span"),
              name: `flush ${metric.path}`,
              kind: "http",
              status: metric.ok ? "ok" : "error",
              started_at: metric.started_at,
              ended_at: metric.ended_at,
              duration_ms: metric.latency_ms,
              attributes: metric as unknown as JsonObject,
            })),
          },
        ],
      });
    }
  }

  private toChronicleEvent(item: Extract<QueueItem, { kind: "event" }>): JsonObject {
    const input = item.input;
    const aiInput = item.ai === true ? (input as TrackAiInput) : undefined;
    const aiData =
      aiInput
        ? definedObject({
            model: aiInput.model,
            input: aiInput.input,
            output: aiInput.output,
            usage: aiInput.usage,
            convo_id: aiInput.convoId,
          })
        : undefined;

    return {
      org_id: this.orgId,
      source: "chronicle.sdk",
      topic: item.ai === true ? "ai" : "events",
      event_type: item.ai === true ? "ai.interaction" : input.event,
      entities: definedObject({
        user: input.userId,
        conversation: input.convoId,
      }) as Record<string, string>,
      timestamp: toIsoString(input.timestamp),
      payload: definedObject({
        event_id: input.eventId,
        user_id: input.userId,
        event: input.event,
        convo_id: input.convoId,
        properties: input.properties as JsonValue | undefined,
        attachments: normalizeAttachments(input.attachments) as unknown as JsonValue | undefined,
        ai_data: aiData,
        _chronicle_queue: this.queueMetadata(item, undefined),
      }),
    };
  }

  private toTracePayload(input: TraceTrackInput): JsonObject {
    const traceId = input.traceId ?? createId("trace");
    return definedObject({
      trace_id: traceId,
      event_id: input.eventId,
      name: input.name,
      started_at: toIsoString(input.startedAt),
      ended_at: toIsoString(input.endedAt),
      attributes: input.attributes,
      _chronicle_queue: this.queueMetadata(
        { kind: "trace", input, enqueuedAt: new Date().toISOString() },
        undefined
      ),
      spans: input.spans.map((span) =>
        definedObject({
          trace_id: span.traceId ?? traceId,
          span_id: span.spanId ?? createId("span"),
          parent_span_id: span.parentSpanId,
          event_id: span.eventId ?? input.eventId,
          name: span.name,
          kind: span.kind ?? "custom",
          status: span.status ?? "ok",
          started_at: toIsoString(span.startedAt),
          ended_at: toIsoString(span.endedAt),
          duration_ms: span.durationMs,
          attributes: span.attributes,
          links: span.links,
        })
      ),
    });
  }

  private queueMetadata(item: QueueItem, queueSizeAtFlush: number | undefined): JsonObject {
    return {
      enqueued_at: item.enqueuedAt,
      queue_size_at_flush: queueSizeAtFlush,
      dropped_events: this.droppedEvents,
    };
  }

  private async request(path: string, body: unknown): Promise<NetworkMetric> {
    const startedAt = new Date();
    const serialized = JSON.stringify(body);
    let retryCount = 0;
    let response = await this.fetchImpl(new URL(path, this.endpoint), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.writeKey}`,
        "Content-Type": "application/json",
      },
      body: serialized,
    });

    if (!response.ok && response.status >= 500) {
      retryCount += 1;
      response = await this.fetchImpl(new URL(path, this.endpoint), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.writeKey}`,
          "Content-Type": "application/json",
        },
        body: serialized,
      });
    }

    const endedAt = new Date();
    const metric: NetworkMetric = {
      path,
      status: response.status,
      ok: response.ok,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      latency_ms: endedAt.getTime() - startedAt.getTime(),
      payload_bytes: byteLength(serialized),
      retry_count: retryCount,
    };

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new ChronicleApiError(
        response.status,
        typeof error.error === "string" ? error.error : "Chronicle request failed"
      );
    }

    return metric;
  }

  private log(message: string, error: unknown) {
    if (this.debug) console.warn(`[chronicle] ${message}`, error);
  }
}

interface NetworkMetric extends JsonObject {
  path: string;
  status: number;
  ok: boolean;
  started_at: string;
  ended_at: string;
  latency_ms: number;
  payload_bytes: number;
  retry_count: number;
}

function byteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value).byteLength;
  return value.length;
}

function normalizeAttachments(attachments: ChronicleAttachment[] | undefined): ChronicleAttachment[] | undefined {
  return attachments?.map((attachment) => ({
    ...attachment,
    metadata: {
      ...(attachment.metadata ?? {}),
      value_bytes: byteLength(attachment.value ?? ""),
      persisted_inline: true,
      truncated: false,
    },
  }));
}

function isEventItem(item: QueueItem): item is Extract<QueueItem, { kind: "event" }> {
  return item.kind === "event";
}

function isSignalItem(item: QueueItem): item is Extract<QueueItem, { kind: "signal" }> {
  return item.kind === "signal";
}

function isIdentifyItem(item: QueueItem): item is Extract<QueueItem, { kind: "identify" }> {
  return item.kind === "identify";
}

function isTraceItem(item: QueueItem): item is Extract<QueueItem, { kind: "trace" }> {
  return item.kind === "trace";
}
