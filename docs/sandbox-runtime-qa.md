# Sandbox Runtime QA

Use this flow to verify the rebuilt sandbox runtime behavior in the current frontend-backed implementation.

## Replay Completion

1. Open `Customer Support Replay` from `/dashboard/sandbox`.
2. Press `Play`.
3. Watch the header badge move from `Applying changes` to `Playing 1x`.
4. Let playback run to the end of the seeded event history.
5. Confirm the badge changes to `Replay complete`.
6. Confirm the sandbox status badge changes to `paused`.
7. Confirm the timeline stops advancing and the existing event history remains browsable.

## Live Idle

1. Open `Stripe Event Filter` from `/dashboard/sandbox`.
2. Press `Live`.
3. Wait at least 2 seconds without ingesting new events.
4. Confirm the runtime badge changes to `Waiting for events`.
5. In a separate shell, post a new event:

```bash
curl -X POST "http://localhost:3000/api/sandbox/<sandbox-id>/ingest" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "stripe",
    "event_type": "invoice.paid",
    "payload": { "invoiceId": "in_test_123", "amount": 4200 }
  }'
```

6. Confirm the runtime badge returns to `Live`.
7. Confirm the new event appears in the timeline and animation resumes on the current graph.

## Mid-Stream Config Apply

1. Start either `Play` or `Live` in any sandbox that has at least one `event-source` root.
2. Open a node drawer and change a meaningful config value:
   Example: update an event source filter, change a filter rule, or change playback speed.
3. Confirm the header badge changes to `Saving graph`.
4. Confirm it then changes to `Applying changes`.
5. Confirm it settles back to `Playing <speed>x`, `Live`, or `Waiting for events` depending on the active mode.
6. Confirm old edge particles clear while changes are applying.
7. Confirm only the updated graph continues receiving new runtime activity after apply finishes.

## Save Error Recovery

1. Introduce a temporary failure in the sandbox update route or force a failed request in the browser.
2. Edit the graph.
3. Confirm the runtime badge changes to `Save failed`.
4. Confirm the inline `Retry Save` action appears.
5. Restore the route and press `Retry Save`.
6. Confirm the badge returns to `Saving graph`, then `Applying changes`, then the active runtime state.
