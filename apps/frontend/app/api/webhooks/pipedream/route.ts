import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { appendAuditLog } from "@/lib/audit-log";
import prisma from "@/lib/db";
import eventsManager from "@/lib/events-manager";

export const dynamic = "force-dynamic";

/**
 * Pipedream trigger event payload structure
 * Events from deployed triggers are sent to this endpoint
 */
interface PipedreamTriggerEvent {
  // Event metadata from Pipedream
  id?: string;
  timestamp?: string;
  deployment_id?: string;
  
  // The actual event data varies by trigger
  // Common fields across many triggers:
  [key: string]: unknown;
}

/**
 * Extract conversation/entity ID from various event payloads
 */
function extractEntityId(event: PipedreamTriggerEvent, provider: string): string {
  // Provider-specific extraction
  switch (provider) {
    case "slack":
      return (event.channel as string) || 
             (event.ts as string) || 
             `slack_${Date.now()}`;
    
    case "intercom":
      return (event.conversation_id as string) || 
             (event.id as string) || 
             `intercom_${Date.now()}`;
    
    case "stripe":
      return (event.id as string) || 
             (event.object as { id?: string })?.id || 
             `stripe_${Date.now()}`;
    
    case "hubspot":
      return (event.objectId as string) || 
             (event.id as string) || 
             `hubspot_${Date.now()}`;
    
    case "zendesk":
      return (event.ticket_id as string) || 
             (event.id as string) || 
             `zendesk_${Date.now()}`;
    
    default:
      return (event.id as string) || `${provider}_${Date.now()}`;
  }
}

/**
 * Extract actor information from event payload
 */
function extractActor(
  event: PipedreamTriggerEvent, 
  provider: string
): { type: "customer" | "agent" | "system"; id: string; name?: string } {
  switch (provider) {
    case "slack": {
      const userId = event.user as string;
      const userName = event.user_name as string || event.username as string;
      return userId 
        ? { type: "agent", id: userId, name: userName }
        : { type: "system", id: "slack" };
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
    
    case "stripe": {
      // Stripe events are typically system-generated
      return { type: "system", id: "stripe" };
    }
    
    default:
      return { type: "system", id: provider };
  }
}

/**
 * Map provider and event type to a normalized event type
 */
function normalizeEventType(provider: string, eventType?: string): string {
  if (!eventType) {
    return `${provider}.event`;
  }
  
  // Already namespaced
  if (eventType.includes(".")) {
    return eventType;
  }
  
  return `${provider}.${eventType}`;
}

/**
 * POST /api/webhooks/pipedream
 * 
 * Unified webhook endpoint for all Pipedream trigger events.
 * Events are normalized and forwarded to the Events Manager.
 */
export async function POST(request: NextRequest) {
  let event: PipedreamTriggerEvent;

  try {
    event = await request.json();
  } catch {
    console.error("Failed to parse Pipedream webhook payload");
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const headerDeploy = request.headers.get("x-pd-deployment-id") ?? request.headers.get("x-pd-emitter-id");
  const bodyDeploy = (event.deployment_id ?? event.deploymentId ?? (event as Record<string, unknown>).emitter_id) as string | undefined;
  const meta = event._metadata as Record<string, unknown> | undefined;
  const metaDeploy = (meta?.deployment_id ?? meta?.deploymentId ?? meta?.emitter_id) as string | undefined;
  const emitterObj = (event as Record<string, unknown>).emitter as { id?: string } | undefined;
  const emitterDeploy = emitterObj?.id;
  const queryTenantId = request.nextUrl.searchParams.get("tenant_id");
  const deploymentId = headerDeploy || bodyDeploy || metaDeploy || emitterDeploy || undefined;

  const innerEvent = (event as Record<string, unknown>).event as PipedreamTriggerEvent | undefined;
  const eventToProcess: PipedreamTriggerEvent = innerEvent ?? event;

  console.log(`Received Pipedream event: deployment_id=${deploymentId || "unknown"}`);

  // Look up the trigger in our database to get tenant and provider info
  let tenantId: string | null = null;
  let provider: string = "unknown";

  if (deploymentId) {
    const trigger = await prisma.pipedreamTrigger.findUnique({
      where: { deploymentId },
      include: {
        connection: {
          select: {
            provider: true,
          },
        },
      },
    });

    if (trigger) {
      tenantId = trigger.tenantId;
      provider = trigger.connection.provider;
    }
  }

  // Fallback: Pipedream often doesn't send deployment_id; use tenant_id from URL (set at deploy)
  if (!tenantId && queryTenantId) {
    const exists = await prisma.tenant.findUnique({
      where: { id: queryTenantId },
    });
    if (exists) {
      tenantId = queryTenantId;
    }
  }

  // If we can't identify the tenant, we can still log the event
  // but we won't be able to associate it with a specific tenant
  if (!tenantId) {
    console.warn("Could not identify tenant for Pipedream event");
  }

  // Derive provider from event structure when not from trigger lookup
  const ev = eventToProcess;
  if (provider === "unknown") {
    if (ev.conversation_parts && (ev.source as Record<string, unknown>)?.author) {
      provider = "intercom";
    } else if (ev.type && typeof ev.type === "string") {
      const parts = ev.type.split(".");
      if (parts.length > 0) provider = parts[0];
    }
  }

  // Generate event identifiers (use eventToProcess for payload fields)
  const eventId = (ev.id as string) || 
                  (ev.event_id as string) || 
                  `pd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const sourceEventId = `pipedream_${eventId}`;
  
  // Extract entity/conversation ID
  const entityId = extractEntityId(ev, provider);
  
  // Extract actor information
  const actor = extractActor(ev, provider);
  
  // Determine event type
  const rawEventType = (ev.type as string) || 
                       (ev.event as string) || 
                       (ev.topic as string);
  const eventType = normalizeEventType(provider, rawEventType);

  // Get timestamp - Events Manager expects RFC 3339 string (not Unix integer)
  // Intercom uses created_at (unix) or statistics.last_contact_reply_at
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
      contains_pii: true, // Assume all events may contain PII
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

    // Still acknowledge the webhook to prevent retries
    return NextResponse.json({
      received: true,
      error: error instanceof Error ? error.message : "Failed to ingest event",
      tenant_id: tenantId,
    });
  }
}

/**
 * HEAD /api/webhooks/pipedream
 * 
 * Health check endpoint for webhook verification
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

/**
 * GET /api/webhooks/pipedream
 * 
 * Verification endpoint - some services send GET requests to verify webhooks
 */
export async function GET(request: NextRequest) {
  // Handle any verification challenges
  const challenge = request.nextUrl.searchParams.get("challenge");
  if (challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({
    status: "ok",
    endpoint: "Pipedream webhook receiver",
    timestamp: new Date().toISOString(),
  });
}
