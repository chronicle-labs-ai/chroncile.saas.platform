# `@chroniclelabs/sdk`

Chronicle Labs event capture SDK for browser and Node.js runtimes.

```ts
import { createChronicleClient } from "@chroniclelabs/sdk";

const chronicle = createChronicleClient({
  writeKey: process.env.CHRONICLE_WRITE_KEY!,
  endpoint: "https://api.chronicle.dev",
});

const eventId = chronicle.ai.track({
  userId: "user_123",
  event: "support-chat",
  model: "gpt-4o",
  input: "Where is my order?",
  output: "Your order ships tomorrow.",
});

chronicle.signals.track({
  eventId,
  name: "thumbs_up",
  sentiment: "POSITIVE",
});

await chronicle.flush();
```
