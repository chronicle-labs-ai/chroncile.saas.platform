import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { backendFetch } from "@/lib/backend-client";
import { sendOrgInviteEmail } from "@/lib/email";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ envId: string; tenantId: string }> }
) {
  const { envId, tenantId } = await params;
  const env = await prisma.environment.findUnique({ where: { id: envId } });
  if (!env?.flyAppUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { email: string; name?: string; sendEmail?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const res = await backendFetch(
      env.flyAppUrl,
      `/api/platform/admin/tenants/${tenantId}/invite`,
      { method: "POST", body: JSON.stringify({ email: body.email, name: body.name }) },
      env.serviceSecret
    );

    const text = await res.text();
    let data: Record<string, unknown>;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json(
        { error: `Backend returned invalid JSON (HTTP ${res.status}): ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    if (!res.ok) {
      return NextResponse.json({ error: (data.error as string) ?? `Invite failed (HTTP ${res.status})` }, { status: res.status });
    }

    let emailSent = false;
    let emailError: string | null = null;

    if (body.sendEmail !== false && data.loginUrl) {
      try {
        const tenantRes = await backendFetch(
          env.flyAppUrl,
          "/api/platform/admin/tenants",
          undefined,
          env.serviceSecret
        );
        let tenantsData: Record<string, unknown> | null = null;
        if (tenantRes.ok) {
          const t = await tenantRes.text();
          try { tenantsData = t ? JSON.parse(t) : null; } catch { /* ignore */ }
        }
        const tenant = tenantsData?.tenants?.find((t: { id: string }) => t.id === tenantId);
        const orgName = tenant?.name ?? "your organization";

        await sendOrgInviteEmail({
          to: body.email,
          orgName,
          invitedByName: "Chronicle Labs Admin",
          loginUrl: data.loginUrl,
          environmentName: env.name,
        });
        emailSent = true;
      } catch (err) {
        emailError = err instanceof Error ? err.message : String(err);
      }
    }

    return NextResponse.json({ ...data, emailSent, emailError });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
