import { createSync } from "nango";
import * as z from "zod";

const SlackReactionSchema = z.object({
  name: z.string(),
  count: z.number().optional(),
  users: z.array(z.string()).optional(),
});

const SlackMessageSchema = z.object({
  id: z.string(),
  channel_id: z.string(),
  channel_name: z.string().nullable().optional(),
  user_id: z.string().nullable().optional(),
  user_name: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  ts: z.string(),
  thread_ts: z.string().nullable().optional(),
  event_type: z.string(),
  reactions: z.array(SlackReactionSchema).optional(),
  raw: z.any(),
});

const SlackCheckpointSchema = z.object({
  channels: z.record(z.string()).default({}),
  threads: z.record(z.record(z.string())).default({}),
});

type SlackMessageRecord = z.infer<typeof SlackMessageSchema>;
type SlackCheckpoint = z.infer<typeof SlackCheckpointSchema>;

type SlackConversation = {
  id: string;
  name?: string | null;
  is_archived?: boolean;
};

type SlackUser = {
  id: string;
  name?: string | null;
  real_name?: string | null;
  profile?: {
    display_name?: string | null;
    display_name_normalized?: string | null;
    real_name?: string | null;
    real_name_normalized?: string | null;
  } | null;
};

type SlackResponse<T> = {
  ok: boolean;
  error?: string;
  response_metadata?: {
    next_cursor?: string;
  };
} & T;

type SlackHistoryMessage = {
  ts?: string;
  thread_ts?: string;
  text?: string | null;
  user?: string | null;
  bot_id?: string | null;
  username?: string | null;
  subtype?: string | null;
  reply_count?: number;
  reactions?: Array<{
    name?: string;
    count?: number;
    users?: string[];
  }>;
  bot_profile?: {
    name?: string | null;
  } | null;
  [key: string]: any;
};

type SlackConnectionWithCredentials = {
  credentials?: {
    raw?: {
      authed_user?: {
        access_token?: string;
      };
    };
  };
};

function nextCursor<T>(response: SlackResponse<T>): string | undefined {
  const cursor = response.response_metadata?.next_cursor;
  return cursor && cursor.length > 0 ? cursor : undefined;
}

function normalizeUserName(user?: SlackUser | null): string | null {
  if (!user) return null;
  return (
    user.profile?.display_name ||
    user.profile?.display_name_normalized ||
    user.real_name ||
    user.profile?.real_name ||
    user.profile?.real_name_normalized ||
    user.name ||
    null
  );
}

function maxSlackTs(current?: string, candidate?: string | null): string | undefined {
  if (!candidate) return current;
  if (!current) return candidate;
  return Number(candidate) > Number(current) ? candidate : current;
}

function topLevelThreadTs(message: SlackHistoryMessage): string | undefined {
  const ts = message.ts;
  if (!ts) return undefined;
  const threadTs = message.thread_ts;
  if (!threadTs || threadTs === ts) {
    return ts;
  }
  return undefined;
}

function mapSlackMessage(
  message: SlackHistoryMessage,
  channel: SlackConversation,
  userMap: Map<string, string>,
): SlackMessageRecord | null {
  const ts = message.ts;
  if (!ts) return null;

  const threadTs = message.thread_ts ?? ts;
  const isReply = threadTs !== ts;
  const userId = message.user ?? message.bot_id ?? null;
  const userName =
    (userId ? userMap.get(userId) : null) ||
    message.username ||
    message.bot_profile?.name ||
    null;

  return {
    id: isReply ? `${channel.id}:${threadTs}:${ts}` : `${channel.id}:${ts}`,
    channel_id: channel.id,
    channel_name: channel.name ?? null,
    user_id: userId,
    user_name: userName,
    text: message.text ?? null,
    ts,
    thread_ts: threadTs,
    event_type: isReply ? "thread_reply" : "message",
    reactions: (message.reactions ?? [])
      .filter((reaction): reaction is NonNullable<typeof reaction> => Boolean(reaction?.name))
      .map((reaction) => ({
        name: reaction.name as string,
        count: reaction.count,
        users: reaction.users ?? [],
      })),
    raw: message,
  };
}

async function slackUserGet<T>(
  endpoint: string,
  token: string,
  params: Record<string, string | number | undefined>,
): Promise<SlackResponse<T>> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }

  const fetchFn = (globalThis as any).fetch as (
    input: string,
    init?: { headers?: Record<string, string> },
  ) => Promise<{ ok: boolean; json(): Promise<SlackResponse<T>> }>;

  const response = await fetchFn(`https://slack.com/api${endpoint}?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(
      `Slack API request failed for ${endpoint}: ${data.error || "unknown_error"}`,
    );
  }

  return data;
}

async function fetchConversations(nango: any): Promise<SlackConversation[]> {
  const conversations: SlackConversation[] = [];
  let cursor: string | undefined;

  do {
    const response = (await nango.get({
      endpoint: "/conversations.list",
      params: {
        types: "public_channel,private_channel",
        exclude_archived: true,
        limit: 200,
        cursor,
      },
    })) as { data: SlackResponse<{ channels: SlackConversation[] }> };

    if (!response.data?.ok) {
      throw new Error(`Slack conversations.list failed: ${response.data?.error || "unknown_error"}`);
    }

    conversations.push(
      ...(response.data.channels ?? []).filter(
        (channel: SlackConversation) => !channel.is_archived,
      ),
    );
    cursor = nextCursor(response.data);
  } while (cursor);

  return conversations;
}

async function fetchUsers(nango: any): Promise<Map<string, string>> {
  const users = new Map<string, string>();
  let cursor: string | undefined;

  do {
    const response = (await nango.get({
      endpoint: "/users.list",
      params: {
        limit: 200,
        cursor,
      },
    })) as { data: SlackResponse<{ members: SlackUser[] }> };

    if (!response.data?.ok) {
      throw new Error(`Slack users.list failed: ${response.data?.error || "unknown_error"}`);
    }

    for (const member of response.data.members ?? []) {
      if (!member.id) continue;
      users.set(member.id, normalizeUserName(member) ?? member.id);
    }

    cursor = nextCursor(response.data);
  } while (cursor);

  return users;
}

async function fetchChannelMessages(
  nango: any,
  channelId: string,
  oldest?: string,
): Promise<SlackHistoryMessage[]> {
  const messages: SlackHistoryMessage[] = [];
  let cursor: string | undefined;

  do {
    const response = (await nango.get({
      endpoint: "/conversations.history",
      params: {
        channel: channelId,
        oldest,
        inclusive: oldest ? false : undefined,
        limit: 200,
        cursor,
      },
    })) as { data: SlackResponse<{ messages: SlackHistoryMessage[] }> };

    if (!response.data?.ok) {
      throw new Error(
        `Slack conversations.history failed for channel ${channelId}: ${response.data?.error || "unknown_error"}`,
      );
    }

    messages.push(...(response.data.messages ?? []));
    cursor = nextCursor(response.data);
  } while (cursor);

  return messages;
}

async function fetchThreadReplies(
  nango: any,
  channelId: string,
  threadTs: string,
  oldest?: string,
  userToken?: string | null,
): Promise<SlackHistoryMessage[]> {
  const replies: SlackHistoryMessage[] = [];
  let cursor: string | undefined;

  do {
    const response = userToken
      ? await slackUserGet<{ messages: SlackHistoryMessage[] }>(
          "/conversations.replies",
          userToken,
          {
            channel: channelId,
            ts: threadTs,
            oldest,
            inclusive: oldest ? "false" : undefined,
            limit: 200,
            cursor,
          },
        )
      : (
          await nango.get({
            endpoint: "/conversations.replies",
            params: {
              channel: channelId,
              ts: threadTs,
              oldest,
              inclusive: oldest ? false : undefined,
              limit: 200,
              cursor,
            },
          })
        ).data as SlackResponse<{ messages: SlackHistoryMessage[] }>;

    if (!response.ok) {
      throw new Error(
        `Slack conversations.replies failed for thread ${threadTs}: ${response.error || "unknown_error"}`,
      );
    }

    replies.push(...(response.messages ?? []));
    cursor = nextCursor(response);
  } while (cursor);

  return replies.filter((message) => message.ts && message.ts !== threadTs);
}

export default createSync({
  description: "Fetch Slack channel messages, thread replies, and reactions with historical backfill.",
  version: "1.0.0",
  frequency: "every hour",
  autoStart: false,
  syncType: "incremental",
  checkpoint: SlackCheckpointSchema,
  models: {
    SlackMessage: SlackMessageSchema,
  },

  exec: async (nango: any) => {
    await nango.log(
      `Starting Slack sync. lastSyncDate=${nango.lastSyncDate?.toISOString?.() ?? "none"}`,
    );

    await nango.setMergingStrategy(
      { strategy: "ignore_if_modified_after" },
      "SlackMessage",
    );

    const connection = (await nango.getConnection()) as SlackConnectionWithCredentials;
    const userToken =
      connection.credentials?.raw?.authed_user?.access_token ?? null;
    const checkpoint = ((await nango.getCheckpoint()) as SlackCheckpoint | null) ?? {
      channels: {},
      threads: {},
    };

    const channels = await fetchConversations(nango);
    const userMap = await fetchUsers(nango);

    await nango.log(`Fetched ${channels.length} Slack channels for sync.`);

    for (const channel of channels) {
      const channelCheckpoint = checkpoint.channels[channel.id];
      const existingThreads = checkpoint.threads[channel.id] ?? {};
      const knownThreads = { ...existingThreads };
      const channelMessages = await fetchChannelMessages(
        nango,
        channel.id,
        channelCheckpoint,
      );

      const batch: SlackMessageRecord[] = [];
      let latestChannelTs = channelCheckpoint;

      for (const message of channelMessages) {
        const mapped = mapSlackMessage(message, channel, userMap);
        if (mapped) {
          batch.push(mapped);
          const nextChannelTs = maxSlackTs(latestChannelTs, mapped.ts);
          if (nextChannelTs) {
            latestChannelTs = nextChannelTs;
          }
        }

        const rootThreadTs = topLevelThreadTs(message);
        if (rootThreadTs) {
          const nextThreadTs = maxSlackTs(knownThreads[rootThreadTs], rootThreadTs);
          if (nextThreadTs) {
            knownThreads[rootThreadTs] = nextThreadTs;
          }
        }
      }

      const threadEntries = Object.entries(knownThreads).sort(([left], [right]) =>
        Number(left) - Number(right),
      );

      for (const [threadTs, threadCheckpoint] of threadEntries) {
        const replies = await fetchThreadReplies(
          nango,
          channel.id,
          threadTs,
          threadCheckpoint,
          userToken,
        );

        for (const reply of replies) {
          const mapped = mapSlackMessage(reply, channel, userMap);
          if (!mapped) continue;
          batch.push(mapped);
          const nextThreadTs = maxSlackTs(knownThreads[threadTs], mapped.ts);
          if (nextThreadTs) {
            knownThreads[threadTs] = nextThreadTs;
          }
          const nextChannelTs = maxSlackTs(latestChannelTs, mapped.ts);
          if (nextChannelTs) {
            latestChannelTs = nextChannelTs;
          }
        }
      }

      if (batch.length) {
        await nango.log(
          `Saving ${batch.length} Slack records for channel ${channel.name ?? channel.id}.`,
        );
        await nango.batchSave(batch, "SlackMessage");
      }

      if (latestChannelTs) {
        checkpoint.channels[channel.id] = latestChannelTs;
      }
      checkpoint.threads[channel.id] = knownThreads;
      await nango.saveCheckpoint(checkpoint);
    }
  },
});
