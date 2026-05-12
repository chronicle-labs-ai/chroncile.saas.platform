import { NextResponse } from "next/server";
import { prisma } from "@/backend/data/db";
import { backendFetch } from "@/backend/integrations/backend-client";
import { sendOrgInviteEmail } from "@/backend/integrations/email";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ envId: string }> }
) {
  const { envId } = await params;
  const env = await prisma.environment.findUnique({ where: { id: envId } });
  if (!env?.flyAppUrl) {
    return NextResponse.json(
      { error: "Environment not found or has no backend" },
      { status: 404 }
    );
  }

  let body: {
    orgName: string;
    orgSlug: string;
    adminEmail: string;
    adminName?: string;
    sendEmail?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.orgName || !body.orgSlug || !body.adminEmail) {
    return NextResponse.json(
      { error: "orgName, orgSlug, and adminEmail are required" },
      { status: 400 }
    );
  }

  try {
    const res = await backendFetch(
      env.flyAppUrl,
      "/api/platform/admin/orgs",
      {
        method: "POST",
        body: JSON.stringify({
          orgName: body.orgName,
          orgSlug: body.orgSlug,
          adminEmail: body.adminEmail,
          adminName: body.adminName,
        }),
      },
      env.serviceSecret
    );

    const text = await res.text();
    let data: Record<string, unknown>;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json(
        {
          error: `Backend returned invalid JSON (HTTP ${res.status}): ${text.slice(0, 200)}`,
        },
        { status: 502 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            (data.error as string) ??
            `Failed to create organization (HTTP ${res.status})`,
        },
        { status: res.status }
      );
    }

    let emailSent = false;
    let emailError: string | null = null;

    if (body.sendEmail !== false) {
      try {
        await sendOrgInviteEmail({
          to: body.adminEmail,
          orgName: body.orgName,
          invitedByName: "Chronicle Labs Admin",
          loginUrl: data.loginUrl as string,
          environmentName: env.name,
        });
        emailSent = true;
      } catch (err) {
        emailError = err instanceof Error ? err.message : String(err);
      }
    }

    return NextResponse.json({
      ...data,
      emailSent,
      emailError,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
