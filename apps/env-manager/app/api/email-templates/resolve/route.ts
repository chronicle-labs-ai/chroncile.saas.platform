import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/data/db";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  const envId = request.nextUrl.searchParams.get("envId");

  if (!key) {
    return NextResponse.json(
      { error: "key parameter is required" },
      { status: 400 }
    );
  }

  const templateKey = await prisma.emailTemplateKey.findUnique({
    where: { key },
  });
  if (!templateKey) {
    return NextResponse.json(
      { error: `Unknown template key: ${key}` },
      { status: 404 }
    );
  }

  if (envId) {
    const envAssignment = await prisma.emailTemplateAssignment.findUnique({
      where: {
        templateKeyId_environmentId: {
          templateKeyId: templateKey.id,
          environmentId: envId,
        },
      },
    });
    if (envAssignment) {
      return NextResponse.json({
        resendTemplateId: envAssignment.resendTemplateId,
      });
    }
  }

  const defaultAssignment = await prisma.emailTemplateAssignment.findFirst({
    where: {
      templateKeyId: templateKey.id,
      environmentId: null,
    },
  });

  if (defaultAssignment) {
    return NextResponse.json({
      resendTemplateId: defaultAssignment.resendTemplateId,
    });
  }

  return NextResponse.json(
    {
      error: `No template assignment found for key "${key}" (envId: ${envId ?? "default"})`,
    },
    { status: 404 }
  );
}
