import { NextResponse } from "next/server";
import { prisma } from "@/backend/data/db";
import { backendFetch } from "@/backend/integrations/backend-client";
import { auth } from "@/backend/auth/auth";

export async function PUT(
  req: Request,
  {
    params,
  }: { params: Promise<{ envId: string; tenantId: string; flagKey: string }> }
) {
  const { envId, tenantId, flagKey } = await params;
  const env = await prisma.environment.findUnique({ where: { id: envId } });
  if (!env?.flyAppUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { enabled: boolean; reason?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const session = await auth();
  const actor = session?.user?.email ?? "env-manager";

  try {
    const res = await backendFetch(
      env.flyAppUrl,
      `/api/platform/admin/tenants/${tenantId}/feature-flags/${flagKey}`,
      {
        method: "PUT",
        headers: { "x-admin-actor": actor },
        body: JSON.stringify({
          enabled: body.enabled,
          reason: body.reason ?? null,
        }),
      },
      env.serviceSecret
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error ?? `Backend returned ${res.status}` },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  {
    params,
  }: { params: Promise<{ envId: string; tenantId: string; flagKey: string }> }
) {
  const { envId, tenantId, flagKey } = await params;
  const env = await prisma.environment.findUnique({ where: { id: envId } });
  if (!env?.flyAppUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  const actor = session?.user?.email ?? "env-manager";

  try {
    const res = await backendFetch(
      env.flyAppUrl,
      `/api/platform/admin/tenants/${tenantId}/feature-flags/${flagKey}`,
      {
        method: "DELETE",
        headers: { "x-admin-actor": actor },
      },
      env.serviceSecret
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error ?? `Backend returned ${res.status}` },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
