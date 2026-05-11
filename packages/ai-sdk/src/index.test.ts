import assert from "node:assert/strict";
import { test } from "node:test";

import * as ai from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { z } from "zod";

import { createChronicleAISDK, eventMetadata, eventMetadataFromChatRequest } from "./index";

function usage() {
  return {
    inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 4, text: 4, reasoning: undefined },
  };
}

function createCaptureClient() {
  const requests: Array<{ path: string; body: unknown }> = [];
  const fetchMock: typeof fetch = async (url, init) => {
    requests.push({
      path: new URL(url.toString()).pathname,
      body: JSON.parse(String(init?.body)),
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  return {
    requests,
    chronicle: createChronicleAISDK({
      writeKey: "test-key",
      endpoint: "http://localhost:8080",
      orgId: "org_ai_sdk",
      fetch: fetchMock,
    }),
  };
}

test("wrap captures real Vercel AI SDK generateText and streamText calls", async () => {
  const { chronicle, requests } = createCaptureClient();
  const wrapped = chronicle.wrap(ai, {
    context: {
      userId: "user_default",
      eventName: "support-chat",
      properties: { app: "tests" },
    },
  });

  const model = new MockLanguageModelV3({
    modelId: "mock-support-model",
    doGenerate: async () => ({
      content: [{ type: "text", text: "Hello from Chronicle" }],
      finishReason: { unified: "stop", raw: undefined },
      usage: usage(),
      warnings: [],
    }),
    doStream: async () => ({
      stream: ai.simulateReadableStream({
        chunks: [
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: "streamed" },
          { type: "text-end", id: "text-1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            logprobs: undefined,
            usage: usage(),
          },
        ],
      }),
    }),
  });

  const generated = await wrapped.generateText({
    model,
    prompt: "hello",
    experimental_telemetry: {
      isEnabled: true,
      metadata: eventMetadata({
        userId: "user_123",
        convoId: "convo_123",
        eventId: "evt_generate",
        properties: { source: "unit" },
        attachments: [{ type: "text", value: "extra context", role: "input" }],
      }),
    },
  });
  assert.equal(generated.text, "Hello from Chronicle");

  const streamed = await wrapped.streamText({
    model,
    prompt: "stream please",
    experimental_telemetry: {
      isEnabled: true,
      metadata: eventMetadataFromChatRequest({
        request: {
          id: "chat_123",
          messages: [{ id: "msg_1", role: "user", content: "stream please" }],
        },
        userId: "user_123",
        eventName: "support-stream",
      }),
    },
  });

  let streamOutput = "";
  for await (const chunk of streamed.textStream) {
    streamOutput += chunk;
  }
  assert.equal(streamOutput, "streamed");

  await chronicle.flush();

  const eventBatches = requests.filter((request) => request.path === "/v1/events/batch");
  const traceBatches = requests.filter((request) => request.path === "/v1/traces/track");
  assert.equal(eventBatches.length, 1);
  assert.ok(traceBatches.length >= 1);

  const events = eventBatches[0]?.body as Array<{ payload: Record<string, unknown> }>;
  assert.equal(events.length, 2);
  assert.equal(events[0]?.payload.event_id, "evt_generate");
  assert.equal(events[1]?.payload.event_id, "evt_msg_1");

  const traceBody = traceBatches[0]?.body as { traces: Array<{ spans: Array<{ attributes: Record<string, unknown> }> }> };
  assert.equal(traceBody.traces.length, 2);
  assert.ok(traceBody.traces.some((trace) => trace.spans.some((span) => span.attributes.stream)));
  assert.ok(traceBody.traces.some((trace) => trace.spans.some((span) => span.attributes.request)));
  assert.ok(traceBody.traces.some((trace) => trace.spans.some((span) => span.attributes.runtime)));
  assert.ok(traceBatches.some((batch) => JSON.stringify(batch.body).includes("chronicle.sdk.flush")));
});

test("wrap captures structured generation and legacy generateObject/streamObject surfaces", async () => {
  const { chronicle, requests } = createCaptureClient();
  const wrapped = chronicle.wrap({
    ...ai,
    generateObject: async () => ({ object: { answer: "yes" }, usage: { outputTokens: 1 } }),
    streamObject: async () => ({
      object: Promise.resolve({ answer: "streamed" }),
      textStream: (async function* () {
        yield "{\"answer\":\"streamed\"}";
      })(),
      usage: { outputTokens: 1 },
    }),
  });

  const model = new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [{ type: "text", text: "{\"answer\":\"yes\"}" }],
      finishReason: { unified: "stop", raw: undefined },
      usage: usage(),
      warnings: [],
    }),
  });

  const structured = await wrapped.generateText({
    model,
    output: ai.Output.object({ schema: z.object({ answer: z.string() }) }),
    prompt: "return json",
    experimental_telemetry: {
      isEnabled: true,
      metadata: eventMetadata({ userId: "user_123", eventId: "evt_structured" }),
    },
  });
  assert.deepEqual(structured.output, { answer: "yes" });

  await (wrapped as any).generateObject({
    experimental_telemetry: {
      metadata: eventMetadata({ userId: "user_123", eventId: "evt_legacy_object" }),
    },
  });
  const streamObject = await (wrapped as any).streamObject({
    experimental_telemetry: {
      metadata: eventMetadata({ userId: "user_123", eventId: "evt_legacy_stream_object" }),
    },
  });
  for await (const _chunk of streamObject.textStream) {
    // Consume the stream so the wrapper can record stream completion metrics.
  }

  chronicle.users.identify({ userId: "user_123", traits: { plan: "paid" } });
  chronicle.signals.track({
    eventId: "evt_structured",
    name: "self diagnostics - missing_context",
    signalType: "agent",
    sentiment: "NEGATIVE",
    properties: { category: "missing_context" },
  });
  await chronicle.flush();

  assert.ok(requests.some((request) => request.path === "/v1/users/identify"));
  assert.ok(requests.some((request) => request.path === "/v1/signals/track"));
  const traces = requests.find((request) => request.path === "/v1/traces/track")?.body as
    | { traces: unknown[] }
    | undefined;
  assert.ok(traces && traces.traces.length >= 3);
});

test("wrap captures AI SDK tool calls as child spans", async () => {
  const { chronicle, requests } = createCaptureClient();
  const wrapped = chronicle.wrap(ai, {
    context: {
      userId: "user_123",
      eventName: "tool-chat",
    },
  });

  let calls = 0;
  const model = new MockLanguageModelV3({
    modelId: "mock-tool-model",
    doGenerate: async () => {
      calls += 1;
      if (calls === 1) {
        return {
          content: [
            {
              type: "tool-call",
              toolCallId: "tool_call_weather",
              toolName: "weather",
              input: JSON.stringify({ city: "San Francisco" }),
            },
          ],
          finishReason: { unified: "tool-calls", raw: undefined },
          usage: usage(),
          warnings: [],
        };
      }

      return {
        content: [{ type: "text", text: "It is 68 degrees in San Francisco." }],
        finishReason: { unified: "stop", raw: undefined },
        usage: usage(),
        warnings: [],
      };
    },
  });

  const result = await wrapped.generateText({
    model,
    prompt: "What is the weather in San Francisco?",
    tools: {
      weather: ai.tool({
        description: "Get the weather in a city",
        inputSchema: z.object({ city: z.string() }),
        execute: async ({ city }) => ({ city, temperature: 68 }),
      }),
    },
    stopWhen: ai.stepCountIs(2),
    experimental_telemetry: {
      isEnabled: true,
      metadata: eventMetadata({
        eventId: "evt_tool_use",
        convoId: "convo_tool_use",
      }),
    },
  });

  assert.equal(result.text, "It is 68 degrees in San Francisco.");
  await chronicle.flush();

  const traceBody = requests.find((request) => request.path === "/v1/traces/track")?.body as
    | {
        traces: Array<{
          spans: Array<{
            name: string;
            kind: string;
            duration_ms?: number;
            status?: string;
            attributes: Record<string, unknown>;
          }>;
        }>;
      }
    | undefined;
  assert.ok(traceBody);

  const spans = traceBody.traces.flatMap((trace) => trace.spans);
  const toolCallSpan = spans.find(
    (span) => span.kind === "tool" && span.name === "weather" && span.attributes.args
  );
  const toolResultSpan = spans.find(
    (span) =>
      span.kind === "tool" &&
      span.name === "weather" &&
      span.attributes.result &&
      typeof span.duration_ms === "number"
  );
  assert.ok(toolCallSpan, "expected a child tool-call span for the weather tool");
  assert.ok(toolResultSpan, "expected a child tool-result span for the weather tool");
  assert.deepEqual(toolCallSpan.attributes.args, { city: "San Francisco" });
  assert.deepEqual(toolResultSpan.attributes.result, { city: "San Francisco", temperature: 68 });
  assert.equal(typeof toolResultSpan.duration_ms, "number");

  const stepSpan = spans.find((span) => span.kind === "model" && span.name === "model step 0");
  assert.ok(stepSpan, "expected a per-step model span");
  assert.equal(stepSpan.attributes.finishReason, "tool-calls");
  assert.equal(stepSpan.attributes.toolCallCount, 1);
});
