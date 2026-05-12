import { NextResponse, type NextRequest } from "next/server";

import {
  getCookiePassword,
  loadSession,
  setSealedSession,
} from "@/server/auth/session";
import { auth } from "@/server/auth/auth";

export const dynamic = "force-dynamic";

function safeFrom(value: string | null | undefined): string {
  if (typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("organizationId");
  const from = safeFrom(request.nextUrl.searchParams.get("from"));

  if (!organizationId) {
    return NextResponse.json(
      { error: "missing_organization_id" },
      { status: 400 },
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(
      new URL(`/login?from=${encodeURIComponent(from)}`, request.url),
    );
  }

  const isMember = session.user.organizations.some(
    (o) => o.workosOrganizationId === organizationId,
  );
  if (!isMember) {
    return NextResponse.json({ error: "not_a_member" }, { status: 403 });
  }

  const sealed = await loadSession();
  if (!sealed) {
    return NextResponse.redirect(
      new URL(`/login?from=${encodeURIComponent(from)}`, request.url),
    );
  }

  const refresh = await sealed.refresh({
    cookiePassword: getCookiePassword(),
    organizationId,
  });

  if (!refresh.authenticated || !refresh.sealedSession) {
    console.warn(
      "[auth/switch-org] sealed.refresh failed:",
      "reason" in refresh ? refresh.reason : "unknown",
    );
    return NextResponse.json({ error: "refresh_failed" }, { status: 502 });
  }

  await setSealedSession(refresh.sealedSession);
  return NextResponse.redirect(new URL(from, request.url));
}
