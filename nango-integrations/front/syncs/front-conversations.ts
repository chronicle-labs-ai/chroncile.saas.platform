import { createSync } from "nango";
import * as z from "zod";

const FrontAuthorSchema = z.object({
  id: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
});

const FrontMessageSchema = z.object({
  id: z.string(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  is_inbound: z.boolean().optional(),
  is_comment: z.boolean().optional(),
  body: z.string().nullable().optional(),
  body_text: z.string().nullable().optional(),
  author: FrontAuthorSchema.nullable().optional(),
  raw: z.any().optional(),
});

const FrontConversationSchema = z.object({
  id: z.string(),
  conversation_id: z.string(),
  subject: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  inbox: z
    .object({
      id: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  assignee: FrontAuthorSchema.nullable().optional(),
  contacts: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().nullable().optional(),
        handle: z.string().nullable().optional(),
      }),
    )
    .optional(),
  tags: z
    .array(
      z.object({
        id: z.string().nullable().optional(),
        name: z.string().nullable().optional(),
      }),
    )
    .optional(),
  messages: z.array(FrontMessageSchema).optional(),
  raw: z.any(),
});

type FrontConversationRecord = z.infer<typeof FrontConversationSchema>;

type FrontConversation = {
  id: string;
  subject?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  assignee?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    type?: string | null;
  } | null;
  inbox?: {
    id?: string | null;
    name?: string | null;
  } | null;
  recipient?: {
    handle?: string | null;
    contact?: {
      id?: string | null;
      name?: string | null;
    };
  } | null;
  tags?: Array<{ id?: string | null; name?: string | null }> | null;
};

function asFrontTimestamp(value: Date | string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed =
    value instanceof Date ? value.getTime() : Date.parse(value);
  if (Number.isNaN(parsed)) return undefined;
  return Math.floor(parsed / 1000);
}

function nextFrontPage(data: any): string | undefined {
  return (
    data?._pagination?.next ||
    data?._pagination?.next_page ||
    data?._links?.next ||
    undefined
  );
}

async function fetchFrontMessages(nango: any, conversationId: string) {
  let endpoint = `/conversations/${conversationId}/messages`;
  const messages: any[] = [];

  while (endpoint) {
    const response = await nango.get<any>({ endpoint });
    const items = response.data?._results || response.data?.results || [];
    messages.push(...items);
    endpoint = nextFrontPage(response.data) || "";
  }

  return messages;
}

function mapFrontConversation(
  conversation: FrontConversation,
  messages: any[],
): FrontConversationRecord {
  const contact =
    conversation.recipient?.contact?.id || conversation.recipient?.handle
      ? [
          {
            id:
              conversation.recipient?.contact?.id ||
              conversation.recipient?.handle ||
              "front-contact",
            name: conversation.recipient?.contact?.name ?? null,
            handle: conversation.recipient?.handle ?? null,
          },
        ]
      : [];

  return {
    id: conversation.id,
    conversation_id: conversation.id,
    subject: conversation.subject ?? null,
    status: conversation.status ?? null,
    created_at: conversation.created_at ?? null,
    updated_at: conversation.updated_at ?? null,
    inbox: conversation.inbox
      ? {
          id: conversation.inbox.id ?? null,
          name: conversation.inbox.name ?? null,
        }
      : null,
    assignee: conversation.assignee
      ? {
          id: conversation.assignee.id ?? null,
          name: conversation.assignee.name ?? null,
          email: conversation.assignee.email ?? null,
          type: conversation.assignee.type ?? null,
        }
      : null,
    contacts: contact,
    tags: (conversation.tags ?? []).map((tag) => ({
      id: tag.id ?? null,
      name: tag.name ?? null,
    })),
    messages: messages
      .filter((message) => Boolean(message?.id))
      .map((message) => ({
        id: message.id,
        created_at: message.created_at ?? null,
        updated_at: message.updated_at ?? null,
        type: message.type ?? null,
        is_inbound: Boolean(message.is_inbound ?? message.isInbound),
        is_comment:
          Boolean(message.type === "comment") ||
          Boolean(message.is_comment ?? message.isComment),
        body:
          message.text ||
          message.body ||
          message.content ||
          message.plain_text ||
          null,
        body_text:
          message.text ||
          message.plain_text ||
          message.body ||
          message.content ||
          null,
        author: message.author
          ? {
              id: message.author.id ?? null,
              name: message.author.name ?? null,
              email: message.author.email ?? null,
              type: message.author.type ?? null,
            }
          : null,
        raw: message,
      })),
    raw: conversation,
  };
}

export default createSync({
  description: "Fetch Front conversations, messages, comments, and assignees.",
  version: "1.0.0",
  endpoints: [{ method: "GET", path: "/conversations", group: "Conversations" }],
  frequency: "every hour",
  autoStart: true,
  syncType: "incremental",
  models: {
    FrontConversation: FrontConversationSchema,
  },

  exec: async (nango) => {
    await nango.log(`Starting Front sync. lastSyncDate=${nango.lastSyncDate?.toISOString?.() ?? "none"}`);

    await nango.setMergingStrategy(
      { strategy: "ignore_if_modified_after" },
      "FrontConversation",
    );

    let endpoint = "/conversations";
    const checkpoint = asFrontTimestamp(nango.lastSyncDate);

    while (endpoint) {
      const response = await nango.get<any>({
        endpoint,
        params: endpoint === "/conversations" && checkpoint
          ? { "q[updated_after]": checkpoint, limit: 50 }
          : endpoint === "/conversations"
            ? { limit: 50 }
            : undefined,
      });

      const conversations: FrontConversation[] =
        response.data?._results || response.data?.results || [];

      await nango.log(`Fetched ${conversations.length} Front conversations in current page.`);

      if (!conversations.length) {
        break;
      }

      const batch: FrontConversationRecord[] = [];

      for (const conversation of conversations) {
        const messages = await fetchFrontMessages(nango, conversation.id);
        batch.push(mapFrontConversation(conversation, messages));
      }

      if (batch.length) {
        await nango.log(`Saving ${batch.length} Front conversations to Nango cache.`);
        await nango.batchSave(batch, "FrontConversation");
      }

      endpoint = nextFrontPage(response.data) || "";
    }
  },
});
