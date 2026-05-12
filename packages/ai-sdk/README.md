# `@chroniclelabs/ai-sdk`

Chronicle Labs capture wrapper for the Vercel AI SDK.

```ts
import * as ai from "ai";
import { createChronicleAISDK, eventMetadata } from "@chroniclelabs/ai-sdk";

const chronicle = createChronicleAISDK({
  writeKey: process.env.CHRONICLE_WRITE_KEY!,
});

const { generateText } = chronicle.wrap(ai, {
  context: {
    userId: "user_123",
    eventName: "support-chat",
  },
});

await generateText({
  model,
  prompt: "Help this customer",
  experimental_telemetry: {
    isEnabled: true,
    metadata: eventMetadata({
      convoId: "conversation_123",
      properties: { source: "support" },
    }),
  },
});

await chronicle.flush();
```
