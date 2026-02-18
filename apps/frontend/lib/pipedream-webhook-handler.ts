import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { appendAuditLog } from "@/lib/audit-log";
import prisma from "@/lib/db";
import eventsManager from "@/lib/events-manager";

export interface PipedreamTriggerEvent {
  id?: string;
  timestamp?: string;
  deployment_id?: string;
  [key: string]: unknown;
}

function extractEntityId(event: PipedreamTriggerEvent, provider: string): string {
  switch (provider) {
    case "slack":
      return (event.channel as string) || (event.ts as string) || `slack_${Date.now()}`;
    case "intercom":
      return (event.conversation_id as string) || (event.id as string) || `intercom_${Date.now()}`;
    case "stripe":
      return (event.id as string) || (event.object as { id?: string })?.id || `stripe_${Date.now()}`;
    case "hubspot":
      return (event.objectId as string) || (event.id as string) || `hubspot_${Date.now()}`;
    case "zendesk":
      return (event.ticket_id as string) || (event.id as string) || `zendesk_${Date.now()}`;
    default:
      return (event.id as string) || `${provider}_${Date.now()}`;
  }
}

function extractActor(
  event: PipedreamTriggerEvent,
  provider: string
): { type: "customer" | "agent" | "system"; id: string; name?: string } {
  switch (provider) {
    case "slack": {
      const userId = event.user as string;
      const userName = (event.user_name as string) || (event.username as string);
      return userId ? { type: "agent", id: userId, name: userName } : { type: "system", id: "slack" };
    }
    case "intercom": {
      const author =
        (event.author as { type?: string; id?: string; name?: string }) ??
        (event.source as { author?: { type?: string; id?: string; name?: string } })?.author;
      if (author) {
        const isCustomer = author.type === "user" || author.type === "lead";
        return {
          type: isCustomer ? "customer" : "agent",
          id: author.id || "unknown",
          name: author.name ?? undefined,
        };
      }
      return { type: "system", id: "intercom" };
    }
    case "stripe":
      return { type: "system", id: "stripe" };
    default:
      return { type: "system", id: provider };
  }
}

function normalizeEventType(provider: string, eventType?: string): string {
  if (!eventType) return `${provider}.event`;
  if (eventType.includes(".")) return eventType;
  return `${provider}.${eventType}`;
}

export interface HandleWebhookOptions {
  /** When set (e.g. from path /api/webhooks/pipedream/:tenantId), use this tenant and skip query/header lookup */
  tenantIdFromPath?: string;
}

export async function handlePipedreamWebhookPost(
  request: NextRequest,
  options: HandleWebhookOptions = {}
): Promise<NextResponse> {
  let event: PipedreamTriggerEvent;

  try {
    event = await request.json();
  } catch {
    console.error("Failed to parse Pipedream webhook payload");
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { tenantIdFromPath } = options;

  const headerDeploy = request.headers.get("x-pd-deployment-id") ?? request.headers.get("x-pd-emitter-id");
  const bodyDeploy = (event.deployment_id ?? event.deploymentId ?? (event as Record<string, unknown>).emitter_id) as string | undefined;
  const meta = event._metadata as Record<string, unknown> | undefined;
  const metaDeploy = (meta?.deployment_id ?? meta?.deploymentId ?? meta?.emitter_id) as string | undefined;
  const emitterObj = (event as Record<string, unknown>).emitter as { id?: string } | undefined;
  const emitterDeploy = emitterObj?.id;
  const deploymentId = headerDeploy || bodyDeploy || metaDeploy || emitterDeploy || undefined;

  const innerEvent = (event as Record<string, unknown>).event as PipedreamTriggerEvent | undefined;
  const eventToProcess: PipedreamTriggerEvent = innerEvent ?? event;

  let tenantId: string | null = null;
  let provider: string = "unknown";

  if (tenantIdFromPath) {
    const exists = await prisma.tenant.findUnique({ where: { id: tenantIdFromPath } });
    if (exists) tenantId = tenantIdFromPath;
    else return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  } else if (deploymentId) {
    const trigger = await prisma.pipedreamTrigger.findUnique({
      where: { deploymentId },
      include: { connection: { select: { provider: true } } },
    });
    if (trigger) {
      tenantId = trigger.tenantId;
      provider = trigger.connection.provider;
    }
  }

  if (!tenantId && !tenantIdFromPath) {
    const tenantFromNextUrl = request.nextUrl.searchParams.get("tenant_id");
    const tenantFromRequestUrl = request.url ? new URL(request.url).searchParams.get("tenant_id") : null;
    const queryTenantId = tenantFromNextUrl ?? tenantFromRequestUrl;
    if (queryTenantId) {
      const exists = await prisma.tenant.findUnique({ where: { id: queryTenantId } });
      if (exists) tenantId = queryTenantId;
    }
  }

  if (!tenantId) {
    console.warn("Could not identify tenant for Pipedream event");
  }

  const ev = eventToProcess;
  if (provider === "unknown") {
    if (ev.conversation_parts && (ev.source as Record<string, unknown>)?.author) provider = "intercom";
    else if (ev.type && typeof ev.type === "string") {
      const parts = ev.type.split(".");
      if (parts.length > 0) provider = parts[0];
    }
  }

  const eventId =
    (ev.id as string) ||
    (ev.event_id as string) ||
    `pd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const sourceEventId = `pipedream_${eventId}`;
  const entityId = extractEntityId(ev, provider);
  const actor = extractActor(ev, provider);
  const rawEventType = (ev.type as string) || (ev.event as string) || (ev.topic as string);
  const eventType = normalizeEventType(provider, rawEventType);

  const rawTs = ev.timestamp ?? ev.created_at ?? (ev.statistics as { last_contact_reply_at?: number })?.last_contact_reply_at;
  let occurredAt: string;
  if (typeof rawTs === "number") {
    const ms = rawTs < 1e12 ? rawTs * 1000 : rawTs;
    occurredAt = new Date(ms).toISOString();
  } else if (typeof rawTs === "string") {
    occurredAt = rawTs;
  } else {
    occurredAt = new Date().toISOString();
  }

  try {
    const result = await eventsManager.ingestEvent({
      source: provider,
      source_event_id: sourceEventId,
      event_type: eventType,
      conversation_id: entityId,
      actor_type: actor.type,
      actor_id: actor.id,
      actor_name: actor.name,
      payload: {
        ...eventToProcess,
        _pipedream: {
          deployment_id: deploymentId,
          received_at: new Date().toISOString(),
        },
      },
      contains_pii: true,
      occurred_at: occurredAt,
      tenant_id: tenantId || undefined,
    });

    console.log(`Event ingested: ${result.event_id}, type=${eventType}, tenant=${tenantId || "unknown"}`);

    if (tenantId && result.ingested) {
      const invocationId = `inv_${result.event_id}`;
      const eventSnapshot = {
        ...eventToProcess,
        _pipedream: {
          deployment_id: deploymentId,
          received_at: new Date().toISOString(),
        },
      };
      try {
        const run = await prisma.run.create({
          data: {
            tenantId,
            eventId: result.event_id,
            invocationId,
            mode: "shadow",
            status: "pending",
            eventSnapshot: eventSnapshot as Prisma.InputJsonValue,
            workflowId: null,
          },
        });
        await appendAuditLog({
          tenantId,
          runId: run.id,
          eventId: result.event_id,
          invocationId,
          action: "run_created",
          payload: { mode: "shadow", source: "webhook" },
        });
      } catch (err) {
        console.error("Webhook: failed to create run", err);
      }
    }

    return NextResponse.json({
      received: true,
      event_id: result.event_id,
      tenant_id: tenantId,
      provider,
      event_type: eventType,
    });
  } catch (error) {
    console.error("Failed to ingest Pipedream event:", error);
    return NextResponse.json(
      {
        received: true,
        error: error instanceof Error ? error.message : "Failed to ingest event",
        tenant_id: tenantId,
      },
      { status: 200 }
    );
  }
}
