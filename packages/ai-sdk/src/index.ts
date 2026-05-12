import {
  createChronicleClient,
  createId,
  type ChronicleAttachment,
  type ChronicleClient,
  type ChronicleClientOptions,
  type EventContext,
  type JsonObject,
  type JsonValue,
  type SpanKind,
  type TraceSpanInput,
} from "@chroniclelabs/sdk";

export interface ChronicleAISDKOptions extends ChronicleClientOptions {
  app?: {
    name?: string;
    version?: string;
    deploymentId?: string;
    gitSha?: string;
    region?: string;
  };
  privacy?: {
    containsPii?: boolean;
    redacted?: boolean;
    redactedFields?: string[];
  };
  events?: {
    enabled?: boolean;
    partialFlushMs?: number;
    debug?: boolean;
  };
  traces?: {
    enabled?: boolean;
    flushIntervalMs?: number;
    maxBatchSize?: number;
    debug?: boolean;
  };
}

export interface WrapOptions {
  context?: EventContext;
  autoAttachment?: boolean;
  buildEvent?: (messages: unknown[]) => Partial<AiEventParts>;
  send?: {
    events?: boolean;
    traces?: boolean;
  };
  selfDiagnostics?: {
    enabled?: boolean;
    toolName?: string;
    guidance?: string;
    signals?: Record<string, { description: string; sentiment?: "POSITIVE" | "NEGATIVE" }>;
  };
}

export interface AiEventParts {
  input?: string;
  output?: string;
  properties?: JsonObject;
  attachments?: ChronicleAttachment[];
}

export interface ChronicleMetadata extends EventContext, Record<string, any> {
  __chronicle: true;
  traceparent?: string;
  privacy?: ChronicleAISDKOptions["privacy"];
}

type AiSdkModule = Record<string, unknown>;
type AiFunction = (options: Record<string, unknown>) => Promise<unknown> | unknown;

export function createChronicleAISDK(options: ChronicleAISDKOptions) {
  const client = createChronicleClient(options);
  return new ChronicleAISDK(client, options);
}

export function eventMetadata(context: EventContext): ChronicleMetadata {
  return { ...context, __chronicle: true };
}

export function eventMetadataFromChatRequest({
  request,
  userId,
  eventName,
  properties,
}: {
  request: { id?: string; messages?: Array<{ id?: string; role?: string; content?: unknown }> };
  userId?: string;
  eventName?: string;
  properties?: JsonObject;
}): ChronicleMetadata {
  const latestUserMessage = [...(request.messages ?? [])]
    .reverse()
    .find((message) => message.role === "user");

  return eventMetadata({
    userId,
    eventName,
    convoId: request.id,
    eventId: latestUserMessage?.id ? `evt_${latestUserMessage.id}` : undefined,
    properties,
  });
}

class ChronicleAISDK {
  readonly users: ChronicleClient["users"];
  readonly signals: ChronicleClient["signals"];
  readonly traces: ChronicleClient["traces"];

  constructor(
    private readonly client: ChronicleClient,
    private readonly options: ChronicleAISDKOptions
  ) {
    this.users = client.users;
    this.signals = client.signals;
    this.traces = client.traces;
  }

  wrap<T extends AiSdkModule>(ai: T, options: WrapOptions = {}): T {
    const wrapped: Record<string, unknown> = { ...ai };

    for (const method of ["generateText", "streamText", "generateObject", "streamObject"]) {
      const fn = ai[method];
      if (typeof fn === "function") {
        wrapped[method] = (callOptions: Record<string, unknown>) =>
          this.captureCall(method, fn as AiFunction, callOptions, options);
      }
    }

    const Agent = ai.ToolLoopAgent;
    if (typeof Agent === "function") {
      wrapped.ToolLoopAgent = this.wrapToolLoopAgent(Agent as new (...args: unknown[]) => unknown, options);
    }

    return wrapped as T;
  }

  flush() {
    return this.client.flush();
  }

  async shutdown() {
    await this.client.shutdown();
  }

  private async captureCall(
    method: string,
    fn: AiFunction,
    callOptions: Record<string, unknown>,
    wrapOptions: WrapOptions
  ) {
    const startedAt = new Date();
    const context = resolveContext(wrapOptions.context, callOptions);
    const eventId = context.eventId ?? createId("evt");
    const parentTrace = parseTraceparent(context.traceparent);
    const traceId = parentTrace?.traceId ?? createW3cTraceId();
    const rootSpanId = createW3cSpanId();
    const traceparent = `00-${traceId}-${rootSpanId}-01`;
    const sendEvents = wrapOptions.send?.events ?? this.options.events?.enabled ?? true;
    const sendTraces = wrapOptions.send?.traces ?? this.options.traces?.enabled ?? true;
    const lifecycle = createLifecycleCapture();
    const instrumentedCallOptions = withLifecycleCallbacks(callOptions, lifecycle);

    try {
      const result = await fn(instrumentedCallOptions);
      if (isStreamingMethod(method)) {
        return this.instrumentStreamResult({
          method,
          result,
          startedAt,
          traceId,
          rootSpanId,
          eventId,
          context,
          callOptions: instrumentedCallOptions,
          wrapOptions,
          sendEvents,
          sendTraces,
          lifecycle,
          traceparent,
        });
      }

      const endedAt = new Date();
      this.captureCompletedCall({
        method,
        result,
        startedAt,
        endedAt,
        traceId,
        rootSpanId,
        eventId,
        context,
        callOptions: instrumentedCallOptions,
        wrapOptions,
        sendEvents,
        sendTraces,
        lifecycle,
        traceparent,
      });
      return result;
    } catch (error) {
      const endedAt = new Date();
      if (sendTraces) {
        this.client.traces.track({
          traceId,
          eventId,
          name: method,
          startedAt,
          endedAt,
          spans: [
            span({
              traceId,
              spanId: rootSpanId,
              eventId,
              name: method,
              kind: "ai",
              status: "error",
              startedAt,
              endedAt,
              attributes: {
                error: normalizeError(error),
                runtime: runtimeContext(this.options),
                traceparent,
              },
            }),
          ],
        });
      }
      throw error;
    }
  }

  private instrumentStreamResult(input: CaptureInput & { result: unknown }) {
    const stream = getTextStream(input.result);
    let firstChunkAt: Date | undefined;
    let chunkCount = 0;
    let finalized = false;
    const output: string[] = [];

    const finalize = (endedAt = new Date()) => {
      if (finalized) return;
      finalized = true;
      this.captureCompletedCall({
        ...input,
        result: input.result,
        endedAt,
        streamMetrics: {
          msToFirstChunk: firstChunkAt ? firstChunkAt.getTime() - input.startedAt.getTime() : undefined,
          msToFinish: endedAt.getTime() - input.startedAt.getTime(),
          chunkCount,
        },
        outputOverride: output.join(""),
      });
    };

    if (isAsyncIterable(stream)) {
      const original = stream;
      const wrappedStream = (async function* () {
        try {
          for await (const chunk of original) {
            if (!firstChunkAt) firstChunkAt = new Date();
            chunkCount += 1;
            output.push(String(chunk));
            yield chunk;
          }
        } finally {
          finalize();
        }
      })();

      input.result = { ...(input.result as Record<string, unknown>), textStream: wrappedStream };
    }

    const response = (input.result as { response?: Promise<unknown> } | undefined)?.response;
    if (response && typeof response.then === "function") {
      void response.finally(() => finalize());
    }

    return input.result;
  }

  private captureCompletedCall(input: CaptureInput & {
    result: unknown;
    endedAt: Date;
    streamMetrics?: JsonObject;
    outputOverride?: string;
  }) {
    const messages = Array.isArray(input.callOptions.messages) ? input.callOptions.messages : [];
    const built = input.wrapOptions.buildEvent?.(messages) ?? {};
    const extracted = extractResultParts(input.result);
    const normalizedRequest = normalizeRequest(input.callOptions);
    const runtime = runtimeContext(this.options);
    const privacy = privacyMetadata(this.options, input.context, normalizedRequest, built.attachments);
    const inputText = built.input ?? extractInput(input.callOptions);
    const output = input.outputOverride ?? built.output ?? extracted.output;
    const properties: JsonObject = {
      ...(input.context.properties ?? {}),
      ...(built.properties ?? {}),
      method: input.method,
      model: describeModel(input.callOptions.model),
      provider: describeProvider(input.callOptions.model),
      request: normalizedRequest,
      runtime,
      privacy,
      traceparent: input.traceparent,
      trace_context: {
        trace_id: input.traceId,
        span_id: input.rootSpanId,
        traceparent: input.traceparent,
      },
      latency: {
        total_ms: input.endedAt.getTime() - input.startedAt.getTime(),
        stream_ms: input.streamMetrics?.msToFinish,
        tool_ms: input.lifecycle.toolExecutions.reduce((sum, record) => sum + (record.durationMs ?? 0), 0),
      },
      usage: extracted.usage,
      finishReason: extracted.finishReason,
      rawFinishReason: extracted.rawFinishReason,
      warnings: extracted.warnings,
      providerMetadata: extracted.providerMetadata,
      response: extracted.response,
      steps: input.lifecycle.stepFinishes.map(stepSummary),
      stream: input.streamMetrics,
    };

    if (input.sendEvents) {
      this.client.ai.track({
        eventId: input.eventId,
        userId: input.context.userId,
        event: input.context.eventName ?? input.method,
        convoId: input.context.convoId,
        model: describeModel(input.callOptions.model),
        input: inputText,
        output,
        properties,
        attachments: [
          ...(input.context.attachments ?? []),
          ...(built.attachments ?? []),
          ...extractAttachments(input.callOptions, input.wrapOptions.autoAttachment ?? true),
        ].map(normalizeAttachment),
      });
    }

    if (input.sendTraces) {
      this.client.traces.track({
        traceId: input.traceId,
        eventId: input.eventId,
        name: input.method,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        attributes: properties,
        spans: [
          span({
            traceId: input.traceId,
            spanId: input.rootSpanId,
            eventId: input.eventId,
            name: input.method,
            kind: "ai",
            startedAt: input.startedAt,
            endedAt: input.endedAt,
            attributes: properties,
            links: [{ attributes: { traceparent: input.traceparent } }],
          }),
          ...extractStepSpans(input.lifecycle, input.traceId, input.rootSpanId, input.eventId),
          ...extractLifecycleToolSpans(input.lifecycle, input.traceId, input.rootSpanId, input.eventId),
          ...(
            input.lifecycle.toolExecutions.length > 0
              ? []
              : extractToolSpans(input.result, input.traceId, input.rootSpanId, input.eventId)
          ),
        ],
      });
    }
  }

  private wrapToolLoopAgent(Agent: new (...args: unknown[]) => unknown, wrapOptions: WrapOptions) {
    const sdk = this;
    return class ChronicleWrappedToolLoopAgent extends (Agent as new (...args: unknown[]) => Record<string, unknown>) {
      async generate(options: Record<string, unknown>) {
        const generate = async (callOptions: Record<string, unknown>) =>
          super.generate ? await (super.generate as AiFunction)(callOptions) : undefined;
        return sdk.captureCall("ToolLoopAgent.generate", generate, options, wrapOptions);
      }

      async stream(options: Record<string, unknown>) {
        const stream = async (callOptions: Record<string, unknown>) =>
          super.stream ? await (super.stream as AiFunction)(callOptions) : undefined;
        return sdk.captureCall("ToolLoopAgent.stream", stream, options, wrapOptions);
      }
    };
  }
}

interface CaptureInput {
  method: string;
  startedAt: Date;
  traceId: string;
  rootSpanId: string;
  eventId: string;
  context: EventContext;
  callOptions: Record<string, unknown>;
  wrapOptions: WrapOptions;
  sendEvents: boolean;
  sendTraces: boolean;
  lifecycle: LifecycleCapture;
  traceparent: string;
}

interface LifecycleCapture {
  toolExecutions: ToolExecutionRecord[];
  stepFinishes: Record<string, unknown>[];
}

interface ToolExecutionRecord {
  toolCallId?: string;
  name: string;
  stepNumber?: number;
  startedAt: Date;
  endedAt?: Date;
  durationMs?: number;
  success?: boolean;
  args?: JsonValue;
  result?: JsonValue;
  error?: JsonObject;
  model?: JsonObject;
}

function createLifecycleCapture(): LifecycleCapture {
  return {
    toolExecutions: [],
    stepFinishes: [],
  };
}

function withLifecycleCallbacks(
  callOptions: Record<string, unknown>,
  lifecycle: LifecycleCapture
): Record<string, unknown> {
  const originalToolStart = callOptions.experimental_onToolCallStart;
  const originalToolFinish = callOptions.experimental_onToolCallFinish;
  const originalStepFinish = callOptions.onStepFinish;

  return {
    ...callOptions,
    tools: wrapTools(callOptions.tools, lifecycle),
    experimental_onToolCallStart: async (event: Record<string, unknown>) => {
      const toolCall = event.toolCall as Record<string, unknown> | undefined;
      lifecycle.toolExecutions.push({
        toolCallId: typeof toolCall?.toolCallId === "string" ? toolCall.toolCallId : undefined,
        name: String(toolCall?.toolName ?? "tool"),
        stepNumber: typeof event.stepNumber === "number" ? event.stepNumber : undefined,
        startedAt: new Date(),
        args: toJsonValue(toolCall?.input),
        model: toJsonObject(event.model),
      });
      if (typeof originalToolStart === "function") {
        await originalToolStart(event);
      }
    },
    experimental_onToolCallFinish: async (event: Record<string, unknown>) => {
      const toolCall = event.toolCall as Record<string, unknown> | undefined;
      const toolCallId = typeof toolCall?.toolCallId === "string" ? toolCall.toolCallId : undefined;
      const record =
        lifecycle.toolExecutions.find((item) => item.toolCallId === toolCallId) ??
        lifecycle.toolExecutions[
          lifecycle.toolExecutions.push({
            toolCallId,
            name: String(toolCall?.toolName ?? "tool"),
            stepNumber: typeof event.stepNumber === "number" ? event.stepNumber : undefined,
            startedAt: new Date(Date.now() - Number(event.durationMs ?? 0)),
            args: toJsonValue(toolCall?.input),
            model: toJsonObject(event.model),
          }) - 1
        ];

      const endedAt = new Date();
      record.endedAt = endedAt;
      record.durationMs = typeof event.durationMs === "number" ? event.durationMs : endedAt.getTime() - record.startedAt.getTime();
      record.success = event.success === true;
      if (event.success === true) {
        record.result = toJsonValue(event.output);
      } else {
        record.error = normalizeError(event.error);
      }

      if (typeof originalToolFinish === "function") {
        await originalToolFinish(event);
      }
    },
    onStepFinish: async (event: Record<string, unknown>) => {
      lifecycle.stepFinishes.push(event);
      if (typeof originalStepFinish === "function") {
        await originalStepFinish(event);
      }
    },
  };
}

function wrapTools(tools: unknown, lifecycle: LifecycleCapture): unknown {
  if (!tools || typeof tools !== "object" || Array.isArray(tools)) return tools;

  return Object.fromEntries(
    Object.entries(tools as Record<string, unknown>).map(([name, tool]) => {
      if (!tool || typeof tool !== "object") return [name, tool];
      const record = tool as Record<string, unknown>;
      if (typeof record.execute !== "function") return [name, tool];
      const originalExecute = record.execute as (...args: unknown[]) => Promise<unknown> | unknown;

      return [
        name,
        {
          ...record,
          execute: async (...args: unknown[]) => {
            const startedAt = new Date();
            const input = args[0];
            try {
              const result = await originalExecute(...args);
              const endedAt = new Date();
              lifecycle.toolExecutions.push({
                name,
                startedAt,
                endedAt,
                durationMs: endedAt.getTime() - startedAt.getTime(),
                success: true,
                args: toJsonValue(input),
                result: toJsonValue(result),
              });
              return result;
            } catch (error) {
              const endedAt = new Date();
              lifecycle.toolExecutions.push({
                name,
                startedAt,
                endedAt,
                durationMs: endedAt.getTime() - startedAt.getTime(),
                success: false,
                args: toJsonValue(input),
                error: normalizeError(error),
              });
              throw error;
            }
          },
        },
      ];
    })
  );
}

function resolveContext(defaults: EventContext | undefined, callOptions: Record<string, unknown>): EventContext {
  const metadata =
    ((callOptions.experimental_telemetry as { metadata?: unknown } | undefined)?.metadata as
      | Partial<ChronicleMetadata>
      | undefined) ??
    ((callOptions as { metadata?: unknown }).metadata as Partial<ChronicleMetadata> | undefined);

  return {
    ...defaults,
    ...metadata,
    properties: {
      ...(defaults?.properties ?? {}),
      ...(metadata?.properties ?? {}),
    },
    attachments: [...(defaults?.attachments ?? []), ...(metadata?.attachments ?? [])],
  };
}

function span(input: TraceSpanInput): TraceSpanInput {
  return {
    status: "ok",
    ...input,
    durationMs:
      input.durationMs ??
      (input.startedAt && input.endedAt
        ? new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime()
        : undefined),
  };
}

function isStreamingMethod(method: string) {
  return method.toLowerCase().includes("stream");
}

function getTextStream(result: unknown): unknown {
  return (result as { textStream?: unknown } | undefined)?.textStream;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof (value as { [Symbol.asyncIterator]?: unknown } | undefined)?.[Symbol.asyncIterator] === "function";
}

function extractInput(callOptions: Record<string, unknown>): string | undefined {
  if (typeof callOptions.prompt === "string") return callOptions.prompt;
  if (Array.isArray(callOptions.messages)) return JSON.stringify(callOptions.messages);
  return undefined;
}

function extractResultParts(result: unknown): {
  output?: string;
  usage?: JsonObject;
  finishReason?: JsonValue;
  rawFinishReason?: JsonValue;
  warnings?: JsonValue;
  providerMetadata?: JsonValue;
  response?: JsonObject;
} {
  const record = result as Record<string, unknown> | undefined;
  if (!record) return {};
  const steps = Array.isArray(record.steps) ? (record.steps as Array<Record<string, unknown>>) : [];
  const lastStep = steps.at(-1);

  return {
    output:
      typeof record.text === "string"
        ? record.text
        : record.object !== undefined
          ? JSON.stringify(record.object)
          : undefined,
    usage: toJsonObject(record.usage),
    finishReason: toJsonValue(record.finishReason ?? lastStep?.finishReason),
    rawFinishReason: toJsonValue(record.rawFinishReason ?? lastStep?.rawFinishReason),
    warnings: toJsonValue(record.warnings ?? lastStep?.warnings),
    providerMetadata: toJsonValue(record.providerMetadata ?? lastStep?.providerMetadata),
    response: toJsonObject(record.response ?? lastStep?.response),
  };
}

function extractAttachments(callOptions: Record<string, unknown>, enabled: boolean): ChronicleAttachment[] {
  if (!enabled) return [];
  const attachments = (callOptions as { attachments?: unknown }).attachments;
  return Array.isArray(attachments) ? (attachments as ChronicleAttachment[]) : [];
}

function normalizeRequest(callOptions: Record<string, unknown>): JsonObject {
  return {
    system: toJsonValue(callOptions.system),
    prompt: typeof callOptions.prompt === "string" ? callOptions.prompt : undefined,
    messages: normalizeMessages(callOptions.messages),
    tools: normalizeTools(callOptions.tools),
    toolChoice: toJsonValue(callOptions.toolChoice),
    temperature: typeof callOptions.temperature === "number" ? callOptions.temperature : undefined,
    maxOutputTokens:
      typeof callOptions.maxOutputTokens === "number"
        ? callOptions.maxOutputTokens
        : typeof callOptions.maxTokens === "number"
          ? callOptions.maxTokens
          : undefined,
    providerOptions: toJsonValue(callOptions.providerOptions),
    stopSequences: toJsonValue(callOptions.stopSequences),
    stopWhen: callOptions.stopWhen ? String(callOptions.stopWhen) : undefined,
    output: callOptions.output ? String(callOptions.output) : undefined,
  };
}

function normalizeMessages(messages: unknown): JsonValue | undefined {
  if (!Array.isArray(messages)) return undefined;
  return messages.map((message) => {
    const record = message as Record<string, unknown>;
    return {
      role: typeof record.role === "string" ? record.role : undefined,
      content: toJsonValue(record.content),
      id: typeof record.id === "string" ? record.id : undefined,
    };
  }) as JsonValue;
}

function normalizeTools(tools: unknown): JsonValue | undefined {
  if (!tools || typeof tools !== "object" || Array.isArray(tools)) return undefined;
  return Object.fromEntries(
    Object.entries(tools as Record<string, unknown>).map(([name, tool]) => {
      const record = tool as Record<string, unknown>;
      return [
        name,
        {
          name,
          description: typeof record.description === "string" ? record.description : undefined,
          title: typeof record.title === "string" ? record.title : undefined,
          inputSchema: schemaSummary(record.inputSchema),
          dynamic: Boolean(record.dynamic),
          providerExecuted: Boolean(record.providerExecuted),
        },
      ];
    })
  ) as JsonValue;
}

function schemaSummary(schema: unknown): JsonValue | undefined {
  if (!schema) return undefined;
  if (typeof schema === "object") {
    const record = schema as Record<string, unknown>;
    return {
      typeName: record._def ? "zod" : String(record.type ?? typeof schema),
      json: safeJson(schema),
    };
  }
  return String(schema);
}

function runtimeContext(options: ChronicleAISDKOptions): JsonObject {
  const nodeProcess = typeof process !== "undefined" ? process : undefined;
  return {
    sdk: {
      name: "@chroniclelabs/ai-sdk",
      version: "0.1.0",
    },
    runtime: detectRuntime(),
    node: nodeProcess?.versions?.node,
    app: {
      name: options.app?.name ?? nodeProcess?.env?.CHRONICLE_APP_NAME,
      version: options.app?.version ?? nodeProcess?.env?.CHRONICLE_APP_VERSION,
      deploymentId: options.app?.deploymentId ?? nodeProcess?.env?.VERCEL_DEPLOYMENT_ID,
      gitSha: options.app?.gitSha ?? nodeProcess?.env?.VERCEL_GIT_COMMIT_SHA,
      region: options.app?.region ?? nodeProcess?.env?.VERCEL_REGION,
    },
  };
}

function detectRuntime(): string {
  if (typeof process !== "undefined" && process.versions?.node) return "node";
  if (typeof (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime !== "undefined") return "edge";
  if (typeof (globalThis as { window?: unknown }).window !== "undefined") return "browser";
  return "unknown";
}

function privacyMetadata(
  options: ChronicleAISDKOptions,
  context: EventContext,
  request: JsonObject,
  attachments: ChronicleAttachment[] | undefined
): JsonObject {
  const privacy = { ...(options.privacy ?? {}), ...(context.privacy ?? {}) } as JsonObject;
  return {
    ...privacy,
    request_bytes: jsonBytes(request),
    attachment_count: attachments?.length ?? context.attachments?.length ?? 0,
    attachments_inline: true,
    truncated: false,
  };
}

function normalizeAttachment(attachment: ChronicleAttachment): ChronicleAttachment {
  return {
    ...attachment,
    metadata: {
      ...(attachment.metadata ?? {}),
      value_bytes: attachment.value ? new TextEncoder().encode(attachment.value).byteLength : 0,
      persisted_inline: true,
      truncated: false,
    },
  };
}

function parseTraceparent(traceparent: string | undefined): { traceId: string; spanId: string } | undefined {
  const match = traceparent?.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/i);
  if (!match) return undefined;
  return { traceId: match[1].toLowerCase(), spanId: match[2].toLowerCase() };
}

function createW3cTraceId(): string {
  return randomHex(16);
}

function createW3cSpanId(): string {
  return randomHex(8);
}

function randomHex(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  globalThis.crypto?.getRandomValues?.(buffer);
  if (buffer.every((byte) => byte === 0)) {
    for (let i = 0; i < buffer.length; i += 1) buffer[i] = Math.floor(Math.random() * 256);
  }
  return [...buffer].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value ?? null)).byteLength;
}

function safeJson(value: unknown): JsonValue | undefined {
  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  } catch {
    return undefined;
  }
}

function extractToolSpans(
  result: unknown,
  traceId: string,
  parentSpanId: string,
  eventId: string
): TraceSpanInput[] {
  const spans: TraceSpanInput[] = [];
  const records = collectToolRecords(result);
  for (const record of records) {
    spans.push(
      span({
        traceId,
        spanId: createId("span"),
        parentSpanId,
        eventId,
        name: record.name,
        kind: "tool",
        attributes: record.attributes,
      })
    );
  }
  return spans;
}

function extractStepSpans(
  lifecycle: LifecycleCapture,
  traceId: string,
  parentSpanId: string,
  eventId: string
): TraceSpanInput[] {
  return lifecycle.stepFinishes.map((step) => {
    const stepNumber = typeof step.stepNumber === "number" ? step.stepNumber : undefined;
    return span({
      traceId,
      spanId: stepSpanId(parentSpanId, stepNumber),
      parentSpanId,
      eventId,
      name: stepNumber === undefined ? "model step" : `model step ${stepNumber}`,
      kind: "model",
      attributes: {
        stepNumber,
        model: toJsonValue(step.model),
        finishReason: toJsonValue(step.finishReason),
        rawFinishReason: toJsonValue(step.rawFinishReason),
        usage: toJsonValue(step.usage),
        warnings: toJsonValue(step.warnings),
        providerMetadata: toJsonValue(step.providerMetadata),
        request: toJsonValue(step.request),
        response: toJsonValue(step.response),
        toolCallCount: Array.isArray(step.toolCalls) ? step.toolCalls.length : undefined,
        toolResultCount: Array.isArray(step.toolResults) ? step.toolResults.length : undefined,
      },
    });
  });
}

function extractLifecycleToolSpans(
  lifecycle: LifecycleCapture,
  traceId: string,
  parentSpanId: string,
  eventId: string
): TraceSpanInput[] {
  const records = lifecycle.toolExecutions.filter((record) => {
    if (record.toolCallId) return true;
    return !lifecycle.toolExecutions.some(
      (other) =>
        other !== record &&
        Boolean(other.toolCallId) &&
        other.name === record.name &&
        stableJson(other.args) === stableJson(record.args) &&
        stableJson(other.result) === stableJson(record.result)
    );
  });

  return records.map((record) =>
    span({
      traceId,
      spanId: createId("span"),
      parentSpanId: stepSpanId(parentSpanId, record.stepNumber),
      eventId,
      name: record.name,
      kind: "tool",
      status: record.success === false ? "error" : "ok",
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      durationMs: record.durationMs,
      attributes: {
        toolCallId: record.toolCallId,
        stepNumber: record.stepNumber,
        model: record.model,
        args: record.args,
        result: record.result,
        error: record.error,
      },
    })
  );
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function stepSpanId(parentSpanId: string, stepNumber: number | undefined): string {
  return stepNumber === undefined ? `${parentSpanId}_step_unknown` : `${parentSpanId}_step_${stepNumber}`;
}

function stepSummary(step: Record<string, unknown>): JsonObject {
  return {
    stepNumber: typeof step.stepNumber === "number" ? step.stepNumber : undefined,
    model: toJsonValue(step.model),
    finishReason: toJsonValue(step.finishReason),
    rawFinishReason: toJsonValue(step.rawFinishReason),
    usage: toJsonValue(step.usage),
    warnings: toJsonValue(step.warnings),
    providerMetadata: toJsonValue(step.providerMetadata),
    toolCallCount: Array.isArray(step.toolCalls) ? step.toolCalls.length : undefined,
    toolResultCount: Array.isArray(step.toolResults) ? step.toolResults.length : undefined,
  };
}

function collectToolRecords(value: unknown): Array<{ name: string; attributes: JsonObject }> {
  const records: Array<{ name: string; attributes: JsonObject }> = [];
  const root = value as { steps?: unknown; toolCalls?: unknown; toolResults?: unknown } | undefined;

  for (const step of Array.isArray(root?.steps) ? root.steps : []) {
    records.push(...collectToolRecords(step));
  }

  for (const call of Array.isArray(root?.toolCalls) ? root.toolCalls : []) {
    const item = call as Record<string, unknown>;
    records.push({
      name: String(item.toolName ?? item.name ?? "tool"),
      attributes: {
        args: toJsonValue(item.args ?? item.input),
        toolCallId: typeof item.toolCallId === "string" ? item.toolCallId : undefined,
      },
    });
  }

  for (const result of Array.isArray(root?.toolResults) ? root.toolResults : []) {
    const item = result as Record<string, unknown>;
    records.push({
      name: String(item.toolName ?? item.name ?? "tool.result"),
      attributes: {
        result: toJsonValue(item.result ?? item.output),
        toolCallId: typeof item.toolCallId === "string" ? item.toolCallId : undefined,
      },
    });
  }

  return records;
}

function describeModel(model: unknown): string | undefined {
  if (!model) return undefined;
  if (typeof model === "string") return model;
  const record = model as Record<string, unknown>;
  return String(record.modelId ?? record.model ?? record.id ?? record.provider ?? "unknown");
}

function describeProvider(model: unknown): string | undefined {
  if (!model || typeof model === "string") return undefined;
  const record = model as Record<string, unknown>;
  return typeof record.provider === "string" ? record.provider : undefined;
}

function normalizeError(error: unknown): JsonObject {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }
  return {
    message: String(error),
  };
}

function toJsonObject(value: unknown): JsonObject | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as JsonObject;
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    Array.isArray(value) ||
    typeof value === "object"
  ) {
    return value as JsonValue;
  }
  return undefined;
}
