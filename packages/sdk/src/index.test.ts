import assert from "node:assert/strict";
import { test } from "node:test";

import { createChronicleClient } from "./index";

test("flush sends events, identify calls, signals, and traces to Chronicle routes", async () => {
  const requests: Array<{ path: string; body: unknown }> = [];
  const fetchMock: typeof fetch = async (url, init) => {
    requests.push({
      path: new URL(url.toString()).pathname,
      body: JSON.parse(String(init?.body)),
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const client = createChronicleClient({
    writeKey: "test-key",
    endpoint: "http://localhost:8080",
    orgId: "org_test",
    fetch: fetchMock,
  });

  const eventId = client.ai.track({
    userId: "user_123",
    event: "support-chat",
    model: "mock-model",
    input: "hello",
    output: "world",
    properties: { channel: "web" },
    attachments: [{ type: "text", value: "context", role: "input" }],
  });

  client.users.identify({
    userId: "user_123",
    traits: { plan: "paid" },
  });
  client.signals.track({
    eventId,
    name: "thumbs_up",
    sentiment: "POSITIVE",
  });
  client.traces.track({
    traceId: "trace_test",
    eventId,
    spans: [
      {
        traceId: "trace_test",
        spanId: "span_root",
        name: "generateText",
        kind: "model",
        attributes: { model: "mock-model" },
      },
    ],
  });

  await client.flush();

  assert.deepEqual(
    requests.map((request) => request.path),
    [
      "/v1/events/batch",
      "/v1/users/identify",
      "/v1/signals/track",
      "/v1/traces/track",
      "/v1/traces/track",
    ]
  );

  const eventsBody = requests[0]?.body as Array<Record<string, unknown>>;
  assert.equal(eventsBody[0]?.org_id, "org_test");
  assert.equal(eventsBody[0]?.event_type, "ai.interaction");

  const traceBody = requests[3]?.body as { traces: Array<{ spans: unknown[] }> };
  assert.equal(traceBody.traces[0]?.spans.length, 1);

  const networkTraceBody = requests[4]?.body as {
    traces: Array<{ name: string; attributes: Record<string, unknown>; spans: Array<{ attributes: Record<string, unknown> }> }>;
  };
  assert.equal(networkTraceBody.traces[0]?.name, "chronicle.sdk.flush");
  assert.equal(networkTraceBody.traces[0]?.attributes.queue_size, 4);
  assert.ok(networkTraceBody.traces[0]?.spans.some((span) => span.attributes.path === "/v1/events/batch"));
  assert.equal(typeof networkTraceBody.traces[0]?.spans[0]?.attributes.payload_bytes, "number");
});
