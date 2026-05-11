import assert from "node:assert/strict";
import { test } from "node:test";

import * as ai from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { z } from "zod";

import { createChronicleAISDK, eventMetadata } from "./index";

const endpoint = process.env.CHRONICLE_TEST_ENDPOINT;
const writeKey = process.env.CHRONICLE_TEST_WRITE_KEY;
const orgId = process.env.CHRONICLE_TEST_ORG_ID;

const hasLiveConfig = Boolean(endpoint && writeKey && orgId);

function usage() {
  return {
    inputTokens: { total: 8, noCache: 8, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 12, text: 12, reasoning: undefined },
  };
}

test(
  "live Node SDK captures Vercel AI SDK generation, streaming, and tool use",
  { skip: !hasLiveConfig ? "set CHRONICLE_TEST_ENDPOINT, CHRONICLE_TEST_WRITE_KEY, and CHRONICLE_TEST_ORG_ID" : false },
  async () => {
    assert.ok(endpoint);
    assert.ok(writeKey);
    assert.ok(orgId);

    const chronicle = createChronicleAISDK({
      endpoint,
      writeKey,
      orgId,
      flushIntervalMs: 0,
    });
    const wrapped = chronicle.wrap(ai, {
      context: {
        userId: "node-live-user",
        eventName: "node-live-vercel-ai-sdk",
        properties: { test: "live-node" },
      },
    });

    let calls = 0;
    const model = new MockLanguageModelV3({
      modelId: "node-live-mock-model",
      doGenerate: async () => {
        calls += 1;
        if (calls === 1) {
          return {
            content: [
              {
                type: "tool-call",
                toolCallId: "tool_call_lookup",
                toolName: "lookupOrder",
                input: JSON.stringify({ orderId: "ord_live_123" }),
              },
            ],
            finishReason: { unified: "tool-calls", raw: undefined },
            usage: usage(),
            warnings: [],
          };
        }

        return {
          content: [{ type: "text", text: "Order ord_live_123 ships tomorrow." }],
          finishReason: { unified: "stop", raw: undefined },
          usage: usage(),
          warnings: [],
        };
      },
      doStream: async () => ({
        stream: ai.simulateReadableStream({
          chunks: [
            { type: "text-start", id: "text-1" },
            { type: "text-delta", id: "text-1", delta: "streamed live response" },
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

    const eventId = `evt_node_live_${Date.now()}`;
    const generateResult = await wrapped.generateText({
      model,
      prompt: "When does order ord_live_123 ship?",
      tools: {
        lookupOrder: ai.tool({
          description: "Lookup an order",
          inputSchema: z.object({ orderId: z.string() }),
          execute: async ({ orderId }) => ({ orderId, status: "shipping_tomorrow" }),
        }),
      },
      stopWhen: ai.stepCountIs(2),
      experimental_telemetry: {
        isEnabled: true,
        metadata: eventMetadata({
          eventId,
          convoId: "convo_node_live",
          attachments: [
            { type: "text", role: "input", value: "Customer asks about order shipping." },
            { type: "code", role: "output", name: "tool-fixture", language: "json", value: "{\"ok\":true}" },
          ],
        }),
      },
    });
    assert.equal(generateResult.text, "Order ord_live_123 ships tomorrow.");

    const streamResult = await wrapped.streamText({
      model,
      prompt: "Stream a short answer",
      experimental_telemetry: {
        isEnabled: true,
        metadata: eventMetadata({
          eventId: `${eventId}_stream`,
          convoId: "convo_node_live",
        }),
      },
    });
    let streamed = "";
    for await (const chunk of streamResult.textStream) {
      streamed += chunk;
    }
    assert.equal(streamed, "streamed live response");

    chronicle.signals.track({
      eventId,
      name: "self diagnostics - live node ok",
      signalType: "agent",
      sentiment: "POSITIVE",
      properties: { source: "live-node-test" },
    });

    await chronicle.flush();

    const traceResponse = await fetch(
      `${endpoint}/v1/events?${new URLSearchParams({
        org_id: orgId,
        source: "chronicle.sdk",
        topic: "traces",
        limit: "50",
      })}`
    );
    assert.equal(traceResponse.status, 200);
    const traces = (await traceResponse.json()) as Array<{ event: { payload: Record<string, unknown> } }>;
    const payloads = traces.map((item) => item.event.payload);
    assert.ok(payloads.some((payload) => payload.kind === "ai" && payload.event_id === eventId));
    const generatedTraceId = payloads.find((payload) => payload.kind === "ai" && payload.event_id === eventId)?.trace_id;
    assert.equal(typeof generatedTraceId, "string");
    assert.ok(
      payloads.some(
        (payload) =>
          payload.kind === "model" &&
          payload.name === "model step 0" &&
          (payload.attributes as Record<string, unknown> | undefined)?.finishReason === "tool-calls"
      )
    );
    assert.ok(
      payloads.some(
        (payload) =>
          payload.kind === "tool" &&
          payload.name === "lookupOrder" &&
          typeof payload.duration_ms === "number" &&
          (payload.attributes as Record<string, unknown> | undefined)?.result
      )
    );
    assert.ok(
      payloads.some(
        (payload) =>
          payload.kind === "ai" &&
          payload.event_id === `${eventId}_stream` &&
          typeof (payload.attributes as Record<string, unknown> | undefined)?.stream === "object"
      )
    );

    const traceTreeResponse = await fetch(`${endpoint}/v1/traces/${generatedTraceId}?${new URLSearchParams({ org_id: orgId })}`);
    assert.equal(traceTreeResponse.status, 200);
    const traceTree = (await traceTreeResponse.json()) as { spans: Array<{ kind: string; children: unknown[] }> };
    assert.ok(traceTree.spans.some((span) => span.kind === "ai" && span.children.length > 0));

    const signalResponse = await fetch(
      `${endpoint}/v1/events?${new URLSearchParams({
        org_id: orgId,
        source: "chronicle.sdk",
        topic: "signals",
        limit: "10",
      })}`
    );
    assert.equal(signalResponse.status, 200);
    const signals = (await signalResponse.json()) as Array<{ event: { payload: Record<string, unknown> } }>;
    assert.ok(signals.some((item) => item.event.payload.event_id === eventId));
  }
);
