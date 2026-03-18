import { createSync } from "nango";
import * as z from "zod";

const IntercomAuthorSchema = z.object({
  id: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

const IntercomAdminSchema = z.object({
  id: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

const IntercomConversationPartSchema = z.object({
  id: z.string(),
  part_type: z.string().nullable().optional(),
  created_at: z.number().nullable().optional(),
  updated_at: z.number().nullable().optional(),
  body: z.string().nullable().optional(),
  author: IntercomAuthorSchema.nullable().optional(),
  assigned_to: IntercomAdminSchema.nullable().optional(),
  raw: z.any().optional(),
});

const IntercomConversationSchema = z.object({
  id: z.string(),
  conversation_id: z.string(),
  state: z.string().nullable().optional(),
  created_at: z.number().nullable().optional(),
  updated_at: z.number().nullable().optional(),
  source: z
    .object({
      id: z.string().nullable().optional(),
      body: z.string().nullable().optional(),
      delivered_as: z.string().nullable().optional(),
      author: IntercomAuthorSchema.nullable().optional(),
      raw: z.any().optional(),
    })
    .nullable()
    .optional(),
  contact: z
    .object({
      id: z.string(),
      name: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      external_id: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  contacts: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        external_id: z.string().nullable().optional(),
      }),
    )
    .optional(),
  assignee: IntercomAdminSchema.nullable().optional(),
  conversation_parts: z.array(IntercomConversationPartSchema).optional(),
  raw: z.any(),
});

type IntercomConversationRecord = z.infer<typeof IntercomConversationSchema>;

type IntercomConversationListItem = {
  id: string;
  updated_at?: number | null;
};

type IntercomConversationDetail = {
  id: string;
  created_at?: number | null;
  updated_at?: number | null;
  state?: string | null;
  source?: {
    id?: string | null;
    body?: string | null;
    delivered_as?: string | null;
    author?: {
      id?: string | null;
      type?: string | null;
      name?: string | null;
      email?: string | null;
    } | null;
  } | null;
  contacts?: {
    contacts?: Array<{
      id: string;
      name?: string | null;
      email?: string | null;
      external_id?: string | null;
    }>;
  } | null;
  assignee?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
  } | null;
  conversation_parts?: {
    conversation_parts?: Array<{
      id?: string | null;
      part_type?: string | null;
      created_at?: number | null;
      updated_at?: number | null;
      body?: string | null;
      author?: {
        id?: string | null;
        type?: string | null;
        name?: string | null;
        email?: string | null;
      } | null;
      assigned_to?: {
        id?: string | null;
        name?: string | null;
        email?: string | null;
      } | null;
    }>;
  } | null;
};

function asUnixSeconds(value: Date | string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed =
    value instanceof Date ? value.getTime() : Date.parse(value);
  if (Number.isNaN(parsed)) return undefined;
  return Math.floor(parsed / 1000);
}

function nextCursorFromIntercomPage(response: any): string | undefined {
  return (
    response?.pages?.next?.starting_after ||
    response?.pages?.next?.cursor ||
    response?.next?.starting_after ||
    undefined
  );
}

function mapConversation(detail: IntercomConversationDetail): IntercomConversationRecord {
  const contacts = detail.contacts?.contacts ?? [];

  return {
    id: detail.id,
    conversation_id: detail.id,
    state: detail.state ?? null,
    created_at: detail.created_at ?? null,
    updated_at: detail.updated_at ?? null,
    source: detail.source
      ? {
          id: detail.source.id ?? null,
          body: detail.source.body ?? null,
          delivered_as: detail.source.delivered_as ?? null,
          author: detail.source.author ?? null,
          raw: detail.source,
        }
      : null,
    contact: contacts[0]
      ? {
          id: contacts[0].id,
          name: contacts[0].name ?? null,
          email: contacts[0].email ?? null,
          external_id: contacts[0].external_id ?? null,
        }
      : null,
    contacts: contacts.map((contact) => ({
      id: contact.id,
      name: contact.name ?? null,
      email: contact.email ?? null,
      external_id: contact.external_id ?? null,
    })),
    assignee: detail.assignee
      ? {
          id: detail.assignee.id ?? null,
          name: detail.assignee.name ?? null,
          email: detail.assignee.email ?? null,
        }
      : null,
    conversation_parts: (detail.conversation_parts?.conversation_parts ?? [])
      .filter((part): part is NonNullable<typeof part> => Boolean(part?.id))
      .map((part) => ({
        id: part.id as string,
        part_type: part.part_type ?? null,
        created_at: part.created_at ?? null,
        updated_at: part.updated_at ?? null,
        body: part.body ?? null,
        author: part.author ?? null,
        assigned_to: part.assigned_to ?? null,
        raw: part,
      })),
    raw: detail,
  };
}

export default createSync({
  description: "Fetch Intercom conversations with full backfill and incremental updates.",
  version: "1.0.0",
  endpoints: [{ method: "GET", path: "/conversations", group: "Conversations" }],
  frequency: "every hour",
  autoStart: true,
  syncType: "incremental",
  models: {
    IntercomConversation: IntercomConversationSchema,
  },

  exec: async (nango) => {
    await nango.log(`Starting Intercom sync. lastSyncDate=${nango.lastSyncDate?.toISOString?.() ?? "none"}`);

    await nango.setMergingStrategy(
      { strategy: "ignore_if_modified_after" },
      "IntercomConversation",
    );

    const checkpoint = asUnixSeconds(nango.lastSyncDate);
    let startingAfter: string | undefined;
    let shouldStop = false;

    while (!shouldStop) {
      const response = await nango.get<{
        conversations?: IntercomConversationListItem[];
        data?: IntercomConversationListItem[];
        pages?: any;
      }>({
        endpoint: "/conversations",
        params: {
          per_page: 50,
          starting_after: startingAfter,
        },
      });

      const conversations =
        response.data?.conversations || response.data?.data || [];

      await nango.log(`Fetched ${conversations.length} Intercom conversations in current page.`);

      if (!conversations.length) {
        break;
      }

      const batch: IntercomConversationRecord[] = [];

      for (const conversation of conversations) {
        if (
          checkpoint &&
          typeof conversation.updated_at === "number" &&
          conversation.updated_at <= checkpoint
        ) {
          shouldStop = true;
          break;
        }

        const detail = await nango.get<IntercomConversationDetail>({
          endpoint: `/conversations/${conversation.id}`,
        });

        batch.push(mapConversation(detail.data));
      }

      if (batch.length) {
        await nango.log(`Saving ${batch.length} Intercom conversations to Nango cache.`);
        await nango.batchSave(batch, "IntercomConversation");
      }

      startingAfter = nextCursorFromIntercomPage(response.data);
      if (!startingAfter) {
        break;
      }
    }
  },
});
